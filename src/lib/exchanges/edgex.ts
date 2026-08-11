import type { ExchangeAdapter, Orderbook, OrderbookEntry } from './types';
import { computeMidPrice } from './base';

const BASE_URL = 'https://pro.edgex.exchange';

const PAIR_CONTRACT_IDS: Record<string, string> = {
  BTC: '10000001',
  ETH: '10000002',
  SOL: '10000004',
};

interface EdgeXDepthEntry {
  price: string;
  size: string;
}

interface EdgeXDepthItem {
  contractId: string;
  contractName: string;
  asks: EdgeXDepthEntry[];
  bids: EdgeXDepthEntry[];
}

interface EdgeXDepthResponse {
  code: string;
  data: EdgeXDepthItem[];
  msg: string | null;
}

export class EdgeXAdapter implements ExchangeAdapter {
  name = 'EdgeX';

  getTakerFeeBps(): number {
    return 5.0; // 0.05% taker fee
  }

  getSymbol(pair: string): string | null {
    return PAIR_CONTRACT_IDS[pair] ? `${pair}USD` : null;
  }

  async getSupportedPairs(): Promise<string[]> {
    return Object.keys(PAIR_CONTRACT_IDS);
  }

  async fetchOrderbook(pair: string, limit: number): Promise<Orderbook | null> {
    const contractId = PAIR_CONTRACT_IDS[pair];
    if (!contractId) return null;

    try {
      const level = limit > 15 ? '200' : '15';
      const url = `${BASE_URL}/api/v1/public/quote/getDepth?contractId=${contractId}&level=${level}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as EdgeXDepthResponse;

      if (json.code !== 'SUCCESS' || !json.data || json.data.length === 0) {
        throw new Error(json.msg ?? `code ${json.code}`);
      }

      const item = json.data[0];

      const asks: OrderbookEntry[] = (item.asks ?? [])
        .map((e) => ({
          price: Number(e.price),
          amount: Number(e.size),
        }))
        .filter((e) => e.amount > 0)
        .sort((a, b) => a.price - b.price);

      const bids: OrderbookEntry[] = (item.bids ?? [])
        .map((e) => ({
          price: Number(e.price),
          amount: Number(e.size),
        }))
        .filter((e) => e.amount > 0)
        .sort((a, b) => b.price - a.price);

      return {
        exchange: this.name,
        symbol: `${pair}/USD`,
        bids,
        asks,
        timestamp: Date.now(),
        midPrice: computeMidPrice(bids, asks),
      };
    } catch (err) {
      console.error(
        `[EdgeX] Error fetching ${pair}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  async close(): Promise<void> {}
}
