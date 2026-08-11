import type { SlippageResult } from './exchanges/types';

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
}

export function formatSlippageResult(result: SlippageResult, amount: number): FormattedResult {
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
  };
}

export function sortByTotalCost(results: FormattedResult[]): FormattedResult[] {
  return results.sort((a, b) => a.total_cost_bps - b.total_cost_bps);
}

export function validateSide(value: string | null): 'buy' | 'sell' {
  if (value === 'sell') return 'sell';
  return 'buy';
}
