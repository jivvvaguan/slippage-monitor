import type { ExchangeAdapter, Orderbook, OrderbookEntry } from './types';
import { computeMidPrice } from './base';
import { rescaleOrderbook } from './normalize';
import { splitMultiplier } from '../pairs';

const BASE_URL = 'https://fapi.asterdex.com';

interface AsterDepthResponse {
  lastUpdateId: number;
  E: number; // message output time
  T: number; // transaction time
  bids: [string, string][];
  asks: [string, string][];
}

export class AsterAdapter implements ExchangeAdapter {
  name = 'Aster';
  /** canonical base -> { symbol, multiplier } from exchangeInfo. */
  private resolved = new Map<string, { symbol: string; multiplier: number }>();
  private loaded = false;

  private async ensureSymbols(): Promise<void> {
    if (this.loaded) return;
    const res = await fetch(`${BASE_URL}/fapi/v1/exchangeInfo`);
    const json = (await res.json()) as { symbols?: Array<{ symbol: string; baseAsset: string; status: string }> };
    for (const s of json.symbols ?? []) {
      if (s.status !== 'TRADING' || !s.symbol.endsWith('USDT')) continue;
      const { base, multiplier } = splitMultiplier(s.baseAsset);
      this.resolved.set(base, { symbol: s.symbol, multiplier });
    }
    this.loaded = true;
  }

  getTakerFeeBps(): number {
    return 5.0; // 0.05% taker fee
  }

  getSymbol(pair: string): string | null {
    return this.resolved.get(splitMultiplier(pair).base)?.symbol ?? null;
  }

  async getSupportedPairs(): Promise<string[]> {
    await this.ensureSymbols();
    return [...this.resolved.keys()];
  }

  async fetchOrderbook(pair: string, limit: number): Promise<Orderbook | null> {
    try {
      await this.ensureSymbols();
      const entry = this.resolved.get(splitMultiplier(pair).base);
      if (!entry) return null;
      const { symbol, multiplier } = entry;

      const cappedLimit = Math.min(limit, 1000);
      const url = `${BASE_URL}/fapi/v1/depth?symbol=${symbol}&limit=${cappedLimit}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as AsterDepthResponse;

      const rawAsks: [string, string][] = json.asks ?? [];
      const rawBids: [string, string][] = json.bids ?? [];

      const asks: OrderbookEntry[] = rawAsks
        .map(([p, q]) => ({
          price: Number(p),
          amount: Number(q),
        }))
        .filter((e) => e.amount > 0)
        .sort((a, b) => a.price - b.price);

      const bids: OrderbookEntry[] = rawBids
        .map(([p, q]) => ({
          price: Number(p),
          amount: Number(q),
        }))
        .filter((e) => e.amount > 0)
        .sort((a, b) => b.price - a.price);

      if (bids.length === 0 || asks.length === 0) return null;

      // Per-unit prices; the collector rescales to the pair's quoting unit.
      return rescaleOrderbook(
        {
          exchange: this.name,
          symbol,
          bids,
          asks,
          timestamp: json.E ?? Date.now(),
          midPrice: computeMidPrice(bids, asks),
        },
        1 / multiplier,
      );
    } catch (err) {
      console.error(
        `[Aster] Error fetching ${pair}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  async close(): Promise<void> {}
}
