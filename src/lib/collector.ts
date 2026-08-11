import cron from 'node-cron';
import type { ExchangeAdapter } from './exchanges/types';
import { cache } from './cache';
import { APP_CONFIG, createExchangeAdapters } from './config';
import { pairRegistry, MARKET_TYPES, type PairInfo, type MarketType } from './pairs';
import { limiterFor } from './limiter';
import { rescaleOrderbook } from './exchanges/normalize';
import { BinanceAdapter } from './exchanges/binance';

/**
 * Tier-1 keeps the original cadence and full depth. Tier-2 is the long tail —
 * 73 of 83 pairs — refreshed less often and with fewer levels, because a full
 * sweep of every pair on every venue is ~600 requests and would sit right on
 * top of several venues' rate limits.
 */
const TIER1_DEPTH_LIMIT = APP_CONFIG.orderbookDepthLimit;
const TIER2_DEPTH_LIMIT = 100;
/** A tier-2 pair older than this is refreshed on demand when someone opens it. */
const ON_DEMAND_STALE_MS = 5 * 60 * 1000;

const globalForCollector = globalThis as unknown as {
  __collectorAdapters?: Partial<Record<MarketType, ExchangeAdapter[]>>;
  __collectorStarted?: boolean;
  __collectorInFlight?: Map<string, Promise<void>>;
};

function inFlight(): Map<string, Promise<void>> {
  if (!globalForCollector.__collectorInFlight) {
    globalForCollector.__collectorInFlight = new Map();
  }
  return globalForCollector.__collectorInFlight;
}

export function getAdapters(market: MarketType = 'perp'): ExchangeAdapter[] {
  if (!globalForCollector.__collectorAdapters) globalForCollector.__collectorAdapters = {};
  const sets = globalForCollector.__collectorAdapters;
  if (!sets[market]) sets[market] = createExchangeAdapters(market);
  return sets[market]!;
}

/** Fetch one pair everywhere, gated per venue so no single venue is flooded. */
async function collectPair(pair: PairInfo, depthLimit: number): Promise<void> {
  const adapters = getAdapters(pair.market);

  await Promise.all(
    adapters.map(adapter =>
      limiterFor(adapter.name).run(async () => {
        try {
          const raw = await adapter.fetchOrderbook(pair.id, depthLimit);
          if (!raw) return; // venue does not list this pair — not an error
          const rawDepth = adapter.fetchDepthOrderbook
            ? await adapter.fetchDepthOrderbook(pair.id, depthLimit).catch(() => null)
            : null;

          // Adapters report per-unit prices. Restore the pair's own quoting
          // unit so a 1000PEPE row reads in thousands on every venue.
          const ob = rescaleOrderbook(raw, pair.multiplier);
          const depthBook = rawDepth ? rescaleOrderbook(rawDepth, pair.multiplier) : null;
          cache.updateOrderbook(pair.market, adapter.name, pair.id, ob, adapter.getTakerFeeBps(pair.id), depthBook);
        } catch (err) {
          // One venue failing must not take down the pair, nor the sweep.
          console.error(`[Collector] ${pair.market}/${adapter.name}/${pair.id}: ${(err as Error).message}`);
        }
      }),
    ),
  );
}

async function collectTier(market: MarketType, tier: 1 | 2): Promise<void> {
  await pairRegistry.ensureFresh(market);
  const pairs = pairRegistry.tier(market, tier);
  if (pairs.length === 0) return;

  const depthLimit = tier === 1 ? TIER1_DEPTH_LIMIT : TIER2_DEPTH_LIMIT;
  const started = Date.now();

  // Pairs run in sequence; the per-venue limiters provide the concurrency.
  // Firing all 83 at once would defeat those gates on the first venue call.
  for (const pair of pairs) {
    await collectPair(pair, depthLimit);
  }

  console.log(
    `[Collector] ${market} tier-${tier}: ${pairs.length} pairs in ${((Date.now() - started) / 1000).toFixed(1)}s`,
  );
}

/**
 * Refresh one pair now if its data is missing or stale. Backs the on-demand
 * half of the strategy: a long-tail pair someone actually opens gets current
 * data without putting every pair on the fast cadence.
 */
export async function ensurePairFresh(market: MarketType, pairId: string): Promise<void> {
  const pair = pairRegistry.get(market, pairId);
  if (!pair) return;

  // Freshness must come from THIS pair's book. getDataAge reports the venue's
  // last write of any pair, and the tier-1 cron touches every venue every 5
  // minutes, so a 19-minute-old tier-2 pair would always look fresh and the
  // on-demand refresh would never fire.
  const adapters = getAdapters(market);
  const books = adapters
    .map(a => cache.getOrderbook(market, a.name, pair.id))
    .filter((ob): ob is NonNullable<typeof ob> => ob !== null);
  if (books.length > 0) {
    const newest = Math.max(...books.map(ob => ob.timestamp));
    if (Date.now() - newest < ON_DEMAND_STALE_MS) return;
  }

  // Collapse concurrent requests for the same pair into one fetch.
  const key = `${market}:${pair.id}`;
  const pending = inFlight().get(key);
  if (pending) return pending;

  const task = collectPair(pair, pair.tier === 1 ? TIER1_DEPTH_LIMIT : TIER2_DEPTH_LIMIT)
    .finally(() => inFlight().delete(key));
  inFlight().set(key, task);
  return task;
}

export function startCollector(): void {
  if (globalForCollector.__collectorStarted) return;
  globalForCollector.__collectorStarted = true;

  void (async () => {
    await pairRegistry.ensureAllFresh();

    // Live books only for tier-1 — see BinanceAdapter for why the long tail
    // must not open 83 simultaneous snapshots.
    const binance = getAdapters('perp').find(a => a instanceof BinanceAdapter) as BinanceAdapter | undefined;
    await binance?.startLiveBooks(pairRegistry.tier('perp', 1).map(p => p.id));

    for (const market of MARKET_TYPES) {
      await collectTier(market, 1);
      await collectTier(market, 2);
    }
  })().catch(err => console.error('[Collector] Initial sweep error:', err));

  cron.schedule('*/5 * * * *', () => {
    for (const market of MARKET_TYPES) {
      collectTier(market, 1).catch(err => console.error(`[Collector] ${market} tier-1 error:`, err));
    }
  });
  cron.schedule('*/20 * * * *', () => {
    for (const market of MARKET_TYPES) {
      collectTier(market, 2).catch(err => console.error(`[Collector] ${market} tier-2 error:`, err));
    }
  });

  console.log('[Collector] Started — spot and perp, tier-1 every 5 min, tier-2 every 20 min');
}
