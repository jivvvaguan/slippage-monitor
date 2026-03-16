import type { ExchangeAdapter, Orderbook } from '../types.js';

/**
 * Fetch orderbooks for all pairs across all exchanges in parallel.
 * Returns a map: exchange -> pair -> Orderbook | null
 */
export async function fetchAllOrderbooks(
  adapters: ExchangeAdapter[],
  pairs: string[],
  depthLimit: number,
): Promise<Map<string, Map<string, Orderbook | null>>> {
  const results = new Map<string, Map<string, Orderbook | null>>();

  const tasks: Promise<void>[] = [];

  for (const adapter of adapters) {
    const exchangeMap = new Map<string, Orderbook | null>();
    results.set(adapter.name, exchangeMap);

    for (const pair of pairs) {
      tasks.push(
        adapter.fetchOrderbook(pair, depthLimit).then(ob => {
          exchangeMap.set(pair, ob);
        }).catch(err => {
          console.error(`[${adapter.name}] Failed to fetch ${pair}: ${(err as Error).message}`);
          exchangeMap.set(pair, null);
        }),
      );
    }
  }

  await Promise.all(tasks);
  return results;
}
