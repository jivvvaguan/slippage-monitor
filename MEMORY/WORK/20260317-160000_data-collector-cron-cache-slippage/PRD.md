---
task: Data collector with cron cache and slippage
slug: 20260317-160000_data-collector-cron-cache-slippage
effort: advanced
phase: execute
progress: 3/24
mode: interactive
started: 2026-03-17T16:00:00Z
updated: 2026-03-17T16:00:00Z
---

## Context

Build a data collector service that uses node-cron to periodically fetch orderbooks from all configured exchanges, store them in an in-memory cache, and pre-compute slippage for preset notional amounts. This replaces the ad-hoc fetch-on-demand pattern with a background refresh model that powers the API/dashboard with fresh, pre-computed data.

The existing codebase has two parallel structures: `src/` (v1 CLI) and `src/lib/` (v2 Next.js). The data collector should live in `src/lib/` to serve the Next.js web dashboard. It builds on existing `ExchangeAdapter` interface, `calculateSlippage()`, and `loadConfig()`.

### Risks
- node-cron needs to be added as a dependency
- Exchange adapters need instantiation logic (currently in v1 `src/index.ts`)
- Must not break existing CLI flow in `src/`

## Criteria

### Dependencies
- [x] ISC-1: node-cron added as production dependency in package.json
- [x] ISC-2: @types/node-cron added as dev dependency in package.json

### Scheduler
- [ ] ISC-3: Cron job uses expression "*/5 * * * *" (every 5 minutes)
- [ ] ISC-4: Scheduler exposes start() method to begin cron
- [ ] ISC-5: Scheduler exposes stop() method to halt cron
- [ ] ISC-6: First fetch runs immediately on start (not wait 5 min)

### Exchange Fetching
- [x] ISC-7: Exchange adapter factory creates adapters from config
- [ ] ISC-8: Each exchange fetched independently via Promise.allSettled
- [ ] ISC-9: Failed exchange logs warning with exchange name and error
- [ ] ISC-10: Failed exchange does not prevent other exchanges from completing
- [ ] ISC-11: Each pair fetched per exchange (all configured pairs)

### Cache — Raw Orderbooks
- [ ] ISC-12: Cache stores raw Orderbook objects keyed by "exchange:pair"
- [ ] ISC-13: Cache entry stores fetchedAt timestamp (Date.now())
- [ ] ISC-14: getOrderbook(exchange, pair) returns entry or null
- [ ] ISC-15: data_age_seconds computed as (Date.now() - fetchedAt) / 1000

### Cache — Pre-computed Slippage
- [ ] ISC-16: Slippage pre-computed for amounts [10000, 50000, 100000, 500000, 1000000]
- [ ] ISC-17: Pre-computed on each refresh cycle after orderbooks fetched
- [ ] ISC-18: Results stored keyed by exchange+pair+amount
- [ ] ISC-19: getSlippage(exchange, pair, amount) returns SlippageResult or null
- [ ] ISC-20: getAllSlippage() returns all pre-computed results array

### Degraded Status
- [ ] ISC-21: Cache entry with data_age > 600s (10 min) flagged as degraded
- [ ] ISC-22: getDegradedExchanges() returns list of degraded exchange+pair keys
- [ ] ISC-23: getOrderbook returns degraded flag alongside orderbook data

### Integration
- [ ] ISC-24: TypeScript compiles with no errors (strict mode)

## Decisions

## Verification
