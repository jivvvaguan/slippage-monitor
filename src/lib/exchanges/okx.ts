import type { ExchangeAdapter, Orderbook, OrderbookEntry } from './types';
import { computeMidPrice } from './base';

const BASE_URL = 'https://www.okx.com';
/** books-full ceiling. */
const MAX_LEVELS = 5000;

const PAIR_INSTRUMENTS: Record<string, string> = {
  BTC: 'BTC-USDT-SWAP',
  ETH: 'ETH-USDT-SWAP',
  SOL: 'SOL-USDT-SWAP',
  // OKX lists no gold swap (neither XAUT nor PAXG), so GOLD is unsupported.
};

interface BooksFullResponse {
  code: string;
  msg?: string;
  data?: Array<{ bids: string[][]; asks: string[][]; ts: string }>;
}

/**
 * OKX via /market/books-full rather than ccxt's /market/books.
 *
 * books returns at most 400 levels, which spans only ±0.077% of mid on BTC —
 * nowhere near the ±0.5% depth band. books-full returns up to 5000 levels at
 * the same native tick, measured at ±0.914%, so it is strictly better for both
 * slippage and depth.
 *
 * Book sizes are quoted in contracts; ctVal converts to base currency and is
 * read once from /public/instruments.
 */
export class OkxAdapter implements ExchangeAdapter {
  name = 'OKX';
  private contractValues = new Map<string, number>();
  private instrumentsLoaded = false;

  getSymbol(pair: string): string | null {
    return PAIR_INSTRUMENTS[pair] ?? null;
  }

  async getSupportedPairs(): Promise<string[]> {
    return Object.keys(PAIR_INSTRUMENTS);
  }

  getTakerFeeBps(): number {
    return 5.0;
  }

  private async ensureInstruments(): Promise<void> {
    if (this.instrumentsLoaded) return;
    const res = await fetch(`${BASE_URL}/api/v5/public/instruments?instType=SWAP`);
    const json = (await res.json()) as { code: string; data?: Array<{ instId: string; ctVal: string }> };
    if (json.code !== '0' || !json.data) throw new Error(`instruments failed: ${json.code}`);
    for (const inst of json.data) {
      const ctVal = Number(inst.ctVal);
      if (ctVal > 0) this.contractValues.set(inst.instId, ctVal);
    }
    this.instrumentsLoaded = true;
  }

  async fetchOrderbook(pair: string, _limit: number): Promise<Orderbook | null> {
    const instId = this.getSymbol(pair);
    if (!instId) return null;

    try {
      await this.ensureInstruments();
      const ctVal = this.contractValues.get(instId);
      if (!ctVal) return null;

      // Always ask for the endpoint maximum rather than the generic depth
      // limit: the extra levels are free here and are exactly what carries
      // the book past the ±0.5% band (1000 levels reach ±0.19%, 5000 reach ±0.91%).
      const res = await fetch(`${BASE_URL}/api/v5/market/books-full?instId=${instId}&sz=${MAX_LEVELS}`);
      const json = (await res.json()) as BooksFullResponse;
      if (json.code !== '0' || !json.data?.[0]) return null;

      const level = ([price, size]: string[]): OrderbookEntry => ({
        price: Number(price),
        amount: Number(size) * ctVal,
      });
      const bids = json.data[0].bids.map(level);
      const asks = json.data[0].asks.map(level);
      if (bids.length === 0 || asks.length === 0) return null;

      return {
        exchange: this.name,
        symbol: instId,
        bids,
        asks,
        timestamp: Number(json.data[0].ts) || Date.now(),
        midPrice: computeMidPrice(bids, asks),
      };
    } catch (err) {
      console.error(`[${this.name}] Error fetching ${pair}: ${(err as Error).message}`);
      return null;
    }
  }

  async close(): Promise<void> {
    // Stateless HTTP client — nothing to tear down.
  }
}
