import type { NextRequest } from 'next/server';
import { handleOptions, applyRateLimit, jsonResponse } from '@/lib/api-utils';
import { getDataCollector } from '@/lib/data-collector';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(request: NextRequest) {
  const rateLimitResponse = applyRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  const collector = getDataCollector();
  if (!collector.isRunning()) {
    collector.start();
  }

  const exchangeInfo = collector.getExchangeInfo();
  const uptimeSeconds = collector.getUptimeSeconds();
  const lastRefreshAt = collector.getLastRefreshAt();
  const { dataAgeSeconds, nextRefreshSeconds } = collector.getDataAgeInfo();

  const allUp = exchangeInfo.every((ex) => ex.status === 'up');
  const anyDown = exchangeInfo.some((ex) => ex.status === 'down');
  const overallStatus = allUp ? 'healthy' : anyDown ? 'degraded' : 'partial';

  return jsonResponse(
    {
      status: overallStatus,
      uptimeSeconds,
      lastRefreshAt: lastRefreshAt ? new Date(lastRefreshAt).toISOString() : null,
      exchanges: exchangeInfo.map((ex) => ({
        name: ex.name,
        status: ex.status,
        dataAgeSeconds: ex.dataAgeSeconds,
      })),
      data_age_seconds: dataAgeSeconds,
      next_refresh_seconds: nextRefreshSeconds,
    },
    request,
  );
}
