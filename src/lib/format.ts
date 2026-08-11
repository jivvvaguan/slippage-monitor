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
   * One entry per configured band, in DEPTH_BANDS order. Entries are null when
   * the book could not be measured at all, which is distinct from a measured
   * band that fell short — see computeDepthBand.
   */
  depth_bands: (FormattedDepthBand | null)[];
}

export interface FormattedDepthBand {
  /** Band half-width as a percentage of mid, e.g. 0.3 or 0.5. */
  band_pct: number;
  /** Notional resting inside the band. A lower bound when *_complete is false. */
  bid_usd: number;
  ask_usd: number;
  /** False means the book was truncated inside the band — the figure is a floor. */
  bid_complete: boolean;
  ask_complete: boolean;
  /** How far the book actually spans from mid, as a percentage. */
  book_coverage_pct: number;
}

export function formatSlippageResult(
  result: SlippageResult,
  amount: number,
  depth: (DepthBand | null)[] = [],
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
    depth_bands: depth.map(band =>
      band
        ? {
            band_pct: Number((band.bandPct * 100).toFixed(3)),
            bid_usd: band.bidUSD,
            ask_usd: band.askUSD,
            bid_complete: band.bidComplete,
            ask_complete: band.askComplete,
            book_coverage_pct: Number((band.bookCoverage * 100).toFixed(3)),
          }
        : null,
    ),
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
