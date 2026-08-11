import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withRateLimit } from '@/lib/rate-limit';
import { cache } from '@/lib/cache';
import { getAdapters } from '@/lib/collector';
import { pairRegistry, isMarketType, type MarketType } from '@/lib/pairs';

const DEX_EXCHANGES = new Set(['Hyperliquid', 'SoDEX']);

export const GET = withRateLimit(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
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
  const pairs = pairRegistry.all(market);
  const exchanges = adapters.map(adapter => {
    const lastUpdate = cache.getLastUpdate(market, adapter.name);
    return {
      id: adapter.name.toLowerCase(),
      name: adapter.name,
      type: DEX_EXCHANGES.has(adapter.name) ? 'DEX' : 'CEX',
      taker_fee_bps: adapter.getTakerFeeBps(),
      supported_pairs: pairs.filter(p => adapter.getSymbol(p.id) !== null).map(p => p.id),
      status: cache.getExchangeStatus(market, adapter.name),
      last_update: lastUpdate ? new Date(lastUpdate).toISOString() : null,
    };
  });

  return NextResponse.json({ market, exchanges });
});
