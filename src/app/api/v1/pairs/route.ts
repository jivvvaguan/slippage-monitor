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

  const pairs = collector.getConfiguredPairs();
  const { dataAgeSeconds, nextRefreshSeconds } = collector.getDataAgeInfo();

  return jsonResponse(
    {
      pairs,
      total: pairs.length,
      data_age_seconds: dataAgeSeconds,
      next_refresh_seconds: nextRefreshSeconds,
    },
    request,
  );
}
