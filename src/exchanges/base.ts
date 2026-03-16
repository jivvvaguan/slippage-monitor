import type { ExchangeAdapter, Orderbook, OrderbookEntry } from '../types.js';

/**
 * Normalize raw [price, amount] arrays into OrderbookEntry arrays.
 */
export function normalizeOrderbook(
  raw: [number, number][],
): OrderbookEntry[] {
  return raw.map(([price, amount]) => ({ price, amount }));
}

/**
 * Compute mid price from best bid and best ask.
 */
export function computeMidPrice(
  bids: OrderbookEntry[],
  asks: OrderbookEntry[],
): number {
  if (bids.length === 0 || asks.length === 0) return 0;
  return (bids[0].price + asks[0].price) / 2;
}

export type { ExchangeAdapter, Orderbook };
