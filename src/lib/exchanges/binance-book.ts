import type { Orderbook, OrderbookEntry } from './types';

const WS_URL = 'wss://fstream.binance.com/stream';
const REST_URL = 'https://fapi.binance.com/fapi/v1/depth';
const SNAPSHOT_LIMIT = 1000;

/**
 * Levels further than this from mid are dropped. The diff stream is a
 * whole-book feed, so an unpruned local book grows without bound (measured:
 * ~3000 levels after 60s and still climbing). ±5% is 10x the depth band we
 * report, so pruning can never truncate a measurement we act on.
 */
const PRUNE_BAND = 0.05;
const PRUNE_INTERVAL_MS = 60_000;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
/** A book with no diff applied for this long is treated as unusable. */
export const STALE_AFTER_MS = 30_000;

interface LocalBook {
  bids: Map<number, number>;
  asks: Map<number, number>;
  lastUpdateId: number;
  synced: boolean;
  lastMessage: number;
  buffer: DepthEvent[];
}

interface DepthEvent {
  U: number; // first update id in event
  u: number; // final update id in event
  pu: number; // final update id of the previous event
  b: [string, string][];
  a: [string, string][];
}

const globalForBooks = globalThis as unknown as { __binanceBooks?: BinanceBookManager };

export class BinanceBookManager {
  private books = new Map<string, LocalBook>(); // key: lowercase stream symbol
  private pairToSymbol = new Map<string, string>();
  private ws: WebSocket | null = null;
  private reconnectDelay = RECONNECT_BASE_MS;
  private pruneTimer: ReturnType<typeof setInterval> | null = null;
  private started = false;
  private closed = false;

  static getInstance(): BinanceBookManager {
    if (!globalForBooks.__binanceBooks) {
      globalForBooks.__binanceBooks = new BinanceBookManager();
    }
    return globalForBooks.__binanceBooks;
  }

  /** pairSymbols maps a config pair (BTC) to a Binance symbol (BTCUSDT). */
  start(pairSymbols: Record<string, string>): void {
    if (this.started) return;
    this.started = true;
    this.closed = false;

    for (const [pair, symbol] of Object.entries(pairSymbols)) {
      const stream = symbol.toLowerCase();
      this.pairToSymbol.set(pair, stream);
      this.books.set(stream, {
        bids: new Map(),
        asks: new Map(),
        lastUpdateId: 0,
        synced: false,
        lastMessage: 0,
        buffer: [],
      });
    }

    this.connect();
    this.pruneTimer = setInterval(() => this.pruneAll(), PRUNE_INTERVAL_MS);
    console.log(`[BinanceBook] Started — ${this.books.size} local books over one combined stream`);
  }

  private connect(): void {
    if (this.closed) return;

    const streams = [...this.books.keys()].map(s => `${s}@depth@100ms`).join('/');
    const ws = new WebSocket(`${WS_URL}?streams=${streams}`);
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectDelay = RECONNECT_BASE_MS;
      // Snapshot only after the stream is live, so no update can fall between
      // the snapshot and the first buffered diff.
      for (const stream of this.books.keys()) void this.resync(stream);
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(String(event.data)) as { stream?: string; data?: DepthEvent };
        if (!msg.stream || !msg.data) return;
        this.applyEvent(msg.stream.split('@')[0], msg.data);
      } catch {
        // A single malformed frame must not kill the socket.
      }
    };

    ws.onclose = () => {
      if (this.closed) return;
      for (const book of this.books.values()) book.synced = false;
      setTimeout(() => this.connect(), this.reconnectDelay);
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, RECONNECT_MAX_MS);
    };

    ws.onerror = () => {
      // onclose always follows; reconnection is handled there.
    };
  }

  private async resync(stream: string): Promise<void> {
    const book = this.books.get(stream);
    if (!book || this.closed) return;

    book.synced = false;
    book.buffer = [];

    try {
      const res = await fetch(`${REST_URL}?symbol=${stream.toUpperCase()}&limit=${SNAPSHOT_LIMIT}`);
      const snap = (await res.json()) as { lastUpdateId: number; bids: [string, string][]; asks: [string, string][] };
      if (!snap.lastUpdateId) return;

      book.bids.clear();
      book.asks.clear();
      applyLevels(book.bids, snap.bids);
      applyLevels(book.asks, snap.asks);
      book.lastUpdateId = snap.lastUpdateId;

      // Replay what arrived while the snapshot was in flight. Binance's rule:
      // discard events fully older than the snapshot, then require the first
      // kept event to straddle it.
      const pending = book.buffer.filter(e => e.u >= snap.lastUpdateId);
      book.buffer = [];
      for (const event of pending) {
        if (event.U > snap.lastUpdateId + 1) {
          void this.resync(stream); // gap — snapshot was already stale
          return;
        }
        applyLevels(book.bids, event.b);
        applyLevels(book.asks, event.a);
        book.lastUpdateId = event.u;
      }

      book.synced = true;
      book.lastMessage = Date.now();
    } catch (err) {
      console.error(`[BinanceBook] ${stream} snapshot failed: ${(err as Error).message}`);
      setTimeout(() => void this.resync(stream), RECONNECT_BASE_MS);
    }
  }

  private applyEvent(stream: string, event: DepthEvent): void {
    const book = this.books.get(stream);
    if (!book) return;

    if (!book.synced) {
      book.buffer.push(event);
      if (book.buffer.length > 5000) book.buffer.shift();
      return;
    }

    // pu is the previous event's final id; a mismatch means we missed a frame
    // and the local book can no longer be trusted.
    if (event.pu !== book.lastUpdateId) {
      void this.resync(stream);
      return;
    }

    applyLevels(book.bids, event.b);
    applyLevels(book.asks, event.a);
    book.lastUpdateId = event.u;
    book.lastMessage = Date.now();
  }

  private pruneAll(): void {
    for (const book of this.books.values()) {
      if (!book.synced) continue;
      const mid = midOf(book);
      if (!(mid > 0)) continue;
      const floor = mid * (1 - PRUNE_BAND);
      const ceiling = mid * (1 + PRUNE_BAND);
      for (const price of book.bids.keys()) if (price < floor) book.bids.delete(price);
      for (const price of book.asks.keys()) if (price > ceiling) book.asks.delete(price);
    }
  }

  /** Returns null unless the book is synced and fresh — callers fall back to REST. */
  getOrderbook(pair: string, symbol: string): Orderbook | null {
    const stream = this.pairToSymbol.get(pair);
    const book = stream ? this.books.get(stream) : undefined;
    if (!book?.synced) return null;
    if (Date.now() - book.lastMessage > STALE_AFTER_MS) return null;
    if (book.bids.size === 0 || book.asks.size === 0) return null;

    const bids = sortedLevels(book.bids, 'desc');
    const asks = sortedLevels(book.asks, 'asc');

    return {
      exchange: 'Binance',
      symbol,
      bids,
      asks,
      timestamp: book.lastMessage,
      midPrice: (bids[0].price + asks[0].price) / 2,
    };
  }

  close(): void {
    this.closed = true;
    this.started = false;
    if (this.pruneTimer) clearInterval(this.pruneTimer);
    this.pruneTimer = null;
    this.ws?.close();
    this.ws = null;
  }
}

function applyLevels(side: Map<number, number>, levels: [string, string][]): void {
  for (const [price, qty] of levels) {
    const p = Number(price);
    const q = Number(qty);
    if (q === 0) side.delete(p);
    else side.set(p, q);
  }
}

function sortedLevels(side: Map<number, number>, dir: 'asc' | 'desc'): OrderbookEntry[] {
  const levels = [...side.entries()].map(([price, amount]) => ({ price, amount }));
  levels.sort((a, b) => (dir === 'asc' ? a.price - b.price : b.price - a.price));
  return levels;
}

function midOf(book: LocalBook): number {
  let bestBid = 0;
  for (const price of book.bids.keys()) if (price > bestBid) bestBid = price;
  let bestAsk = Infinity;
  for (const price of book.asks.keys()) if (price < bestAsk) bestAsk = price;
  return bestBid > 0 && Number.isFinite(bestAsk) ? (bestBid + bestAsk) / 2 : 0;
}
