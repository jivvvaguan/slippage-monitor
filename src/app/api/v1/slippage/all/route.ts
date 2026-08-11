import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withRateLimit } from '@/lib/rate-limit';
import { cache } from '@/lib/cache';
import { getAdapters } from '@/lib/collector';
import { calculateSlippage } from '@/lib/slippage';
import { APP_CONFIG } from '@/lib/config';
import { pairRegistry, isMarketType, type MarketType } from '@/lib/pairs';
import { formatSlippageResult, sortByTotalCost, validateSide, type FormattedResult } from '@/lib/format';

export const GET = withRateLimit(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const amount = Number(searchParams.get('amount')) || 100000;
  const leverage = Number(searchParams.get('leverage')) || APP_CONFIG.defaultLeverage;
  const side = validateSide(searchParams.get('side'));

  const marketParam = searchParams.get('market');
  // Default to perps so links made before spot existed keep working.
  const market: MarketType = marketParam === null ? 'perp' : (marketParam as MarketType);
  if (!isMarketType(market)) {
    return NextResponse.json(
      { error: 'invalid_market', message: "market must be 'perp' or 'spot'" },
      { status: 400 },
    );
  }

  await pairRegistry.ensureFresh(market);
  const adapters = getAdapters(market);
  const isPreset = APP_CONFIG.presetAmounts.includes(amount);
  const allResults: Record<string, FormattedResult[]> = {};

  for (const { id: pair } of pairRegistry.all(market)) {
    const results: FormattedResult[] = [];
    for (const adapter of adapters) {
      // Depth was computed once when the collector wrote this book.
      const ob = cache.getOrderbook(market, adapter.name, pair);
      const depth = cache.getDepthBands(market, adapter.name, pair);

      // Use precomputed results when possible
      if (isPreset && leverage === APP_CONFIG.defaultLeverage && side === 'buy') {
        const precomputed = cache.getPrecomputedSlippage(market, adapter.name, pair);
        const match = precomputed.find(r => r.notionalUSD === amount);
        if (match) {
          results.push(formatSlippageResult(match, amount, depth));
          continue;
        }
      }

      if (ob) {
        const result = calculateSlippage(ob, amount, leverage, adapter.getTakerFeeBps(pair), side);
        results.push(formatSlippageResult(result, amount, depth));
      }
    }
    allResults[pair] = sortByTotalCost(results);
  }

  return NextResponse.json({
    market,
    amount,
    leverage,
    side,
    timestamp: new Date().toISOString(),
    pairs: allResults,
  });
});
