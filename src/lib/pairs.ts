const SYMBOLS_URL =
  'https://mainnet-gw.sodex.dev/futures/fapi/market/v1/public/m/symbols';

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
  /** SoDEX contract symbol, e.g. BTC-USD. */
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
  private pairs: PairInfo[] = [];
  private lastFetch = 0;
  private inFlight: Promise<void> | null = null;

  static getInstance(): PairRegistry {
    if (!globalForPairs.__pairRegistry) {
      globalForPairs.__pairRegistry = new PairRegistry();
    }
    return globalForPairs.__pairRegistry;
  }

  /** Everything known right now. Empty only before the first successful fetch. */
  all(): PairInfo[] {
    return this.pairs;
  }

  tier(n: 1 | 2): PairInfo[] {
    return this.pairs.filter(p => p.tier === n);
  }

  get(id: string): PairInfo | null {
    const canonical = ALIASES[id.toUpperCase()] ?? id.toUpperCase();
    return this.pairs.find(p => p.id === canonical) ?? null;
  }

  /** Fetch if the universe is stale. Concurrent callers share one request. */
  async ensureFresh(): Promise<void> {
    if (Date.now() - this.lastFetch < REFRESH_INTERVAL_MS && this.pairs.length > 0) return;
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.refresh().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async refresh(): Promise<void> {
    try {
      const res = await fetch(SYMBOLS_URL);
      const json = (await res.json()) as { code: number; data?: SodexSymbol[] };
      if (json.code !== 0 || !Array.isArray(json.data)) {
        throw new Error(`code ${json.code}`);
      }

      const next = json.data
        .filter(s => s.futureType === 'PERPETUAL' && s.state === 'online')
        .map(toPairInfo);

      // A momentarily empty listing must not wipe a working universe.
      if (next.length === 0) {
        console.error('[Pairs] Listing returned no online perpetuals — keeping previous set');
        return;
      }

      this.pairs = next;
      this.lastFetch = Date.now();
      console.log(
        `[Pairs] ${next.length} perpetuals (${next.filter(p => p.tier === 1).length} tier-1)`,
      );
    } catch (err) {
      // Serve the previous universe rather than collapsing to nothing.
      console.error(`[Pairs] Refresh failed, serving ${this.pairs.length} cached: ${(err as Error).message}`);
    }
  }
}

function toPairInfo(s: SodexSymbol): PairInfo {
  const id = s.baseAsset.toUpperCase();
  const { multiplier } = splitMultiplier(id);
  return {
    id,
    sodexSymbol: s.symbol,
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
