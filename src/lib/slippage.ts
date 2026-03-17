import type { Orderbook, OrderbookEntry, SlippageResult } from './exchanges/types';

/**
 * Simulate a market order by walking the orderbook.
 * For a BUY: walk asks (ascending). For a SELL: walk bids (descending).
 */
export function calculateSlippage(
  orderbook: Orderbook,
  notionalUSD: number,
  leverage: number,
  feeBps: number,
  side: 'buy' | 'sell' = 'buy',
): SlippageResult {
  const entries: OrderbookEntry[] = side === 'buy' ? orderbook.asks : orderbook.bids;
  const midPrice = orderbook.midPrice;

  if (midPrice === 0 || entries.length === 0) {
    return makeResult(orderbook, side, notionalUSD, leverage, feeBps, {
      avgFillPrice: 0,
      filledQty: 0,
      levelsUsed: 0,
      insufficientLiquidity: true,
    });
  }

  let remainingNotional = notionalUSD;
  let totalQty = 0;
  let totalCost = 0;
  let levelsUsed = 0;

  for (const entry of entries) {
    if (remainingNotional <= 0) break;

    const levelNotional = entry.price * entry.amount;
    const fillNotional = Math.min(remainingNotional, levelNotional);
    const fillQty = fillNotional / entry.price;

    totalCost += fillNotional;
    totalQty += fillQty;
    remainingNotional -= fillNotional;
    levelsUsed++;
  }

  const insufficientLiquidity = remainingNotional > 0;
  const avgFillPrice = totalQty > 0 ? totalCost / totalQty : 0;

  return makeResult(orderbook, side, notionalUSD, leverage, feeBps, {
    avgFillPrice,
    filledQty: totalQty,
    levelsUsed,
    insufficientLiquidity,
  });
}

interface FillResult {
  avgFillPrice: number;
  filledQty: number;
  levelsUsed: number;
  insufficientLiquidity: boolean;
}

function makeResult(
  orderbook: Orderbook,
  side: 'buy' | 'sell',
  notionalUSD: number,
  leverage: number,
  feeBps: number,
  fill: FillResult,
): SlippageResult {
  const midPrice = orderbook.midPrice;

  // Slippage in bps: how much worse the avg fill is vs mid price
  let slippageBps = 0;
  if (midPrice > 0 && fill.avgFillPrice > 0) {
    if (side === 'buy') {
      slippageBps = ((fill.avgFillPrice - midPrice) / midPrice) * 10000;
    } else {
      slippageBps = ((midPrice - fill.avgFillPrice) / midPrice) * 10000;
    }
  }

  const totalCostBps = slippageBps + feeBps;
  const costPctOfPrincipal = (totalCostBps / 10000) * leverage * 100;

  return {
    exchange: orderbook.exchange,
    pair: '', // caller sets this
    symbol: orderbook.symbol,
    side,
    notionalUSD,
    leverage,
    principalUSD: notionalUSD / leverage,
    avgFillPrice: fill.avgFillPrice,
    midPrice,
    slippageBps: Math.round(slippageBps * 100) / 100,
    feeBps,
    totalCostBps: Math.round(totalCostBps * 100) / 100,
    costPctOfPrincipal: Math.round(costPctOfPrincipal * 1000) / 1000,
    filledQty: fill.filledQty,
    orderbookDepthUsed: fill.levelsUsed,
    insufficientLiquidity: fill.insufficientLiquidity,
  };
}
