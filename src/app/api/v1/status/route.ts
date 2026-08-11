import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withRateLimit } from '@/lib/rate-limit';
import { cache } from '@/lib/cache';
import { getAdapters } from '@/lib/collector';
import { APP_CONFIG } from '@/lib/config';

export const GET = withRateLimit(async (request: NextRequest) => {
  const adapters = getAdapters();
  const exchanges: Record<string, any> = {};

  for (const adapter of adapters) {
    const lastUpdate = cache.getLastUpdate('perp', adapter.name);
    exchanges[adapter.name.toLowerCase()] = {
      status: cache.getExchangeStatus('perp', adapter.name),
      last_success: lastUpdate ? new Date(lastUpdate).toISOString() : null,
      data_age_seconds: cache.getDataAge('perp', adapter.name),
    };
  }

  const allOnline = Object.values(exchanges).every((e: any) => e.status === 'online');
  const anyDegraded = Object.values(exchanges).some((e: any) => e.status === 'degraded');

  return NextResponse.json({
    status: allOnline ? 'healthy' : anyDegraded ? 'degraded' : 'unhealthy',
    exchanges,
    cache_refresh_interval_seconds: APP_CONFIG.refreshIntervalMs / 1000,
    next_refresh: new Date(Date.now() + APP_CONFIG.refreshIntervalMs).toISOString(),
  });
});
