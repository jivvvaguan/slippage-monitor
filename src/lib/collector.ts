import cron from 'node-cron';
import type { ExchangeAdapter } from './exchanges/types';
import { cache } from './cache';
import { APP_CONFIG, createExchangeAdapters } from './config';

const globalForCollector = globalThis as unknown as {
  __collectorAdapters?: ExchangeAdapter[];
  __collectorStarted?: boolean;
};

async function collectOnce(): Promise<void> {
  if (!globalForCollector.__collectorAdapters) {
    globalForCollector.__collectorAdapters = createExchangeAdapters();
  }
  const adapters = globalForCollector.__collectorAdapters;

  const tasks: Promise<void>[] = [];

  for (const adapter of adapters) {
    for (const pair of APP_CONFIG.pairs) {
      tasks.push(
        adapter.fetchOrderbook(pair, APP_CONFIG.orderbookDepthLimit)
          .then(ob => {
            if (ob) {
              cache.updateOrderbook(adapter.name, pair, ob, adapter.getTakerFeeBps());
            }
          })
          .catch(err => {
            console.error(`[Collector] ${adapter.name}/${pair}: ${(err as Error).message}`);
          })
      );
    }
  }

  await Promise.all(tasks);
  console.log(`[Collector] Updated at ${new Date().toISOString()}, exchanges: ${cache.getAllExchanges().join(', ')}`);
}

export function startCollector(): void {
  if (globalForCollector.__collectorStarted) return;
  globalForCollector.__collectorStarted = true;

  // Run immediately on first call
  collectOnce().catch(err => {
    console.error('[Collector] Initial fetch error:', err);
  });

  // Schedule every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    collectOnce().catch(err => {
      console.error('[Collector] Scheduled fetch error:', err);
    });
  });

  console.log('[Collector] Started — refreshing every 5 minutes');
}

export function getAdapters(): ExchangeAdapter[] {
  if (!globalForCollector.__collectorAdapters) {
    globalForCollector.__collectorAdapters = createExchangeAdapters();
  }
  return globalForCollector.__collectorAdapters;
}
