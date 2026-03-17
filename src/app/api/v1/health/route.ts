import type { NextRequest } from 'next/server';
import { jsonResponse } from '@/lib/api-utils';
import { getDataCollector } from '@/lib/data-collector';

/**
 * Health check endpoint optimized for monitoring scripts.
 * Returns HTTP 200 if healthy, 503 if degraded/unhealthy.
 * No rate limiting — monitoring agents need unrestricted access.
 */
export async function GET(request: NextRequest) {
  const collector = getDataCollector();
  if (!collector.isRunning()) {
    collector.start();
  }

  const exchangeInfo = collector.getExchangeInfo();
  const uptimeSeconds = collector.getUptimeSeconds();
  const { dataAgeSeconds } = collector.getDataAgeInfo();

  const exchanges = exchangeInfo.map((ex) => ({
    name: ex.name,
    status: ex.status,
    data_age_seconds: ex.dataAgeSeconds,
  }));

  const allUp = exchangeInfo.every((ex) => ex.status === 'up');
  const anyDown = exchangeInfo.some((ex) => ex.status === 'down');
  const overallStatus = allUp ? 'healthy' : anyDown ? 'unhealthy' : 'degraded';

  const statusCode = overallStatus === 'healthy' ? 200 : 503;

  return jsonResponse(
    {
      status: overallStatus,
      uptime_seconds: uptimeSeconds,
      data_age_seconds: dataAgeSeconds,
      exchanges,
      timestamp: new Date().toISOString(),
    },
    request,
    statusCode,
  );
}
