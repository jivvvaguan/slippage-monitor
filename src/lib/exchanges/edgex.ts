import type { ExchangeAdapter, Orderbook, OrderbookEntry } from './types';
import { computeMidPrice } from './base';
import { rescaleOrderbook } from './normalize';
import { splitMultiplier } from '../pairs';

const BASE_URL = 'https://pro.edgex.exchange';

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
  /** canonical base -> { contractId, name, multiplier } */
  private resolved = new Map<string, { contractId: string; name: string; multiplier: number }>();
  private loaded = false;

  /**
   * Resolve contracts from EdgeX's own metadata.
   *
   * The previous hardcoded table mapped SOL to contract 10000004, which is
   * BNB2USD — EdgeX was reporting BNB's price as SOL. Coin names carry a
   * version suffix (BNB2, 1000PEPE2), so the trailing digits are stripped and
   * the unsuffixed listing wins when a coin has both.
   */
  private async ensureContracts(): Promise<void> {
    if (this.loaded) return;
    const res = await fetch(`${BASE_URL}/api/v1/public/meta/getMetaData`);
    const json = (await res.json()) as {
      data?: {
        coinList?: Array<{ coinId: string; coinName: string }>;
        contractList?: Array<{
          contractId: string; contractName: string; baseCoinId: string;
          enableTrade?: boolean; enableDisplay?: boolean;
        }>;
      };
    };
    const coins = new Map((json.data?.coinList ?? []).map(c => [c.coinId, c.coinName]));

    for (const c of json.data?.contractList ?? []) {
      if (c.enableTrade === false || c.enableDisplay === false) continue;
      const coinName = coins.get(c.baseCoinId);
      if (!coinName) continue;

      const unversioned = /^(.*[A-Z])\d+$/.exec(coinName)?.[1] ?? coinName;
      const { base, multiplier } = splitMultiplier(unversioned);
      const existing = this.resolved.get(base);
      // Prefer the listing whose coin name carries no version suffix.
      if (existing && existing.name === base) continue;
      this.resolved.set(base, { contractId: c.contractId, name: unversioned, multiplier });
    }
    this.loaded = true;
  }

  getTakerFeeBps(): number {
    return 5.0; // 0.05% taker fee
  }

  getSymbol(pair: string): string | null {
    const entry = this.resolved.get(splitMultiplier(pair).base);
    return entry ? `${entry.name}USD` : null;
  }

  async getSupportedPairs(): Promise<string[]> {
    await this.ensureContracts();
    return [...this.resolved.keys()];
  }

  async fetchOrderbook(pair: string, limit: number): Promise<Orderbook | null> {
    try {
      await this.ensureContracts();
      const entry = this.resolved.get(splitMultiplier(pair).base);
      if (!entry) return null;
      const { contractId, name, multiplier } = entry;

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

      if (bids.length === 0 || asks.length === 0) return null;

      return rescaleOrderbook(
        {
          exchange: this.name,
          symbol: `${name}USD`,
          bids,
          asks,
          timestamp: Date.now(),
          midPrice: computeMidPrice(bids, asks),
        },
        1 / multiplier,
      );
    } catch (err) {
      console.error(
        `[EdgeX] Error fetching ${pair}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  async close(): Promise<void> {}
}
