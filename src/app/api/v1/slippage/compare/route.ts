import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withRateLimit } from '@/lib/rate-limit';
import { cache } from '@/lib/cache';
import { getAdapters } from '@/lib/collector';
import { calculateSlippage } from '@/lib/slippage';
import { APP_CONFIG } from '@/lib/config';
import { pairRegistry, isMarketType, type MarketType } from '@/lib/pairs';
import { ensurePairFresh } from '@/lib/collector';
import { formatSlippageResult, sortByTotalCost, validateSide, type FormattedResult } from '@/lib/format';

export const GET = withRateLimit(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const pair = searchParams.get('pair')?.toUpperCase();
  const amount = Number(searchParams.get('amount'));
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
  const pairInfo = pair ? pairRegistry.get(market, pair) : null;
  if (!pairInfo) {
    return NextResponse.json(
      { error: 'invalid_pair', message: 'Unknown pair. See GET /api/v1/pairs for the current list.' },
      { status: 400 }
    );
  }
  const pairId = pairInfo.id;

  // Long-tail pairs refresh on a slower cadence; opening one pulls it current.
  await ensurePairFresh(market, pairId);
  if (!amount || amount <= 0) {
    return NextResponse.json(
      { error: 'invalid_amount', message: 'Amount must be a positive number (USD)' },
      { status: 400 }
    );
  }

  const adapters = getAdapters(market);
  const isPreset = APP_CONFIG.presetAmounts.includes(amount);
  const results: FormattedResult[] = [];

  for (const adapter of adapters) {
    // Depth was computed once when the collector wrote this book.
    const ob = cache.getOrderbook(market, adapter.name, pairId);
    const depth = cache.getDepthBands(market, adapter.name, pairId);

    if (isPreset && leverage === APP_CONFIG.defaultLeverage && side === 'buy') {
      const precomputed = cache.getPrecomputedSlippage(market, adapter.name, pairId);
      const match = precomputed.find(r => r.notionalUSD === amount);
      if (match) {
        results.push(formatSlippageResult(match, amount, depth));
        continue;
      }
    }

    if (ob) {
      const result = calculateSlippage(ob, amount, leverage, adapter.getTakerFeeBps(pairId), side);
      results.push(formatSlippageResult(result, amount, depth));
    }
  }

  sortByTotalCost(results);

  const updates = adapters.map(a => cache.getLastUpdate(market, a.name)).filter(t => t > 0);
  const oldestUpdate = updates.length > 0 ? Math.min(...updates) : 0;
  const refreshInterval = APP_CONFIG.refreshIntervalMs / 1000;
  const dataAge = oldestUpdate > 0 ? Math.floor((Date.now() - oldestUpdate) / 1000) : 0;

  return NextResponse.json({
    market,
    pair: pairId,
    amount,
    leverage,
    side,
    timestamp: new Date().toISOString(),
    data_age_seconds: dataAge,
    next_refresh_seconds: Math.max(0, refreshInterval - dataAge),
    results,
    best_exchange: results[0]?.exchange ?? null,
    worst_exchange: results[results.length - 1]?.exchange ?? null,
  });
});
