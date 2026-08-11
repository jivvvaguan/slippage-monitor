/**
 * A counting semaphore, one per venue.
 *
 * The collector used to fire every fetch through a single Promise.all, which
 * was fine at 36 requests and is not at ~600: OKX's books-full endpoint starts
 * returning 50011 at 12 concurrent, and a burst of Binance depth calls at
 * weight 20 each will trip its per-minute budget. Concurrency has to be capped
 * per venue, because the limits differ by an order of magnitude.
 */
export class ConcurrencyLimiter {
  private active = 0;
  private queue: (() => void)[] = [];

  constructor(private readonly max: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    // The slot is taken here, not after the await resumes: a waking task only
    // increments on a later microtask, so a fresh caller arriving in between
    // would see a free slot and push concurrency past max — the exact
    // over-subscription this class exists to prevent.
    if (this.active >= this.max) {
      await new Promise<void>(resolve => this.queue.push(resolve));
    } else {
      this.active++;
    }
    try {
      return await task();
    } finally {
      const next = this.queue.shift();
      if (next) next(); // hands the slot straight over, active unchanged
      else this.active--;
    }
  }
}

/**
 * Measured ceilings, not guesses:
 * - OKX books-full returned 2x 50011 at 12 concurrent, so it gets the tightest gate.
 * - Binance depth costs 20 weight at limit 1000 against a 2400/min budget.
 * - SoDEX served 12/12 concurrent in 672ms.
 * Anything unlisted gets a conservative default.
 */
const VENUE_LIMITS: Record<string, number> = {
  OKX: 4,
  Binance: 8,
  Bybit: 8,
  Bitget: 6,
  MEXC: 6,
  Hyperliquid: 6,
  Aster: 8,
  SoDEX: 8,
  EdgeX: 6,
};

const DEFAULT_LIMIT = 4;

const limiters = new Map<string, ConcurrencyLimiter>();

export function limiterFor(venue: string): ConcurrencyLimiter {
  let limiter = limiters.get(venue);
  if (!limiter) {
    limiter = new ConcurrencyLimiter(VENUE_LIMITS[venue] ?? DEFAULT_LIMIT);
    limiters.set(venue, limiter);
  }
  return limiter;
}
