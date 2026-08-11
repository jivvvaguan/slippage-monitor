import ccxt from 'ccxt';
import type { ExchangeAdapter, Orderbook } from './types';
import { normalizeOrderbook, computeMidPrice } from './base';
import { rescaleOrderbook } from './normalize';
import { splitMultiplier } from '../pairs';

export interface CcxtAdapterConfig {
  exchangeId: string;
  name: string;
  takerFeeBps: number;
  ccxtOptions?: Record<string, any>;
}

/** Settlement currencies to try, most liquid first. */
const QUOTE_PREFERENCE = ['USDT', 'USDC', 'USD'];

export class CcxtAdapter implements ExchangeAdapter {
  name: string;
  private exchange: any;
  private marketsLoaded = false;
  /** canonical base -> { symbol, multiplier } */
  private resolved = new Map<string, { symbol: string; multiplier: number }>();
  private takerFeeBps: number;

  constructor(config: CcxtAdapterConfig) {
    this.name = config.name;
    this.takerFeeBps = config.takerFeeBps;

    const ExchangeClass = (ccxt as any)[config.exchangeId];
    this.exchange = new ExchangeClass({
      enableRateLimit: true,
      ...config.ccxtOptions,
    });
  }

  /**
   * Index every active swap by its canonical base. Replaces the four-line
   * hardcoded map, which cannot express an 83-pair universe that changes
   * whenever SoDEX lists something new.
   */
  private async ensureMarkets(): Promise<void> {
    if (this.marketsLoaded) return;
    await this.exchange.loadMarkets();

    for (const market of Object.values(this.exchange.markets) as any[]) {
      if (!market.swap || !market.active) continue;
      const quoteRank = QUOTE_PREFERENCE.indexOf(market.settle ?? market.quote);
      if (quoteRank === -1) continue;

      const { base, multiplier } = splitMultiplier(market.base);
      const existing = this.resolved.get(base);
      if (existing) {
        const existingRank = QUOTE_PREFERENCE.indexOf(
          (this.exchange.markets[existing.symbol]?.settle ??
            this.exchange.markets[existing.symbol]?.quote) as string,
        );
        if (existingRank !== -1 && existingRank <= quoteRank) continue;
      }
      this.resolved.set(base, { symbol: market.symbol, multiplier });
    }

    this.marketsLoaded = true;
  }

  getSymbol(pair: string): string | null {
    return this.resolved.get(splitMultiplier(pair).base)?.symbol ?? null;
  }

  async getSupportedPairs(): Promise<string[]> {
    await this.ensureMarkets();
    return [...this.resolved.keys()];
  }

  getTakerFeeBps(): number {
    return this.takerFeeBps;
  }

  async fetchOrderbook(pair: string, limit: number): Promise<Orderbook | null> {
    await this.ensureMarkets();
    const entry = this.resolved.get(splitMultiplier(pair).base);
    if (!entry) return null;
    const { symbol, multiplier } = entry;

    try {
      const ob = await this.exchange.fetchOrderBook(symbol, limit);
      // Some venues quote book size in contracts rather than base currency
      // (MEXC contractSize 0.0001, OKX 0.01). Scale to base here so every
      // downstream consumer — slippage, depth — works in one unit.
      // markets[...] rather than market(): the latter throws on an unknown
      // symbol, and inside this try that would drop the venue entirely
      // instead of merely skipping the scaling.
      const contractSize = Number(this.exchange.markets[symbol]?.contractSize) || 1;
      const toBase = (levels: [number, number][]): [number, number][] =>
        contractSize === 1 ? levels : levels.map(([p, a]) => [p, a * contractSize]);
      const bids = normalizeOrderbook(toBase(ob.bids as [number, number][]));
      const asks = normalizeOrderbook(toBase(ob.asks as [number, number][]));
      if (bids.length === 0 || asks.length === 0) return null;

      // Report per-unit prices; the collector rescales to the pair's own
      // quoting unit so every venue lines up in the same column.
      return rescaleOrderbook(
        {
          exchange: this.name,
          symbol,
          bids,
          asks,
          timestamp: ob.timestamp ?? Date.now(),
          midPrice: computeMidPrice(bids, asks),
        },
        1 / multiplier,
      );
    } catch (err) {
      console.error(`[${this.name}] Error fetching ${pair}: ${(err as Error).message}`);
      return null;
    }
  }

  async close(): Promise<void> {
    await this.exchange.close();
  }
}
