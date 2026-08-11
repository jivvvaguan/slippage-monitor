// Shared constants usable by both server and client code.
// The pair universe is no longer here — it comes from SoDEX at runtime
// via src/lib/pairs.ts, so a new listing needs no code change.
export const PRESET_AMOUNTS = [10000, 50000, 100000, 500000, 1000000] as const;
export const DEFAULT_LEVERAGE = 10;
