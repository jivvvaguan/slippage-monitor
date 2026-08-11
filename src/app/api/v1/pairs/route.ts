import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withRateLimit } from '@/lib/rate-limit';
import { APP_CONFIG } from '@/lib/config';

export const GET = withRateLimit(async (request: NextRequest) => {
  const pairs = APP_CONFIG.pairs.map(pair => ({
    id: pair,
    name: `${pair}-PERP`,
    display_name: pair,
  }));

  return NextResponse.json({ pairs });
});
