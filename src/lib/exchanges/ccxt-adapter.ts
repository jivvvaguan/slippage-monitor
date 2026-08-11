import ccxt from 'ccxt';
import type { ExchangeAdapter, Orderbook } from './types';
import { normalizeOrderbook, computeMidPrice } from './base';
import { rescaleOrderbook, convertQuoteToUsd } from './normalize';
import { splitMultiplier, type MarketType } from '../pairs';

export interface CcxtAdapterConfig {
  exchangeId: string;
  name: string;
  /** Perp fee, in bps. Ignored for spot, which reads the venue's own taker. */
  takerFeeBps: number;
  market?: MarketType;
  ccxtOptions?: Record<string, any>;
}

/**
 * Quotes that are dollars for pricing purposes. Used only to anchor an asset's
 * USD price; the venue's chosen pair may be quoted in anything.
 */
const USD_QUOTES = new Set(['USDT', 'USDC', 'USD', 'BUSD', 'FDUSD', 'DAI', 'TUSD', 'USD1']);

/** Fallback ordering when a venue's tickers are unavailable. */
const FALLBACK_QUOTE_PREFERENCE = ['USDT', 'USDC', 'USD'];

export class CcxtAdapter implements ExchangeAdapter {
  name: string;
  private exchange: any;
  private marketsLoaded = false;
  /** canonical base -> { symbol, multiplier } */
  private resolved = new Map<
    string,
    { symbol: string; multiplier: number; takerBps: number; quoteUsd: number }
  >();
  private takerFeeBps: number;
  private market: MarketType;

  constructor(config: CcxtAdapterConfig) {
    this.name = config.name;
    this.takerFeeBps = config.takerFeeBps;
    this.market = config.market ?? 'perp';

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

    const isSpot = this.market === 'spot';
    const candidates = (Object.values(this.exchange.markets) as any[]).filter(
      m => m.active && (isSpot ? m.spot : m.swap),
    );

    // Pick each asset's most liquid pair on this venue, whatever it is quoted
    // in — restricting to USDT/USDC would skip a venue's real book. Ranking
    // needs USD-normalised volume: raw quoteVolume is denominated in the quote,
    // so BTC/IDR reads as 4x BTC/USDT until the rupiah is divided out.
    let tickers: Record<string, any> = {};
    try {
      tickers = await this.exchange.fetchTickers();
    } catch {
      // Fall back to the fixed preference below.
    }
    const haveTickers = Object.keys(tickers).length > 0;

    // An asset's USD price, taken from any dollar-quoted pair it trades in.
    const usdPrice = new Map<string, number>();
    for (const m of candidates) {
      if (!USD_QUOTES.has(m.quote)) continue;
      const last = tickers[m.symbol]?.last;
      if (typeof last === 'number' && last > 0) usdPrice.set(m.base, last);
    }

    // Scores are tiered so a weaker signal never outranks a stronger one, and
    // a market that cannot be scored at all still competes at the bottom
    // rather than vanishing. Bybit's ccxt spot tickers carry no baseVolume, and
    // dropping unscoreable markets removed that venue from the comparison
    // entirely.
    const best = new Map<string, { m: any; tier: number; score: number }>();
    for (const m of candidates) {
      const { base } = splitMultiplier(m.base);
      const ref = usdPrice.get(m.base);
      const ticker = tickers[m.symbol];
      const quote = isSpot ? m.quote : (m.settle ?? m.quote);

      let tier: number;
      let score: number;
      if (haveTickers && ref !== undefined && typeof ticker?.baseVolume === 'number') {
        // Base volume is in the asset itself, so one USD price ranks every
        // pair of that asset regardless of what each is quoted in.
        tier = 3;
        score = ticker.baseVolume * ref;
      } else if (typeof ticker?.quoteVolume === 'number' && USD_QUOTES.has(quote)) {
        tier = 2;
        score = ticker.quoteVolume;
      } else {
        const rank = FALLBACK_QUOTE_PREFERENCE.indexOf(quote);
        tier = 1;
        score = rank === -1 ? -Infinity : -rank;
      }
      if (score === -Infinity) continue;

      const current = best.get(base);
      if (!current || tier > current.tier || (tier === current.tier && score > current.score)) {
        best.set(base, { m, tier, score });
      }
    }

    for (const [base, { m }] of best) {
      const { multiplier } = splitMultiplier(m.base);
      // Spot taker fees vary widely by venue (OKX 15 bps, MEXC 0), so read the
      // venue's own rate rather than carrying one number for the whole
      // exchange the way perps do.
      const takerBps = isSpot && typeof m.taker === 'number'
        ? m.taker * 10000
        : this.takerFeeBps;

      // Restate the book in USD. Derived from the asset's own prices rather
      // than an FX feed: usdPrice / pairPrice is exactly the quote's rate.
      let quoteUsd = 1;
      if (!USD_QUOTES.has(m.quote)) {
        const ref = usdPrice.get(m.base);
        const pairPrice = tickers[m.symbol]?.last;
        if (ref && typeof pairPrice === 'number' && pairPrice > 0) quoteUsd = ref / pairPrice;
      }

      this.resolved.set(base, { symbol: m.symbol, multiplier, takerBps, quoteUsd });
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

  getTakerFeeBps(pair?: string): number {
    if (pair) {
      const entry = this.resolved.get(splitMultiplier(pair).base);
      if (entry) return entry.takerBps;
    }
    return this.takerFeeBps;
  }

  async fetchOrderbook(pair: string, limit: number): Promise<Orderbook | null> {
    await this.ensureMarkets();
    const entry = this.resolved.get(splitMultiplier(pair).base);
    if (!entry) return null;
    const { symbol, multiplier, quoteUsd } = entry;

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

      // Report per-unit USD prices; the collector rescales to the pair's own
      // quoting unit so every venue lines up in the same column.
      const usdBook = convertQuoteToUsd(
        {
          exchange: this.name,
          symbol,
          bids,
          asks,
          timestamp: ob.timestamp ?? Date.now(),
          midPrice: computeMidPrice(bids, asks),
        },
        quoteUsd,
      );
      return rescaleOrderbook(usdBook, 1 / multiplier);
    } catch (err) {
      console.error(`[${this.name}] Error fetching ${pair}: ${(err as Error).message}`);
      return null;
    }
  }

  async close(): Promise<void> {
    await this.exchange.close();
  }
}
