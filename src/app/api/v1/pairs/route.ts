import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withRateLimit } from '@/lib/rate-limit';
import { getAdapters } from '@/lib/collector';
import { pairRegistry } from '@/lib/pairs';

export const GET = withRateLimit(async (_request: NextRequest) => {
  await pairRegistry.ensureFresh();
  const adapters = getAdapters();

  const pairs = pairRegistry.all().map(pair => {
    // How many venues actually list this pair — the UI needs to distinguish a
    // SoDEX-only listing from one that simply has not been collected yet.
    const venues = adapters.filter(a => a.getSymbol(pair.id) !== null).length;
    return {
      id: pair.id,
      name: `${pair.id}-PERP`,
      display_name: pair.id,
      tier: pair.tier,
      multiplier: pair.multiplier,
      comparable_exchanges: venues,
    };
  });

  return NextResponse.json({ pairs, count: pairs.length });
});
