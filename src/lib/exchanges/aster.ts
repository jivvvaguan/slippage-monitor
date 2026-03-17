import type { ExchangeAdapter, Orderbook, OrderbookEntry } from './types';
import { computeMidPrice } from './base';

const BASE_URL = 'https://fapi.asterdex.com';

const PAIR_SYMBOLS: Record<string, string> = {
  BTC: 'BTCUSDT',
  ETH: 'ETHUSDT',
  SOL: 'SOLUSDT',
};

interface AsterDepthResponse {
  lastUpdateId: number;
  E: number; // message output time
  T: number; // transaction time
  bids: [string, string][];
  asks: [string, string][];
}

export class AsterAdapter implements ExchangeAdapter {
  name = 'Aster';

  getTakerFeeBps(): number {
    return 5.0; // 0.05% taker fee
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

      return {
        exchange: this.name,
        symbol: `${pair}/USDT`,
        bids,
        asks,
        timestamp: json.E ?? Date.now(),
        midPrice: computeMidPrice(bids, asks),
      };
    } catch (err) {
      console.error(
        `[Aster] Error fetching ${pair}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  async close(): Promise<void> {}
}
