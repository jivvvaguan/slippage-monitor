import cron from 'node-cron';
import type { ExchangeAdapter } from './exchanges/types';
import { cache } from './cache';
import { APP_CONFIG, createExchangeAdapters } from './config';
import { pairRegistry, type PairInfo } from './pairs';
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
  __collectorAdapters?: ExchangeAdapter[];
  __collectorStarted?: boolean;
  __collectorInFlight?: Map<string, Promise<void>>;
};

function inFlight(): Map<string, Promise<void>> {
  if (!globalForCollector.__collectorInFlight) {
    globalForCollector.__collectorInFlight = new Map();
  }
  return globalForCollector.__collectorInFlight;
}

export function getAdapters(): ExchangeAdapter[] {
  if (!globalForCollector.__collectorAdapters) {
    globalForCollector.__collectorAdapters = createExchangeAdapters();
  }
  return globalForCollector.__collectorAdapters;
}

/** Fetch one pair everywhere, gated per venue so no single venue is flooded. */
async function collectPair(pair: PairInfo, depthLimit: number): Promise<void> {
  const adapters = getAdapters();

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
          cache.updateOrderbook(adapter.name, pair.id, ob, adapter.getTakerFeeBps(), depthBook);
        } catch (err) {
          // One venue failing must not take down the pair, nor the sweep.
          console.error(`[Collector] ${adapter.name}/${pair.id}: ${(err as Error).message}`);
        }
      }),
    ),
  );
}

async function collectTier(tier: 1 | 2): Promise<void> {
  await pairRegistry.ensureFresh();
  const pairs = pairRegistry.tier(tier);
  if (pairs.length === 0) return;

  const depthLimit = tier === 1 ? TIER1_DEPTH_LIMIT : TIER2_DEPTH_LIMIT;
  const started = Date.now();

  // Pairs run in sequence; the per-venue limiters provide the concurrency.
  // Firing all 83 at once would defeat those gates on the first venue call.
  for (const pair of pairs) {
    await collectPair(pair, depthLimit);
  }

  console.log(
    `[Collector] tier-${tier}: ${pairs.length} pairs in ${((Date.now() - started) / 1000).toFixed(1)}s`,
  );
}

/**
 * Refresh one pair now if its data is missing or stale. Backs the on-demand
 * half of the strategy: a long-tail pair someone actually opens gets current
 * data without putting every pair on the fast cadence.
 */
export async function ensurePairFresh(pairId: string): Promise<void> {
  const pair = pairRegistry.get(pairId);
  if (!pair) return;

  const ages = getAdapters().map(a => cache.getDataAge(a.name));
  const freshest = Math.min(...ages.map(a => (Number.isFinite(a) ? a : Infinity)));
  const hasData = cache.getOrderbook(getAdapters()[0]?.name ?? '', pair.id) !== null;
  if (hasData && freshest * 1000 < ON_DEMAND_STALE_MS) return;

  // Collapse concurrent requests for the same pair into one fetch.
  const pending = inFlight().get(pair.id);
  if (pending) return pending;

  const task = collectPair(pair, pair.tier === 1 ? TIER1_DEPTH_LIMIT : TIER2_DEPTH_LIMIT)
    .finally(() => inFlight().delete(pair.id));
  inFlight().set(pair.id, task);
  return task;
}

export function startCollector(): void {
  if (globalForCollector.__collectorStarted) return;
  globalForCollector.__collectorStarted = true;

  void (async () => {
    await pairRegistry.ensureFresh();

    // Live books only for tier-1 — see BinanceAdapter for why the long tail
    // must not open 83 simultaneous snapshots.
    const binance = getAdapters().find(a => a instanceof BinanceAdapter) as BinanceAdapter | undefined;
    await binance?.startLiveBooks(pairRegistry.tier(1).map(p => p.id));

    await collectTier(1);
    await collectTier(2);
  })().catch(err => console.error('[Collector] Initial sweep error:', err));

  cron.schedule('*/5 * * * *', () => {
    collectTier(1).catch(err => console.error('[Collector] tier-1 error:', err));
  });
  cron.schedule('*/20 * * * *', () => {
    collectTier(2).catch(err => console.error('[Collector] tier-2 error:', err));
  });

  console.log('[Collector] Started — tier-1 every 5 min, tier-2 every 20 min');
}
