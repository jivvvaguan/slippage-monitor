import type { ExchangeAdapter, Orderbook, OrderbookEntry } from './types';
import { computeMidPrice } from './base';
import { BinanceBookManager } from './binance-book';

const REST_URL = 'https://fapi.binance.com/fapi/v1/depth';

const PAIR_SYMBOLS: Record<string, string> = {
  BTC: 'BTCUSDT',
  ETH: 'ETHUSDT',
  SOL: 'SOLUSDT',
  GOLD: 'PAXGUSDT',
};

/**
 * Binance backed by a locally maintained book.
 *
 * A REST snapshot caps at 1000 levels, which spans only ±0.18% of mid — short
 * of the ±0.5% depth band, and it under-reports depth inside the band by about
 * 35% (measured: $46.9M from the snapshot vs $63.3M once the local book had
 * run for a minute). Unlike Bybit's top-N window feed, Binance's @depth stream
 * is a whole-book diff, so a local book keeps growing past any snapshot limit.
 *
 * Falls back to the REST snapshot whenever the local book is not yet synced or
 * has gone stale, so a cold start or a dropped socket degrades rather than
 * removing the venue from the comparison.
 */
export class BinanceAdapter implements ExchangeAdapter {
  name = 'Binance';
  private books = BinanceBookManager.getInstance();

  constructor() {
    this.books.start(PAIR_SYMBOLS);
  }

  getSymbol(pair: string): string | null {
    return PAIR_SYMBOLS[pair] ?? null;
  }

  async getSupportedPairs(): Promise<string[]> {
    return Object.keys(PAIR_SYMBOLS);
  }

  getTakerFeeBps(): number {
    return 5.0;
  }

  async fetchOrderbook(pair: string, limit: number): Promise<Orderbook | null> {
    const symbol = this.getSymbol(pair);
    if (!symbol) return null;

    const live = this.books.getOrderbook(pair, symbol);
    if (live) return live;

    try {
      const capped = Math.min(Math.max(limit, 5), 1000);
      const res = await fetch(`${REST_URL}?symbol=${symbol}&limit=${capped}`);
      const snap = (await res.json()) as { bids: [string, string][]; asks: [string, string][] };
      if (!snap.bids?.length || !snap.asks?.length) return null;

      const level = ([price, amount]: [string, string]): OrderbookEntry => ({
        price: Number(price),
        amount: Number(amount),
      });
      const bids = snap.bids.map(level);
      const asks = snap.asks.map(level);

      return {
        exchange: this.name,
        symbol,
        bids,
        asks,
        timestamp: Date.now(),
        midPrice: computeMidPrice(bids, asks),
      };
    } catch (err) {
      console.error(`[${this.name}] Error fetching ${pair}: ${(err as Error).message}`);
      return null;
    }
  }

  async close(): Promise<void> {
    this.books.close();
  }
}
