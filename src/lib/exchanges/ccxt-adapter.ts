import ccxt from 'ccxt';
import type { ExchangeAdapter, Orderbook } from './types';
import { normalizeOrderbook, computeMidPrice } from './base';

export interface CcxtAdapterConfig {
  exchangeId: string;
  name: string;
  pairSymbols: Record<string, string>;
  takerFeeBps: number;
  ccxtOptions?: Record<string, any>;
}

export class CcxtAdapter implements ExchangeAdapter {
  name: string;
  private exchange: any;
  private marketsLoaded = false;
  private availableSymbols = new Set<string>();
  private pairSymbols: Record<string, string>;
  private takerFeeBps: number;

  constructor(config: CcxtAdapterConfig) {
    this.name = config.name;
    this.pairSymbols = config.pairSymbols;
    this.takerFeeBps = config.takerFeeBps;

    const ExchangeClass = (ccxt as any)[config.exchangeId];
    this.exchange = new ExchangeClass({
      enableRateLimit: true,
      ...config.ccxtOptions,
    });
  }

  private async ensureMarkets(): Promise<void> {
    if (!this.marketsLoaded) {
      await this.exchange.loadMarkets();
      this.availableSymbols = new Set(Object.keys(this.exchange.markets));
      this.marketsLoaded = true;
    }
  }

  getSymbol(pair: string): string | null {
    return this.pairSymbols[pair] ?? null;
  }

  async getSupportedPairs(): Promise<string[]> {
    await this.ensureMarkets();
    return Object.entries(this.pairSymbols)
      .filter(([_, symbol]) => this.availableSymbols.has(symbol))
      .map(([pair]) => pair);
  }

  getTakerFeeBps(): number {
    return this.takerFeeBps;
  }

  async fetchOrderbook(pair: string, limit: number): Promise<Orderbook | null> {
    const symbol = this.getSymbol(pair);
    if (!symbol) return null;

    await this.ensureMarkets();
    if (!this.availableSymbols.has(symbol)) return null;

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
      return {
        exchange: this.name,
        symbol,
        bids,
        asks,
        timestamp: ob.timestamp ?? Date.now(),
        midPrice: computeMidPrice(bids, asks),
      };
    } catch (err) {
      console.error(`[${this.name}] Error fetching ${pair}: ${(err as Error).message}`);
      return null;
    }
  }

  async close(): Promise<void> {
    await this.exchange.close();
  }
}
