import type { ExchangeAdapter, Orderbook, OrderbookEntry } from './types';
import { computeMidPrice } from './base';
import { spotBaseOf } from '../pairs';

const BASE_URL = 'https://mainnet-gw.sodex.dev/api/v1/spot';

interface TickersResponse {
  code: number;
  data?: Array<{ symbol: string }>;
}

interface OrderbookResponse {
  code: number;
  data?: { bids?: [string, string][]; asks?: [string, string][]; blockTime?: number };
}

/**
 * SoDEX spot.
 *
 * Spot runs on a separate service from perps — /api/v1/spot rather than
 * /futures/fapi — and its symbols carry SoDEX's bridged-asset prefixes
 * (vBTC_vUSDC, and the wrapped WSOSO_vUSDC for its own token). The endpoint is
 * undocumented publicly; it was read off the trading UI's own network calls.
 *
 * Everything is quoted in vUSDC, so the ccxt venues are matched on USDC pairs
 * where possible to avoid folding a USDT/USDC basis into the comparison.
 */
export class SodexSpotAdapter implements ExchangeAdapter {
  name = 'SoDEX';
  /** canonical base -> SoDEX spot symbol */
  private symbols = new Map<string, string>();
  private loaded = false;

  private async ensureSymbols(): Promise<void> {
    if (this.loaded) return;
    const json = (await (await fetch(`${BASE_URL}/markets/tickers`)).json()) as TickersResponse;
    if (json.code !== 0 || !Array.isArray(json.data)) throw new Error(`code ${json.code}`);
    for (const t of json.data) {
      this.symbols.set(spotBaseOf(t.symbol), t.symbol);
    }
    this.loaded = true;
  }

  getSymbol(pair: string): string | null {
    return this.symbols.get(pair.toUpperCase()) ?? null;
  }

  async getSupportedPairs(): Promise<string[]> {
    await this.ensureSymbols();
    return [...this.symbols.keys()];
  }

  getTakerFeeBps(): number {
    return 4.0;
  }

  async fetchOrderbook(pair: string, limit: number): Promise<Orderbook | null> {
    try {
      await this.ensureSymbols();
      const symbol = this.getSymbol(pair);
      if (!symbol) return null;

      const capped = Math.min(Math.max(limit, 1), 1000);
      const res = await fetch(`${BASE_URL}/markets/${symbol}/orderbook?limit=${capped}`);
      const json = (await res.json()) as OrderbookResponse;
      if (json.code !== 0 || !json.data) return null;

      const level = ([price, size]: [string, string]): OrderbookEntry => ({
        price: Number(price),
        amount: Number(size),
      });
      const bids = (json.data.bids ?? []).map(level)
        .filter(e => e.amount > 0)
        .sort((a, b) => b.price - a.price);
      const asks = (json.data.asks ?? []).map(level)
        .filter(e => e.amount > 0)
        .sort((a, b) => a.price - b.price);
      if (bids.length === 0 || asks.length === 0) return null;

      return {
        exchange: this.name,
        symbol,
        bids,
        asks,
        timestamp: json.data.blockTime ?? Date.now(),
        midPrice: computeMidPrice(bids, asks),
      };
    } catch (err) {
      console.error(`[SoDEX spot] Error fetching ${pair}: ${(err as Error).message}`);
      return null;
    }
  }

  async close(): Promise<void> {
    // Stateless HTTP client — nothing to tear down.
  }
}
