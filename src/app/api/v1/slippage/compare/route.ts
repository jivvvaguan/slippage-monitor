import type { NextRequest } from 'next/server';
import { handleOptions, applyRateLimit, jsonResponse, apiError } from '@/lib/api-utils';
import { getDataCollector } from '@/lib/data-collector';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(request: NextRequest) {
  const rateLimitResponse = applyRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  const collector = getDataCollector();
  if (!collector.isRunning()) {
    collector.start();
  }

  const searchParams = request.nextUrl.searchParams;
  const pair = searchParams.get('pair');
  const amountStr = searchParams.get('amount');

  if (!pair) {
    return apiError(request, 400, 'MISSING_PARAM', 'Query parameter "pair" is required. Example: ?pair=BTC');
  }

  const configuredPairs = collector.getConfiguredPairs();
  if (!configuredPairs.includes(pair.toUpperCase())) {
    return apiError(
      request,
      400,
      'INVALID_PAIR',
      `Pair "${pair}" is not supported. Available pairs: ${configuredPairs.join(', ')}`,
    );
  }

  const normalizedPair = pair.toUpperCase();
  let amount = 100_000;

  if (amountStr) {
    amount = Number(amountStr);
    if (isNaN(amount) || amount <= 0 || amount > 10_000_000) {
      return apiError(
        request,
        400,
        'INVALID_AMOUNT',
        'Amount must be a positive number between 1 and 10,000,000 USD.',
      );
    }
  }

  const exchanges = collector.getExchangeNames();
  const isPreset = (collector.getPresetAmounts() as readonly number[]).includes(amount);

  interface ExchangeResult {
    exchange: string;
    midPrice: number;
    avgFillPrice: number;
    slippageBps: number;
    feeBps: number;
    totalCostBps: number;
    costPctOfPrincipal: number;
    insufficientLiquidity: boolean;
    orderbookDepthUsed: number;
  }

  const results: ExchangeResult[] = [];

  for (const exchange of exchanges) {
    const slippage = isPreset
      ? collector.getSlippage(exchange, normalizedPair, amount)
      : collector.computeSlippageOnDemand(exchange, normalizedPair, amount);

    if (slippage) {
      results.push({
        exchange: slippage.exchange,
        midPrice: slippage.midPrice,
        avgFillPrice: slippage.avgFillPrice,
        slippageBps: slippage.slippageBps,
        feeBps: slippage.feeBps,
        totalCostBps: slippage.totalCostBps,
        costPctOfPrincipal: slippage.costPctOfPrincipal,
        insufficientLiquidity: slippage.insufficientLiquidity,
        orderbookDepthUsed: slippage.orderbookDepthUsed,
      });
    }
  }

  const validResults = results.filter((r) => !r.insufficientLiquidity && r.totalCostBps > 0);
  const best = validResults.length > 0
    ? validResults.reduce((a, b) => (a.totalCostBps <= b.totalCostBps ? a : b))
    : null;
  const worst = validResults.length > 0
    ? validResults.reduce((a, b) => (a.totalCostBps >= b.totalCostBps ? a : b))
    : null;

  const { dataAgeSeconds, nextRefreshSeconds } = collector.getDataAgeInfo();

  return jsonResponse(
    {
      pair: normalizedPair,
      amountUSD: amount,
      exchanges: results,
      best: best ? { exchange: best.exchange, totalCostBps: best.totalCostBps } : null,
      worst: worst ? { exchange: worst.exchange, totalCostBps: worst.totalCostBps } : null,
      data_age_seconds: dataAgeSeconds,
      next_refresh_seconds: nextRefreshSeconds,
    },
    request,
  );
}
