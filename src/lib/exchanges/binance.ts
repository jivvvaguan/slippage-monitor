import type { ExchangeAdapter, Orderbook, OrderbookEntry } from './types';
import { computeMidPrice } from './base';
import { rescaleOrderbook } from './normalize';
import { splitMultiplier } from '../pairs';
import { BinanceBookManager } from './binance-book';

const REST_URL = 'https://fapi.binance.com/fapi/v1/depth';
const EXCHANGE_INFO_URL = 'https://fapi.binance.com/fapi/v1/exchangeInfo';

/** Binance only accepts these depth limits; 200 is rejected outright. */
const VALID_LIMITS = [5, 10, 20, 50, 100, 500, 1000];

/**
 * Binance backed by a locally maintained book for the pairs that matter most.
 *
 * A REST snapshot caps at 1000 levels, which spans only ±0.18% of mid — short
 * of the ±0.5% depth band, and it under-reports depth inside the band by about
 * 35%. Binance's @depth stream is a whole-book diff, so a local book keeps
 * growing past any snapshot limit.
 *
 * Live books are restricted to tier-1 pairs. Running all 83 would mean 83
 * simultaneous snapshots on every reconnect — 1660 request weight against a
 * 2400/minute budget, which is exactly how you get rate limited. The long tail
 * uses REST, where a lower level count is an acceptable trade.
 */
export class BinanceAdapter implements ExchangeAdapter {
  name = 'Binance';
  private books = BinanceBookManager.getInstance();
  /** canonical base -> { symbol, multiplier } */
  private resolved = new Map<string, { symbol: string; multiplier: number }>();
  private loaded = false;
  private liveBases = new Set<string>();

  private async ensureSymbols(): Promise<void> {
    if (this.loaded) return;
    const res = await fetch(EXCHANGE_INFO_URL);
    const json = (await res.json()) as {
      symbols?: Array<{
        symbol: string; baseAsset: string; quoteAsset: string;
        status: string; contractType: string;
      }>;
    };
    for (const s of json.symbols ?? []) {
      // exchangeInfo carries quarterlies alongside perps; those trade at a
      // premium (BTCUSDT_251226 sat 1.5% above spot) and would silently
      // replace the perpetual for the same base.
      if (s.status !== 'TRADING' || s.quoteAsset !== 'USDT') continue;
      if (s.contractType !== 'PERPETUAL') continue;
      const { base, multiplier } = splitMultiplier(s.baseAsset);
      this.resolved.set(base, { symbol: s.symbol, multiplier });
    }
    this.loaded = true;
  }

  /**
   * Open local books for the given pairs. Called by the collector once the
   * pair universe is known; safe to call repeatedly.
   */
  async startLiveBooks(pairIds: string[]): Promise<void> {
    await this.ensureSymbols();
    const streams: Record<string, string> = {};
    for (const pairId of pairIds) {
      const base = splitMultiplier(pairId).base;
      const entry = this.resolved.get(base);
      if (!entry) continue;
      streams[pairId] = entry.symbol;
      this.liveBases.add(base);
    }
    if (Object.keys(streams).length > 0) this.books.start(streams);
  }

  getSymbol(pair: string): string | null {
    return this.resolved.get(splitMultiplier(pair).base)?.symbol ?? null;
  }

  async getSupportedPairs(): Promise<string[]> {
    await this.ensureSymbols();
    return [...this.resolved.keys()];
  }

  getTakerFeeBps(): number {
    return 5.0;
  }

  async fetchOrderbook(pair: string, limit: number): Promise<Orderbook | null> {
    try {
      await this.ensureSymbols();
      const base = splitMultiplier(pair).base;
      const entry = this.resolved.get(base);
      if (!entry) return null;
      const { symbol, multiplier } = entry;

      if (this.liveBases.has(base)) {
        const live = this.books.getOrderbook(pair, symbol);
        if (live) return rescaleOrderbook(live, 1 / multiplier);
      }

      const capped = VALID_LIMITS.reduce((best, v) =>
        Math.abs(v - limit) < Math.abs(best - limit) ? v : best,
      );
      const res = await fetch(`${REST_URL}?symbol=${symbol}&limit=${capped}`);
      const snap = (await res.json()) as { bids?: [string, string][]; asks?: [string, string][] };
      if (!snap.bids?.length || !snap.asks?.length) return null;

      const level = ([price, amount]: [string, string]): OrderbookEntry => ({
        price: Number(price),
        amount: Number(amount),
      });
      const bids = snap.bids.map(level);
      const asks = snap.asks.map(level);

      return rescaleOrderbook(
        {
          exchange: this.name,
          symbol,
          bids,
          asks,
          timestamp: Date.now(),
          midPrice: computeMidPrice(bids, asks),
        },
        1 / multiplier,
      );
    } catch (err) {
      console.error(`[${this.name}] Error fetching ${pair}: ${(err as Error).message}`);
      return null;
    }
  }

  async close(): Promise<void> {
    this.books.close();
  }
}
