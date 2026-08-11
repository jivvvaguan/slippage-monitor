import type { SlippageResult } from './exchanges/types';
import type { DepthBand } from './depth';

export interface FormattedResult {
  exchange: string;
  mid_price: number;
  avg_fill_price: number;
  slippage_bps: number;
  fee_bps: number;
  total_cost_bps: number;
  cost_usd: number;
  cost_pct_of_principal: number;
  sufficient_liquidity: boolean;
  /**
   * Notional resting within ±0.5% of mid, or null when the book could not be
   * measured. A lower bound when the matching *_complete flag is false.
   */
  depth_bid_usd: number | null;
  depth_ask_usd: number | null;
  /** False means the book was truncated inside the band — the figure is a floor. */
  depth_bid_complete: boolean | null;
  depth_ask_complete: boolean | null;
  /** How far the book actually spans from mid, as a percentage. */
  depth_book_coverage_pct: number | null;
}

export function formatSlippageResult(
  result: SlippageResult,
  amount: number,
  depth?: DepthBand | null,
): FormattedResult {
  return {
    exchange: result.exchange,
    mid_price: result.midPrice,
    avg_fill_price: result.avgFillPrice,
    slippage_bps: result.slippageBps,
    fee_bps: result.feeBps,
    total_cost_bps: result.totalCostBps,
    cost_usd: Number((result.totalCostBps / 10000 * amount).toFixed(2)),
    cost_pct_of_principal: result.costPctOfPrincipal,
    sufficient_liquidity: !result.insufficientLiquidity,
    depth_bid_usd: depth ? depth.bidUSD : null,
    depth_ask_usd: depth ? depth.askUSD : null,
    depth_bid_complete: depth ? depth.bidComplete : null,
    depth_ask_complete: depth ? depth.askComplete : null,
    depth_book_coverage_pct: depth ? Number((depth.bookCoverage * 100).toFixed(3)) : null,
  };
}

export function sortByTotalCost(results: FormattedResult[]): FormattedResult[] {
  return results.sort((a, b) => a.total_cost_bps - b.total_cost_bps);
}

export function validateSide(value: string | null): 'buy' | 'sell' {
  if (value === 'sell') return 'sell';
  return 'buy';
}

/** Compact USD for table cells: 1234567 -> "$1.23M". */
export function formatCompactUSD(value: number): string {
  if (!(value > 0)) return '—';
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}
