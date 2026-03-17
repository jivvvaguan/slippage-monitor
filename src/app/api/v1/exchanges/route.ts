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
  const { dataAgeSeconds, nextRefreshSeconds } = collector.getDataAgeInfo();

  return jsonResponse(
    {
      exchanges: exchangeInfo.map((ex) => ({
        name: ex.name,
        takerFeeBps: ex.takerFeeBps,
        status: ex.status,
        lastFetchedAt: ex.lastFetchedAt,
        dataAgeSeconds: ex.dataAgeSeconds,
      })),
      data_age_seconds: dataAgeSeconds,
      next_refresh_seconds: nextRefreshSeconds,
    },
    request,
  );
}
