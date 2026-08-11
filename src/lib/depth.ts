import type { Orderbook } from './exchanges/types';

/** Half-width of the depth band, as a fraction of mid price. 0.005 = ±0.5%. */
export const DEFAULT_DEPTH_BAND = 0.005;

export interface DepthBand {
  /** Notional USD resting on the bid side within the band. */
  bidUSD: number;
  /** Notional USD resting on the ask side within the band. */
  askUSD: number;
  /**
   * True when the book extends past the band edge, so the whole band was
   * observed. False means the book was truncated inside the band and the
   * notional above is only a lower bound.
   */
  bidComplete: boolean;
  askComplete: boolean;
  /**
   * How far the book actually spans from mid, as a fraction — the worse
   * (narrower) of the two sides. Lets the UI say "book only covers ±0.09%"
   * instead of a bare "incomplete", which is not actionable.
   */
  bookCoverage: number;
}

/**
 * Sum the notional resting within ±bandPct of mid, and report whether the
 * book reached far enough to observe the full band.
 *
 * Returns null when the book cannot be measured at all (no mid, or a side
 * with no levels). That is deliberately distinct from a measured-but-truncated
 * band: reporting 0-and-incomplete for missing data would read downstream as
 * "at least $0 resting", which is a truncation claim, not an absence claim.
 *
 * Depth is a property of the book alone — it does not depend on order size,
 * leverage or side — so this is deliberately kept out of calculateSlippage,
 * which would otherwise recompute it once per preset amount.
 */
export function computeDepthBand(
  orderbook: Orderbook,
  bandPct: number = DEFAULT_DEPTH_BAND,
): DepthBand | null {
  const { midPrice, bids, asks } = orderbook;
  if (!(midPrice > 0) || bids.length === 0 || asks.length === 0) return null;

  const floor = midPrice * (1 - bandPct);
  const ceiling = midPrice * (1 + bandPct);

  let bidUSD = 0;
  for (const level of bids) {
    if (level.price < floor) break; // bids are sorted descending
    bidUSD += level.price * level.amount;
  }

  let askUSD = 0;
  for (const level of asks) {
    if (level.price > ceiling) break; // asks are sorted ascending
    askUSD += level.price * level.amount;
  }

  const lowestBid = bids[bids.length - 1].price;
  const highestAsk = asks[asks.length - 1].price;

  return {
    bidUSD: Number(bidUSD.toFixed(2)),
    askUSD: Number(askUSD.toFixed(2)),
    bidComplete: lowestBid < floor,
    askComplete: highestAsk > ceiling,
    bookCoverage: Number(
      Math.min((midPrice - lowestBid) / midPrice, (highestAsk - midPrice) / midPrice).toFixed(6),
    ),
  };
}
