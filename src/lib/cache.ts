import type { Orderbook, SlippageResult } from './exchanges/types';
import { calculateSlippage } from './slippage';
import { computeDepthBand, type DepthBand } from './depth';
import { APP_CONFIG } from './config';

interface ExchangeCache {
  orderbooks: Map<string, Orderbook>;
  slippageResults: Map<string, SlippageResult[]>; // key: pair, value: results for preset amounts
  depthBands: Map<string, DepthBand | null>; // key: pair
  lastUpdate: number;
}

const globalForCache = globalThis as unknown as { __slippageCache?: SlippageCache };

class SlippageCache {
  private cache = new Map<string, ExchangeCache>();

  static getInstance(): SlippageCache {
    if (!globalForCache.__slippageCache) {
      globalForCache.__slippageCache = new SlippageCache();
    }
    return globalForCache.__slippageCache;
  }

  updateOrderbook(
    exchange: string,
    pair: string,
    orderbook: Orderbook,
    feeBps: number,
    depthBook?: Orderbook | null,
  ): void {
    const now = Date.now();
    if (!this.cache.has(exchange)) {
      this.cache.set(exchange, {
        orderbooks: new Map(),
        slippageResults: new Map(),
        depthBands: new Map(),
        lastUpdate: now,
      });
    }
    const ec = this.cache.get(exchange)!;
    ec.orderbooks.set(pair, orderbook);
    ec.lastUpdate = now;

    // Depth is a pure function of the book, so compute it on write (once per
    // collector tick) rather than on every API request. Venues that only
    // reach the band by aggregating levels supply a separate, coarser book.
    ec.depthBands.set(pair, computeDepthBand(depthBook ?? orderbook));

    // Pre-compute slippage for preset amounts with actual fee
    const results: SlippageResult[] = [];
    for (const amount of APP_CONFIG.presetAmounts) {
      const result = calculateSlippage(orderbook, amount, APP_CONFIG.defaultLeverage, feeBps, 'buy');
      result.pair = pair;
      results.push(result);
    }
    ec.slippageResults.set(pair, results);
  }

  getOrderbook(exchange: string, pair: string): Orderbook | null {
    return this.cache.get(exchange)?.orderbooks.get(pair) ?? null;
  }

  getPrecomputedSlippage(exchange: string, pair: string): SlippageResult[] {
    return this.cache.get(exchange)?.slippageResults.get(pair) ?? [];
  }

  getDepthBand(exchange: string, pair: string): DepthBand | null {
    return this.cache.get(exchange)?.depthBands.get(pair) ?? null;
  }

  getDataAge(exchange: string): number {
    const ec = this.cache.get(exchange);
    if (!ec) return Infinity;
    return Math.floor((Date.now() - ec.lastUpdate) / 1000);
  }

  getLastUpdate(exchange: string): number {
    return this.cache.get(exchange)?.lastUpdate ?? 0;
  }

  getAllExchanges(): string[] {
    return Array.from(this.cache.keys());
  }

  getExchangeStatus(exchange: string): 'online' | 'degraded' | 'offline' {
    const age = this.getDataAge(exchange);
    if (age === Infinity) return 'offline';
    if (age > 600) return 'degraded'; // >10 minutes
    return 'online';
  }
}

export const cache = SlippageCache.getInstance();
