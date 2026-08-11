import { NextResponse } from 'next/server';
import { cache } from '@/lib/cache';
import { getAdapters } from '@/lib/collector';
import { MARKET_TYPES } from '@/lib/pairs';

/**
 * Health check endpoint optimized for monitoring scripts.
 * Returns HTTP 200 if healthy, 503 if degraded/unhealthy.
 * No rate limiting — monitoring agents need unrestricted access.
 */
export async function GET() {
  // Both markets are reported: a spot collector that dies — the spot endpoint
  // is undocumented and could change shape — would otherwise be invisible here
  // while /health kept answering 200.
  // getDataAge returns Infinity for an exchange with no cached data, which
  // JSON.stringify would emit as null — map it to null explicitly instead.
  const exchanges = MARKET_TYPES.flatMap((market) =>
    getAdapters(market).map((adapter) => {
      const age = cache.getDataAge(market, adapter.name);
      return {
        market,
        name: adapter.name,
        status: cache.getExchangeStatus(market, adapter.name),
        data_age_seconds: Number.isFinite(age) ? age : null,
      };
    }),
  );

  const allOnline = exchanges.every((ex) => ex.status === 'online');
  const anyOffline = exchanges.some((ex) => ex.status === 'offline');
  const status = allOnline ? 'healthy' : anyOffline ? 'unhealthy' : 'degraded';

  // Staleness of the freshest-lagging exchange that actually has data;
  // exchanges with no data at all are reported via their own status.
  const knownAges = exchanges
    .map((ex) => ex.data_age_seconds)
    .filter((age): age is number => age !== null);
  const dataAgeSeconds = knownAges.length ? Math.max(...knownAges) : null;

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
