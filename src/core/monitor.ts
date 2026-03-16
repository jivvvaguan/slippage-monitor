import type { Config, ExchangeAdapter, SlippageResult, MonitorSnapshot } from '../types.js';
import { fetchAllOrderbooks } from './orderbook.js';
import { calculateSlippage } from './slippage.js';
import { getCustomSizes } from '../output/web.js';

export type SnapshotCallback = (snapshot: MonitorSnapshot) => void;

/**
 * Run one monitoring cycle: fetch orderbooks and compute slippage for all combinations.
 */
export async function runOnce(
  adapters: ExchangeAdapter[],
  config: Config,
): Promise<MonitorSnapshot> {
  const orderbooks = await fetchAllOrderbooks(
    adapters,
    config.pairs,
    config.orderbookDepthLimit,
  );

  // Merge config sizes with any custom sizes from the web UI
  const allSizes = [...new Set([...config.orderSizesUSD, ...getCustomSizes()])].sort((a, b) => a - b);

  const results: SlippageResult[] = [];

  for (const adapter of adapters) {
    const exchangeObs = orderbooks.get(adapter.name);
    if (!exchangeObs) continue;

    for (const pair of config.pairs) {
      const ob = exchangeObs.get(pair);
      if (!ob) continue;

      for (const size of allSizes) {
        const result = calculateSlippage(
          ob,
          size,
          config.leverage,
          adapter.getTakerFeeBps(),
          'buy',
        );
        result.pair = pair;
        results.push(result);
      }
    }
  }

  return {
    timestamp: Date.now(),
    results,
  };
}

/**
 * Start the monitoring loop with configurable interval.
 */
export function startMonitorLoop(
  adapters: ExchangeAdapter[],
  config: Config,
  onSnapshot: SnapshotCallback,
): { stop: () => void } {
  let running = true;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const tick = async () => {
    if (!running) return;
    try {
      const snapshot = await runOnce(adapters, config);
      onSnapshot(snapshot);
    } catch (err) {
      console.error(`Monitor error: ${(err as Error).message}`);
    }
    if (running) {
      timeoutId = setTimeout(tick, config.refreshIntervalMs);
    }
  };

  // Start immediately
  tick();

  return {
    stop: () => {
      running = false;
      if (timeoutId) clearTimeout(timeoutId);
    },
  };
}
