import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withRateLimit } from '@/lib/rate-limit';
import { cache } from '@/lib/cache';
import { getAdapters } from '@/lib/collector';
import { pairRegistry } from '@/lib/pairs';

const DEX_EXCHANGES = new Set(['Hyperliquid', 'SoDEX']);

export const GET = withRateLimit(async (request: NextRequest) => {
  await pairRegistry.ensureFresh();
  const adapters = getAdapters();
  const pairs = pairRegistry.all();
  const exchanges = adapters.map(adapter => {
    const lastUpdate = cache.getLastUpdate(adapter.name);
    return {
      id: adapter.name.toLowerCase(),
      name: adapter.name,
      type: DEX_EXCHANGES.has(adapter.name) ? 'DEX' : 'CEX',
      taker_fee_bps: adapter.getTakerFeeBps(),
      supported_pairs: pairs.filter(p => adapter.getSymbol(p.id) !== null).map(p => p.id),
      status: cache.getExchangeStatus(adapter.name),
      last_update: lastUpdate ? new Date(lastUpdate).toISOString() : null,
    };
  });

  return NextResponse.json({ exchanges });
});
