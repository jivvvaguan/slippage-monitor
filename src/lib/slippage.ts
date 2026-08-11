import type { Orderbook, SlippageResult } from './exchanges/types';

/**
 * Calculate slippage for a given orderbook, notional amount, leverage, fee, and side.
 */
export function calculateSlippage(
  orderbook: Orderbook,
  notionalUSD: number,
  leverage: number,
  feeBps: number,
  side: 'buy' | 'sell',
): SlippageResult {
  const midPrice = orderbook.midPrice;
  const principalUSD = notionalUSD / leverage;
  const levels = side === 'buy' ? orderbook.asks : orderbook.bids;

  let remainingUSD = notionalUSD;
  let totalQty = 0;
  let totalCost = 0;
  let levelsUsed = 0;
  let insufficientLiquidity = false;

  for (const level of levels) {
    if (remainingUSD <= 0) break;

    const levelValueUSD = level.price * level.amount;
    const fillUSD = Math.min(remainingUSD, levelValueUSD);
    const fillQty = fillUSD / level.price;

    totalQty += fillQty;
    totalCost += fillUSD;
    remainingUSD -= fillUSD;
    levelsUsed++;
  }

  if (remainingUSD > 0) {
    insufficientLiquidity = true;
  }

  const avgFillPrice = totalQty > 0 ? totalCost / totalQty : midPrice;

  // Slippage in basis points: how far avg fill deviates from mid
  let slippageBps: number;
  if (side === 'buy') {
    slippageBps = midPrice > 0 ? ((avgFillPrice - midPrice) / midPrice) * 10000 : 0;
  } else {
    slippageBps = midPrice > 0 ? ((midPrice - avgFillPrice) / midPrice) * 10000 : 0;
  }

  // Ensure non-negative (in edge cases with empty books)
  slippageBps = Math.max(0, Number(slippageBps.toFixed(2)));

  const totalCostBps = Number((slippageBps + feeBps).toFixed(2));
  const costPctOfPrincipal = Number(((totalCostBps / 10000) * leverage * 100).toFixed(3));

  return {
    exchange: orderbook.exchange,
    pair: '',
    symbol: orderbook.symbol,
    side,
    notionalUSD,
    leverage,
    principalUSD,
    avgFillPrice: Number(avgFillPrice.toFixed(6)),
    midPrice,
    slippageBps,
    feeBps,
    totalCostBps,
    costPctOfPrincipal,
    filledQty: Number(totalQty.toFixed(8)),
    orderbookDepthUsed: levelsUsed,
    insufficientLiquidity,
  };
}
