import type { ExchangeAdapter, Orderbook, OrderbookEntry } from './types';
import { computeMidPrice } from './base';

const BASE_URL = 'https://mainnet.zklighter.elliot.ai/api/v1';

interface LighterMarketMeta {
  market_id: number;
  symbol: string;
  market_type: string;
  size_decimals: number;
  price_decimals: number;
}

interface LighterOrderBook {
  market_id: number;
  symbol: string;
  market_type: string;
  supported_size_decimals?: number;
  supported_price_decimals?: number;
}

interface LighterOrderEntry {
  price: string;
  remaining_base_amount: string;
}

const PAIR_TO_BASE: Record<string, string> = {
  BTC: 'BTC',
  ETH: 'ETH',
  SOL: 'SOL',
  XAUT: 'XAUT',
};

export class LighterAdapter implements ExchangeAdapter {
  name = 'Lighter';
  private marketMeta: Map<string, LighterMarketMeta> = new Map();
  private metaLoaded = false;

  getTakerFeeBps(): number {
    return 0; // Lighter is zero-fee
  }

  getSymbol(pair: string): string | null {
    return PAIR_TO_BASE[pair] ?? null;
  }

  private async loadMeta(): Promise<void> {
    if (this.metaLoaded) return;
    try {
      const res = await fetch(`${BASE_URL}/orderBooks`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { order_books?: LighterOrderBook[] };
      const books: LighterOrderBook[] = data.order_books ?? [];
      for (const book of books) {
        if (book.market_type === 'perp') {
          const symbol = (book.symbol ?? '').toUpperCase();
          this.marketMeta.set(symbol, {
            market_id: book.market_id,
            symbol: book.symbol,
            market_type: book.market_type,
            size_decimals: book.supported_size_decimals ?? 4,
            price_decimals: book.supported_price_decimals ?? 2,
          });
        }
      }
      this.metaLoaded = true;
    } catch (err) {
      console.error(`[Lighter] Error loading market meta: ${(err as Error).message}`);
    }
  }

  async getSupportedPairs(): Promise<string[]> {
    await this.loadMeta();
    return Object.keys(PAIR_TO_BASE).filter(pair =>
      this.marketMeta.has(pair),
    );
  }

  async fetchOrderbook(pair: string, limit: number): Promise<Orderbook | null> {
    await this.loadMeta();
    const meta = this.marketMeta.get(pair);
    if (!meta) return null;

    try {
      const cappedLimit = Math.min(limit, 200);
      const url = `${BASE_URL}/orderBookOrders?market_id=${meta.market_id}&limit=${cappedLimit}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { asks?: LighterOrderEntry[]; bids?: LighterOrderEntry[] };

      const rawAsks: LighterOrderEntry[] = data.asks ?? [];
      const rawBids: LighterOrderEntry[] = data.bids ?? [];

      const asks: OrderbookEntry[] = rawAsks.map((o) => ({
        price: parseFloat(o.price),
        amount: parseFloat(o.remaining_base_amount),
      })).sort((a, b) => a.price - b.price);

      const bids: OrderbookEntry[] = rawBids.map((o) => ({
        price: parseFloat(o.price),
        amount: parseFloat(o.remaining_base_amount),
      })).sort((a, b) => b.price - a.price);

      return {
        exchange: this.name,
        symbol: `${pair}/USDC`,
        bids,
        asks,
        timestamp: Date.now(),
        midPrice: computeMidPrice(bids, asks),
      };
    } catch (err) {
      console.error(`[Lighter] Error fetching ${pair}: ${(err as Error).message}`);
      return null;
    }
  }

  async close(): Promise<void> {}
}
