import ccxt, { type Exchange as CcxtExchange } from 'ccxt';
import type { ExchangeAdapter, Orderbook } from './types';
import { normalizeOrderbook, computeMidPrice } from './base';

export interface CcxtAdapterConfig {
  exchangeId: string;
  name: string;
  pairSymbols: Record<string, string>;
  takerFeeBps: number;
  ccxtOptions?: Record<string, unknown>;
}

export class CcxtAdapter implements ExchangeAdapter {
  name: string;
  private exchange: CcxtExchange;
  private marketsLoaded = false;
  private availableSymbols = new Set<string>();
  private pairSymbols: Record<string, string>;
  private takerFeeBps: number;

  constructor(config: CcxtAdapterConfig) {
    this.name = config.name;
    this.pairSymbols = config.pairSymbols;
    this.takerFeeBps = config.takerFeeBps;

    const ExchangeClass = (ccxt as Record<string, unknown>)[config.exchangeId] as new (opts: Record<string, unknown>) => CcxtExchange;
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
      .filter(([, symbol]) => this.availableSymbols.has(symbol))
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
      const bids = normalizeOrderbook(ob.bids as [number, number][]);
      const asks = normalizeOrderbook(ob.asks as [number, number][]);
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
