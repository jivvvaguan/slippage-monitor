import type { ExchangeAdapter, Orderbook, OrderbookEntry } from './types';
import { computeMidPrice } from './base';
import { rescaleOrderbook } from './normalize';
import { splitMultiplier } from '../pairs';

const BASE_URL = 'https://api.bitget.com';
const PRODUCT_TYPE = 'usdt-futures';

/** Native tick. Fine enough for an average fill price, ~±0.03% of book. */
const PRECISION_FINE = 'scale0';
/** Aggregated tick (~$10 on BTC). Too coarse to price a fill, deep enough to measure the band. */
const PRECISION_DEEP = 'scale2';

interface MergeDepthResponse {
  code: string;
  msg?: string;
  data?: { bids: [string, string][]; asks: [string, string][]; ts: string };
}

/**
 * Bitget via /mix/market/merge-depth.
 *
 * Bitget caps the book at 100 levels regardless of the requested limit, so at
 * native precision it spans only ~±0.03% of mid — far short of the ±0.5% depth
 * band. Its `precision` parameter aggregates price levels, which buys range
 * with the same 100 levels: scale2 measured at ±1.46%.
 *
 * That aggregation is only acceptable for the depth band. scale2 buckets BTC
 * into $10 steps (1.6 bps), which is the same order as the slippage numbers
 * themselves, so the fine book is kept for fetchOrderbook and the aggregated
 * one is exposed separately via fetchDepthOrderbook.
 */
export class BitgetAdapter implements ExchangeAdapter {
  name = 'Bitget';
  /** canonical base -> { symbol, multiplier } from the contracts listing. */
  private resolved = new Map<string, { symbol: string; multiplier: number }>();
  private loaded = false;

  private async ensureSymbols(): Promise<void> {
    if (this.loaded) return;
    const res = await fetch(`${BASE_URL}/api/v2/mix/market/contracts?productType=${PRODUCT_TYPE}`);
    const json = (await res.json()) as {
      code: string;
      data?: Array<{ symbol: string; baseCoin: string; symbolStatus?: string }>;
    };
    if (json.code !== '00000' || !json.data) throw new Error(`contracts failed: ${json.code}`);
    for (const c of json.data) {
      if (c.symbolStatus && c.symbolStatus !== 'normal') continue;
      const { base, multiplier } = splitMultiplier(c.baseCoin);
      this.resolved.set(base, { symbol: c.symbol, multiplier });
    }
    this.loaded = true;
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

  private async fetchBook(pair: string, precision: string): Promise<Orderbook | null> {
    try {
      await this.ensureSymbols();
      const entry = this.resolved.get(splitMultiplier(pair).base);
      if (!entry) return null;
      const { symbol, multiplier } = entry;

      const url =
        `${BASE_URL}/api/v2/mix/market/merge-depth` +
        `?symbol=${symbol}&productType=${PRODUCT_TYPE}&precision=${precision}&limit=max`;
      const json = (await (await fetch(url)).json()) as MergeDepthResponse;
      if (json.code !== '00000' || !json.data) return null;

      const level = ([price, size]: [string, string]): OrderbookEntry => ({
        price: Number(price),
        amount: Number(size),
      });
      const bids = json.data.bids.map(level);
      const asks = json.data.asks.map(level);
      if (bids.length === 0 || asks.length === 0) return null;

      return rescaleOrderbook(
        {
          exchange: this.name,
          symbol,
          bids,
          asks,
          timestamp: Number(json.data.ts) || Date.now(),
          midPrice: computeMidPrice(bids, asks),
        },
        1 / multiplier,
      );
    } catch (err) {
      console.error(`[${this.name}] Error fetching ${pair} (${precision}): ${(err as Error).message}`);
      return null;
    }
  }

  fetchOrderbook(pair: string, _limit: number): Promise<Orderbook | null> {
    return this.fetchBook(pair, PRECISION_FINE);
  }

  fetchDepthOrderbook(pair: string, _limit: number): Promise<Orderbook | null> {
    return this.fetchBook(pair, PRECISION_DEEP);
  }

  async close(): Promise<void> {
    // Stateless HTTP client — nothing to tear down.
  }
}
