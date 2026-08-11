import { NextResponse } from 'next/server';
import { cache } from '@/lib/cache';
import { getAdapters } from '@/lib/collector';

/**
 * Health check endpoint optimized for monitoring scripts.
 * Returns HTTP 200 if healthy, 503 if degraded/unhealthy.
 * No rate limiting — monitoring agents need unrestricted access.
 */
export async function GET() {
  const adapters = getAdapters();

  const exchanges = adapters.map((adapter) => ({
    name: adapter.name,
    status: cache.getExchangeStatus(adapter.name),
    data_age_seconds: cache.getDataAge(adapter.name),
  }));

  const allOnline = exchanges.every((ex) => ex.status === 'online');
  const anyOffline = exchanges.some((ex) => ex.status === 'offline');
  const status = allOnline ? 'healthy' : anyOffline ? 'unhealthy' : 'degraded';

  const dataAgeSeconds = exchanges.length
    ? Math.max(...exchanges.map((ex) => ex.data_age_seconds))
    : null;

  return NextResponse.json(
    {
      status,
      data_age_seconds: dataAgeSeconds,
      exchanges,
      timestamp: new Date().toISOString(),
    },
    { status: status === 'healthy' ? 200 : 503 },
  );
}
