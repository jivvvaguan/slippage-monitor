export interface Config {
  pairs: string[];
  exchanges: string[];
  orderSizesUSD: number[];
  leverage: number;
  refreshIntervalMs: number;
  webPort: number;
  orderbookDepthLimit: number;
}

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
  getTakerFeeBps(): number;
  getSymbol(pair: string): string | null;
  getSupportedPairs(): Promise<string[]>;
  close(): Promise<void>;
}

export interface MonitorSnapshot {
  timestamp: number;
  results: SlippageResult[];
}
