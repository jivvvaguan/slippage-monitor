import type { ExchangeAdapter, Orderbook, OrderbookEntry } from './types';
import { computeMidPrice } from './base';

const BASE_URL = 'https://mainnet-gw.sodex.dev/futures/fapi/market/v1/public';

const PAIR_SYMBOLS: Record<string, string> = {
  BTC: 'BTC-USD',
  ETH: 'ETH-USD',
  SOL: 'SOL-USD',
  GOLD: 'XAUT-USD',
};

interface SodexDepthResponse {
  code: number;
  error?: string;
  timestamp?: number;
  data?: {
    asks?: [string, string][];
    bids?: [string, string][];
  };
}

export class SodexAdapter implements ExchangeAdapter {
  name = 'SoDEX';

  getTakerFeeBps(): number {
    return 4.0; // 0.04% base taker fee
  }

  getSymbol(pair: string): string | null {
    return PAIR_SYMBOLS[pair] ?? null;
  }

  async getSupportedPairs(): Promise<string[]> {
    return Object.keys(PAIR_SYMBOLS);
  }

  async fetchOrderbook(pair: string, limit: number): Promise<Orderbook | null> {
    const symbol = this.getSymbol(pair);
    if (!symbol) return null;

    try {
      const cappedLimit = Math.min(limit, 1000);
      const url = `${BASE_URL}/m/depth?symbol=${symbol}&size=${cappedLimit}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as SodexDepthResponse;

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

      return {
        exchange: this.name,
        symbol: `${pair}/USD`,
        bids,
        asks,
        timestamp: json.timestamp ?? Date.now(),
        midPrice: computeMidPrice(bids, asks),
      };
    } catch (err) {
      console.error(`[SoDEX] Error fetching ${pair}: ${(err as Error).message}`);
      return null;
    }
  }

  async close(): Promise<void> {}
}
