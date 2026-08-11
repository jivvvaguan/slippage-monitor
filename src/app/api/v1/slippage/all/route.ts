import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withRateLimit } from '@/lib/rate-limit';
import { cache } from '@/lib/cache';
import { getAdapters } from '@/lib/collector';
import { calculateSlippage } from '@/lib/slippage';
import { APP_CONFIG } from '@/lib/config';
import { formatSlippageResult, sortByTotalCost, validateSide, type FormattedResult } from '@/lib/format';

export const GET = withRateLimit(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const amount = Number(searchParams.get('amount')) || 100000;
  const leverage = Number(searchParams.get('leverage')) || APP_CONFIG.defaultLeverage;
  const side = validateSide(searchParams.get('side'));

  const adapters = getAdapters();
  const isPreset = APP_CONFIG.presetAmounts.includes(amount);
  const allResults: Record<string, FormattedResult[]> = {};

  for (const pair of APP_CONFIG.pairs) {
    const results: FormattedResult[] = [];
    for (const adapter of adapters) {
      // Use precomputed results when possible
      if (isPreset && leverage === APP_CONFIG.defaultLeverage && side === 'buy') {
        const precomputed = cache.getPrecomputedSlippage(adapter.name, pair);
        const match = precomputed.find(r => r.notionalUSD === amount);
        if (match) {
          results.push(formatSlippageResult(match, amount));
          continue;
        }
      }

      const ob = cache.getOrderbook(adapter.name, pair);
      if (ob) {
        const result = calculateSlippage(ob, amount, leverage, adapter.getTakerFeeBps(), side);
        results.push(formatSlippageResult(result, amount));
      }
    }
    allResults[pair] = sortByTotalCost(results);
  }

  return NextResponse.json({
    amount,
    leverage,
    side,
    timestamp: new Date().toISOString(),
    pairs: allResults,
  });
});
