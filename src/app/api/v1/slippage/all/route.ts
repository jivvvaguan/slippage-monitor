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
  const amountStr = searchParams.get('amount');

  let customAmount: number | null = null;

  if (amountStr) {
    customAmount = Number(amountStr);
    if (isNaN(customAmount) || customAmount <= 0 || customAmount > 10_000_000) {
      return apiError(
        request,
        400,
        'INVALID_AMOUNT',
        'Amount must be a positive number between 1 and 10,000,000 USD.',
      );
    }
  }

  const pairs = collector.getConfiguredPairs();
  const exchanges = collector.getExchangeNames();
  const presetAmounts = collector.getPresetAmounts();
  const amounts = customAmount ? [customAmount] : [...presetAmounts];

  interface SlippageEntry {
    pair: string;
    exchange: string;
    amountUSD: number;
    midPrice: number;
    avgFillPrice: number;
    slippageBps: number;
    feeBps: number;
    totalCostBps: number;
    costPctOfPrincipal: number;
    insufficientLiquidity: boolean;
    orderbookDepthUsed: number;
  }

  const results: SlippageEntry[] = [];

  for (const pair of pairs) {
    for (const exchange of exchanges) {
      for (const amount of amounts) {
        const isPreset = (presetAmounts as readonly number[]).includes(amount);
        const slippage = isPreset
          ? collector.getSlippage(exchange, pair, amount)
          : collector.computeSlippageOnDemand(exchange, pair, amount);

        if (slippage) {
          results.push({
            pair: slippage.pair,
            exchange: slippage.exchange,
            amountUSD: slippage.notionalUSD,
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
    }
  }

  const { dataAgeSeconds, nextRefreshSeconds } = collector.getDataAgeInfo();

  return jsonResponse(
    {
      pairs,
      exchanges,
      amounts,
      results,
      total: results.length,
      data_age_seconds: dataAgeSeconds,
      next_refresh_seconds: nextRefreshSeconds,
    },
    request,
  );
}
