import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withRateLimit } from '@/lib/rate-limit';
import { cache } from '@/lib/cache';
import { getAdapters } from '@/lib/collector';
import { APP_CONFIG } from '@/lib/config';

const DEX_EXCHANGES = new Set(['Hyperliquid', 'SoDEX']);

export const GET = withRateLimit(async (request: NextRequest) => {
  const adapters = getAdapters();
  const exchanges = adapters.map(adapter => {
    const lastUpdate = cache.getLastUpdate(adapter.name);
    return {
      id: adapter.name.toLowerCase(),
      name: adapter.name,
      type: DEX_EXCHANGES.has(adapter.name) ? 'DEX' : 'CEX',
      taker_fee_bps: adapter.getTakerFeeBps(),
      supported_pairs: APP_CONFIG.pairs.filter(p => adapter.getSymbol(p) !== null),
      status: cache.getExchangeStatus(adapter.name),
      last_update: lastUpdate ? new Date(lastUpdate).toISOString() : null,
    };
  });

  return NextResponse.json({ exchanges });
});
