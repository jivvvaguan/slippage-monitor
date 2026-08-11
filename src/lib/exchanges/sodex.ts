import type { ExchangeAdapter, Orderbook, OrderbookEntry } from './types';
import { computeMidPrice } from './base';
import { rescaleOrderbook } from './normalize';
import { splitMultiplier } from '../pairs';

interface SodexSymbol {
  symbol: string;
  baseAsset: string;
  futureType: string;
  state: string;
}

const BASE_URL = 'https://mainnet-gw.sodex.dev/futures/fapi/market/v1/public';

export class SodexAdapter implements ExchangeAdapter {
  name = 'SoDEX';
  /** canonical pair id -> SoDEX contract symbol, filled from the listing. */
  private symbols = new Map<string, string>();
  private loaded = false;

  /** SoDEX defines the pair universe, so its own listing is the source. */
  private async ensureSymbols(): Promise<void> {
    if (this.loaded) return;
    const res = await fetch(`${BASE_URL}/m/symbols`);
    const json = (await res.json()) as { code: number; data?: SodexSymbol[] };
    if (json.code !== 0 || !Array.isArray(json.data)) throw new Error(`code ${json.code}`);
    for (const s of json.data) {
      if (s.futureType !== 'PERPETUAL' || s.state !== 'online') continue;
      this.symbols.set(s.baseAsset.toUpperCase(), s.symbol);
    }
    this.loaded = true;
  }

  getTakerFeeBps(): number {
    return 4.0; // 0.04% base taker fee
  }

  getSymbol(pair: string): string | null {
    return this.symbols.get(pair.toUpperCase()) ?? null;
  }

  async getSupportedPairs(): Promise<string[]> {
    await this.ensureSymbols();
    return [...this.symbols.keys()];
  }

  async fetchOrderbook(pair: string, limit: number): Promise<Orderbook | null> {
    try {
      await this.ensureSymbols();
      const symbol = this.getSymbol(pair);
      if (!symbol) return null;

      const cappedLimit = Math.min(limit, 1000);
      const url = `${BASE_URL}/m/depth?symbol=${symbol}&size=${cappedLimit}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as any;

      if (json.code !== 0 || !json.data) {
        throw new Error(json.error ?? `code ${json.code}`);
      }

      const data = json.data;
      const rawAsks: [string, string][] = data.asks ?? [];
      const rawBids: [string, string][] = data.bids ?? [];

      const asks: OrderbookEntry[] = rawAsks.map(([p, q]) => ({
        price: Number(p),
        amount: Number(q),
      })).filter(e => e.amount > 0).sort((a, b) => a.price - b.price);

      const bids: OrderbookEntry[] = rawBids.map(([p, q]) => ({
        price: Number(p),
        amount: Number(q),
      })).filter(e => e.amount > 0).sort((a, b) => b.price - a.price);

      if (bids.length === 0 || asks.length === 0) return null;

      // SoDEX quotes 1000PEPE in thousands; report per-unit like every other
      // adapter and let the collector reapply the pair's quoting unit.
      const { multiplier } = splitMultiplier(pair);
      return rescaleOrderbook(
        {
          exchange: this.name,
          symbol,
          bids,
          asks,
          timestamp: json.timestamp ?? Date.now(),
          midPrice: computeMidPrice(bids, asks),
        },
        1 / multiplier,
      );
    } catch (err) {
      console.error(`[SoDEX] Error fetching ${pair}: ${(err as Error).message}`);
      return null;
    }
  }

  async close(): Promise<void> {}
}
