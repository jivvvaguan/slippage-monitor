const PERP_SYMBOLS_URL =
  'https://mainnet-gw.sodex.dev/futures/fapi/market/v1/public/m/symbols';
/**
 * Spot lives on a separate service. Neither the public docs nor path guessing
 * found it; this was read off the trading UI's own network calls.
 */
const SPOT_TICKERS_URL = 'https://mainnet-gw.sodex.dev/api/v1/spot/markets/tickers';

/** SoDEX runs spot and perpetuals as two independent markets. */
export type MarketType = 'perp' | 'spot';
export const MARKET_TYPES: MarketType[] = ['perp', 'spot'];

export function isMarketType(value: string | null): value is MarketType {
  return value === 'perp' || value === 'spot';
}

/** How long a fetched universe is served before another refresh is attempted. */
const REFRESH_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Pairs kept on the fast refresh cadence. Everything else is long tail.
 * Intersected with the live universe, so an entry that SoDEX delists simply
 * stops appearing rather than producing a dead tier-1 slot.
 */
const TIER1_BASES = [
  'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'XAUT', 'HYPE', 'ASTER', 'NVDA',
];

/** Legacy pair ids that used to be hardcoded, so old links keep working. */
const ALIASES: Record<string, string> = {
  GOLD: 'XAUT',
};

export interface PairInfo {
  /** Canonical id used across the app and the API, e.g. BTC, NVDA, 1000PEPE. */
  id: string;
  market: MarketType;
  /** SoDEX symbol: BTC-USD for perps, vBTC_vUSDC for spot. */
  sodexSymbol: string;
  /**
   * Units of the underlying per quoted unit. SoDEX quotes 1000PEPE in
   * thousands, so this is 1000 there and the adapters normalise to per-unit
   * prices — otherwise a 1000PEPE mid price sits next to a PEPE mid price in
   * the same column and reads as a data error.
   */
  multiplier: number;
  tier: 1 | 2;
}

interface SodexSymbol {
  symbol: string;
  instType: string;
  baseAsset: string;
  futureType: string;
  state: string;
}

const globalForPairs = globalThis as unknown as { __pairRegistry?: PairRegistry };

class PairRegistry {
  private pairs: Record<MarketType, PairInfo[]> = { perp: [], spot: [] };
  private lastFetch: Record<MarketType, number> = { perp: 0, spot: 0 };
  private inFlight: Partial<Record<MarketType, Promise<void>>> = {};

  static getInstance(): PairRegistry {
    if (!globalForPairs.__pairRegistry) {
      globalForPairs.__pairRegistry = new PairRegistry();
    }
    return globalForPairs.__pairRegistry;
  }

  /** Everything known right now. Empty only before the first successful fetch. */
  all(market: MarketType): PairInfo[] {
    return this.pairs[market];
  }

  tier(market: MarketType, n: 1 | 2): PairInfo[] {
    return this.pairs[market].filter(p => p.tier === n);
  }

  get(market: MarketType, id: string): PairInfo | null {
    const canonical = ALIASES[id.toUpperCase()] ?? id.toUpperCase();
    return this.pairs[market].find(p => p.id === canonical) ?? null;
  }

  /** Fetch if the universe is stale. Concurrent callers share one request. */
  async ensureFresh(market: MarketType): Promise<void> {
    if (Date.now() - this.lastFetch[market] < REFRESH_INTERVAL_MS && this.pairs[market].length > 0) {
      return;
    }
    const pending = this.inFlight[market];
    if (pending) return pending;

    const task = this.refresh(market).finally(() => {
      delete this.inFlight[market];
    });
    this.inFlight[market] = task;
    return task;
  }

  async ensureAllFresh(): Promise<void> {
    await Promise.all(MARKET_TYPES.map(m => this.ensureFresh(m)));
  }

  private async refresh(market: MarketType): Promise<void> {
    try {
      const next = market === 'perp' ? await fetchPerpPairs() : await fetchSpotPairs();

      // A momentarily empty listing must not wipe a working universe.
      if (next.length === 0) {
        console.error(`[Pairs] ${market} listing came back empty — keeping previous set`);
        return;
      }

      this.pairs[market] = next;
      this.lastFetch[market] = Date.now();
      console.log(
        `[Pairs] ${market}: ${next.length} markets (${next.filter(p => p.tier === 1).length} tier-1)`,
      );
    } catch (err) {
      // Serve the previous universe rather than collapsing to nothing.
      console.error(
        `[Pairs] ${market} refresh failed, serving ${this.pairs[market].length} cached: ${(err as Error).message}`,
      );
    }
  }
}

async function fetchPerpPairs(): Promise<PairInfo[]> {
  const json = (await (await fetch(PERP_SYMBOLS_URL)).json()) as { code: number; data?: SodexSymbol[] };
  if (json.code !== 0 || !Array.isArray(json.data)) throw new Error(`code ${json.code}`);
  return json.data
    .filter(s => s.futureType === 'PERPETUAL' && s.state === 'online')
    .map(s => toPairInfo('perp', s.baseAsset, s.symbol));
}

async function fetchSpotPairs(): Promise<PairInfo[]> {
  const json = (await (await fetch(SPOT_TICKERS_URL)).json()) as {
    code: number;
    data?: Array<{ symbol: string }>;
  };
  if (json.code !== 0 || !Array.isArray(json.data)) throw new Error(`code ${json.code}`);
  return json.data.map(t => toPairInfo('spot', spotBaseOf(t.symbol), t.symbol));
}

/**
 * "vBTC_vUSDC" -> "BTC". SoDEX prefixes bridged assets with v, and its own
 * token appears as the wrapped "WSOSO_vUSDC".
 */
export function spotBaseOf(symbol: string): string {
  const left = symbol.split('_')[0];
  if (left.startsWith('v')) return left.slice(1).toUpperCase();
  if (left.startsWith('W')) return left.slice(1).toUpperCase();
  return left.toUpperCase();
}

function toPairInfo(market: MarketType, baseAsset: string, sodexSymbol: string): PairInfo {
  const id = baseAsset.toUpperCase();
  const { multiplier } = splitMultiplier(id);
  return {
    id,
    market,
    sodexSymbol,
    multiplier,
    tier: TIER1_BASES.includes(id) ? 1 : 2,
  };
}

/**
 * "1000PEPE" -> { base: "PEPE", multiplier: 1000 }, "kBONK" -> 1000.
 * Venues disagree on this prefix (SoDEX and Binance use 1000X, Hyperliquid
 * uses kX, Bitget and OKX quote the bare asset), so the canonical base is the
 * bare asset and each adapter reports the multiplier it quotes in.
 */
export function splitMultiplier(symbolOrBase: string): { base: string; multiplier: number } {
  const upper = symbolOrBase.toUpperCase();
  const numeric = /^(1000000|100000|10000|1000)(.+)$/.exec(upper);
  if (numeric) return { base: numeric[2], multiplier: Number(numeric[1]) };
  if (/^K[A-Z]{2,}$/.test(upper)) return { base: upper.slice(1), multiplier: 1000 };
  return { base: upper, multiplier: 1 };
}

export const pairRegistry = PairRegistry.getInstance();
