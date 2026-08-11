import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withRateLimit } from '@/lib/rate-limit';
import { getAdapters } from '@/lib/collector';
import { pairRegistry, isMarketType, type MarketType } from '@/lib/pairs';

export const GET = withRateLimit(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const marketParam = searchParams.get('market');
  // Default to perps so links made before spot existed keep working.
  const market: MarketType = marketParam === null ? 'perp' : (marketParam as MarketType);
  if (!isMarketType(market)) {
    return NextResponse.json(
      { error: 'invalid_market', message: "market must be 'perp' or 'spot'" },
      { status: 400 },
    );
  }

  await pairRegistry.ensureFresh(market);
  const adapters = getAdapters(market);

  const pairs = pairRegistry.all(market).map(pair => {
    // How many venues actually list this pair — the UI needs to distinguish a
    // SoDEX-only listing from one that simply has not been collected yet.
    const venues = adapters.filter(a => a.getSymbol(pair.id) !== null).length;
    return {
      id: pair.id,
      // Spot carries no quote suffix: venues are matched on whichever pair
      // trades most, so it is USDT on most CEXes and USDC only on SoDEX —
      // printing one of them would be wrong for the rest of the row.
      name: market === 'perp' ? `${pair.id}-PERP` : pair.id,
      display_name: pair.id,
      tier: pair.tier,
      multiplier: pair.multiplier,
      comparable_exchanges: venues,
    };
  });

  // SoDEX returns its listing in no particular order. Sort tier-1 first so a
  // fallback after a tab switch lands on a major rather than whatever happened
  // to be first, then alphabetically so 83 entries stay scannable.
  pairs.sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));

  return NextResponse.json({ market, pairs, count: pairs.length });
});
