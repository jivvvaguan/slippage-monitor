import type { Orderbook, SlippageResult } from './exchanges/types';
import { calculateSlippage } from './slippage';
import { computeDepthBands, type DepthBand } from './depth';
import { APP_CONFIG } from './config';
import type { MarketType } from './pairs';

interface ExchangeCache {
  orderbooks: Map<string, Orderbook>;
  slippageResults: Map<string, SlippageResult[]>; // key: pair, value: results for preset amounts
  depthBands: Map<string, (DepthBand | null)[]>; // key: pair
  lastUpdate: number;
}

const globalForCache = globalThis as unknown as { __slippageCache?: SlippageCache };

class SlippageCache {
  /**
   * Keyed by market and venue. Spot and perps list the same tickers (BTC on
   * both), so without the market in the key one would silently overwrite the
   * other and both tabs would show the same numbers.
   */
  private cache = new Map<string, ExchangeCache>();

  private key(market: MarketType, exchange: string): string {
    return `${market}:${exchange}`;
  }

  static getInstance(): SlippageCache {
    if (!globalForCache.__slippageCache) {
      globalForCache.__slippageCache = new SlippageCache();
    }
    return globalForCache.__slippageCache;
  }

  updateOrderbook(
    market: MarketType,
    exchange: string,
    pair: string,
    orderbook: Orderbook,
    feeBps: number,
    depthBook?: Orderbook | null,
  ): void {
    const now = Date.now();
    const key = this.key(market, exchange);
    if (!this.cache.has(key)) {
      this.cache.set(key, {
        orderbooks: new Map(),
        slippageResults: new Map(),
        depthBands: new Map(),
        lastUpdate: now,
      });
    }
    const ec = this.cache.get(key)!;
    ec.orderbooks.set(pair, orderbook);
    ec.lastUpdate = now;

    // Depth is a pure function of the book, so compute it on write (once per
    // collector tick) rather than on every API request. Venues that only
    // reach the band by aggregating levels supply a separate, coarser book.
    ec.depthBands.set(pair, computeDepthBands(depthBook ?? orderbook));

    // Pre-compute slippage for preset amounts with actual fee
    const results: SlippageResult[] = [];
    for (const amount of APP_CONFIG.presetAmounts) {
      const result = calculateSlippage(orderbook, amount, APP_CONFIG.defaultLeverage, feeBps, 'buy');
      result.pair = pair;
      results.push(result);
    }
    ec.slippageResults.set(pair, results);
  }

  getOrderbook(market: MarketType, exchange: string, pair: string): Orderbook | null {
    return this.cache.get(this.key(market, exchange))?.orderbooks.get(pair) ?? null;
  }

  getPrecomputedSlippage(market: MarketType, exchange: string, pair: string): SlippageResult[] {
    return this.cache.get(this.key(market, exchange))?.slippageResults.get(pair) ?? [];
  }

  getDepthBands(market: MarketType, exchange: string, pair: string): (DepthBand | null)[] {
    return this.cache.get(this.key(market, exchange))?.depthBands.get(pair) ?? [];
  }

  getDataAge(market: MarketType, exchange: string): number {
    const ec = this.cache.get(this.key(market, exchange));
    if (!ec) return Infinity;
    return Math.floor((Date.now() - ec.lastUpdate) / 1000);
  }

  getLastUpdate(market: MarketType, exchange: string): number {
    return this.cache.get(this.key(market, exchange))?.lastUpdate ?? 0;
  }

  getAllExchanges(): string[] {
    return Array.from(this.cache.keys()).map(k => k.split(':')[1]);
  }

  getExchangeStatus(market: MarketType, exchange: string): 'online' | 'degraded' | 'offline' {
    const age = this.getDataAge(market, exchange);
    if (age === Infinity) return 'offline';
    if (age > 600) return 'degraded'; // >10 minutes
    return 'online';
  }
}

export const cache = SlippageCache.getInstance();
