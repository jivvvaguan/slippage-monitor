import type { ExchangeAdapter, Orderbook, OrderbookEntry } from './types';
import { computeMidPrice } from './base';
import { rescaleOrderbook } from './normalize';
import { splitMultiplier } from '../pairs';

const INFO_URL = 'https://api.hyperliquid.xyz/info';

/**
 * Significant figures for the depth book. Hyperliquid returns 20 levels per
 * side whatever you ask, so range comes only from how coarsely prices are
 * bucketed: full precision spans ±0.03%, nSigFigs 4 spans ±0.30%, and 3 spans
 * ±3.0%. Anything coarser (2) buckets so wide that the ±0.5% band no longer
 * contains a level boundary and reads as zero.
 */
const DEPTH_SIG_FIGS = 3;

interface L2BookResponse {
  levels?: [Array<{ px: string; sz: string }>, Array<{ px: string; sz: string }>];
  time?: number;
}

/**
 * Hyperliquid via its native info endpoint rather than ccxt.
 *
 * The book is always 20 levels per side, which at full precision spans only
 * ±0.03% of mid — far short of the ±0.5% depth band. Price bucketing is the
 * only lever, and at nSigFigs 3 a BTC level is $100 wide (~15.6 bps), which is
 * an order of magnitude coarser than the slippage figures. So full precision
 * prices the fill and the bucketed book measures the band.
 */
export class HyperliquidAdapter implements ExchangeAdapter {
  name = 'Hyperliquid';
  /** canonical base -> { coin, multiplier }; Hyperliquid uses a kX prefix. */
  private resolved = new Map<string, { coin: string; multiplier: number }>();
  private loaded = false;

  private async ensureUniverse(): Promise<void> {
    if (this.loaded) return;
    const res = await fetch(INFO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'meta' }),
    });
    const json = (await res.json()) as { universe?: Array<{ name: string; isDelisted?: boolean }> };
    for (const u of json.universe ?? []) {
      if (u.isDelisted) continue;
      const { base, multiplier } = splitMultiplier(u.name);
      this.resolved.set(base, { coin: u.name, multiplier });
    }
    this.loaded = true;
  }

  getSymbol(pair: string): string | null {
    return this.resolved.get(splitMultiplier(pair).base)?.coin ?? null;
  }

  async getSupportedPairs(): Promise<string[]> {
    await this.ensureUniverse();
    return [...this.resolved.keys()];
  }

  getTakerFeeBps(): number {
    return 4.5;
  }

  private async fetchBook(pair: string, nSigFigs?: number): Promise<Orderbook | null> {
    try {
      await this.ensureUniverse();
      const entry = this.resolved.get(splitMultiplier(pair).base);
      if (!entry) return null;
      const { coin, multiplier } = entry;

      const res = await fetch(INFO_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'l2Book', coin, ...(nSigFigs ? { nSigFigs } : {}) }),
      });
      const json = (await res.json()) as L2BookResponse;
      if (!json.levels) return null;

      const level = ({ px, sz }: { px: string; sz: string }): OrderbookEntry => ({
        price: Number(px),
        amount: Number(sz),
      });
      const bids = json.levels[0].map(level);
      const asks = json.levels[1].map(level);
      if (bids.length === 0 || asks.length === 0) return null;

      return rescaleOrderbook(
        {
          exchange: this.name,
          symbol: coin,
          bids,
          asks,
          timestamp: json.time ?? Date.now(),
          midPrice: computeMidPrice(bids, asks),
        },
        1 / multiplier,
      );
    } catch (err) {
      console.error(`[${this.name}] Error fetching ${pair}: ${(err as Error).message}`);
      return null;
    }
  }

  fetchOrderbook(pair: string, _limit: number): Promise<Orderbook | null> {
    return this.fetchBook(pair);
  }

  fetchDepthOrderbook(pair: string, _limit: number): Promise<Orderbook | null> {
    return this.fetchBook(pair, DEPTH_SIG_FIGS);
  }

  async close(): Promise<void> {
    // Stateless HTTP client — nothing to tear down.
  }
}
