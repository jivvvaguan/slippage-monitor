import type { ExchangeAdapter, Orderbook, OrderbookEntry } from './types';
import { computeMidPrice } from './base';
import { rescaleOrderbook } from './normalize';
import { splitMultiplier } from '../pairs';

const BASE_URL = 'https://www.okx.com';
/** books-full ceiling. */
const MAX_LEVELS = 5000;

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
  /** canonical base -> instId */
  private instruments = new Map<string, string>();
  private instrumentsLoaded = false;

  getSymbol(pair: string): string | null {
    return this.instruments.get(splitMultiplier(pair).base) ?? null;
  }

  async getSupportedPairs(): Promise<string[]> {
    await this.ensureInstruments();
    return [...this.instruments.keys()];
  }

  getTakerFeeBps(): number {
    return 5.0;
  }

  private async ensureInstruments(): Promise<void> {
    if (this.instrumentsLoaded) return;
    const res = await fetch(`${BASE_URL}/api/v5/public/instruments?instType=SWAP`);
    const json = (await res.json()) as {
      code: string;
      data?: Array<{ instId: string; ctVal: string; state: string; settleCcy: string }>;
    };
    if (json.code !== '0' || !json.data) throw new Error(`instruments failed: ${json.code}`);
    for (const inst of json.data) {
      const ctVal = Number(inst.ctVal);
      if (!(ctVal > 0) || inst.state !== 'live') continue;
      this.contractValues.set(inst.instId, ctVal);
      // OKX quotes the bare asset, so instId's base is already canonical.
      const base = inst.instId.split('-')[0].toUpperCase();
      const existing = this.instruments.get(base);
      // Prefer USDT settlement when a coin has several swaps.
      if (!existing || (inst.settleCcy === 'USDT' && !existing.includes('-USDT-'))) {
        this.instruments.set(base, inst.instId);
      }
    }
    this.instrumentsLoaded = true;
  }

  async fetchOrderbook(pair: string, _limit: number): Promise<Orderbook | null> {
    try {
      await this.ensureInstruments();
      const instId = this.getSymbol(pair);
      if (!instId) return null;
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

      // OKX quotes whatever its own instId says, which is usually the bare
      // asset — normalising must use that, not the pair id's prefix.
      const { multiplier } = splitMultiplier(instId.split('-')[0]);
      return rescaleOrderbook(
        {
          exchange: this.name,
          symbol: instId,
          bids,
          asks,
          timestamp: Number(json.data[0].ts) || Date.now(),
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
    // Stateless HTTP client — nothing to tear down.
  }
}
