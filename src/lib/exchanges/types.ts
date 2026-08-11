export interface OrderbookEntry {
  price: number;
  amount: number; // in base currency
}

export interface Orderbook {
  exchange: string;
  symbol: string;
  asks: OrderbookEntry[]; // sorted ascending by price
  bids: OrderbookEntry[]; // sorted descending by price
  timestamp: number;
  midPrice: number;
}

export interface SlippageResult {
  exchange: string;
  pair: string; // config pair name (e.g., "GOLD", "BTC")
  symbol: string;
  side: 'buy' | 'sell';
  notionalUSD: number;
  leverage: number;
  principalUSD: number;
  avgFillPrice: number;
  midPrice: number;
  slippageBps: number;
  feeBps: number;
  totalCostBps: number;
  costPctOfPrincipal: number;
  filledQty: number;
  orderbookDepthUsed: number; // number of levels consumed
  insufficientLiquidity: boolean;
}

export interface ExchangeAdapter {
  name: string;
  fetchOrderbook(pair: string, limit: number): Promise<Orderbook | null>;
  /**
   * Optional second book used only for the ±0.5% depth band.
   *
   * Some venues only reach that far by aggregating price levels (Bitget's
   * merge-depth scale2 buckets BTC into $10 steps — 1.6 bps, the same order
   * as the slippage figures themselves). Such a book is fine for measuring
   * a 50 bps band and far too coarse for an average fill price, so those
   * adapters expose it here instead of degrading fetchOrderbook.
   */
  fetchDepthOrderbook?(pair: string, limit: number): Promise<Orderbook | null>;
  getTakerFeeBps(): number;
  getSymbol(pair: string): string | null;
  getSupportedPairs(): Promise<string[]>;
  close(): Promise<void>;
}

