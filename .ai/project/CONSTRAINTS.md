# Technical Constraints

## Technology Stack
- language: TypeScript (strict mode, ES2022 target)
- runtime: Node.js 22+ (also compatible with Bun)
- framework: v1 = vanilla Node.js http; v2 = Next.js (App Router)
- database: None — all data is ephemeral in-memory cache
- infra: VPS + PM2 ($6/mo target for v2)

## Performance Requirements
- api-latency: Pre-computed slippage response < 50ms; custom amount response < 100ms
- throughput: 1000+ concurrent users (v2 target)
- refresh-cycle: Orderbook data refreshed every 5 minutes (configurable)
- slippage-computation: < 1ms per (exchange × pair × amount) — pure in-memory orderbook walk

## Security Requirements
- auth: No authentication required (v2 initial); IP-based rate limiting (60 req/min)
- secrets: No API keys needed — all exchange endpoints are public orderbook data
- data: No user data stored, no PII, no cookies
- transport: HTTPS in production (v2)

## Resource Constraints
- compute: Single VPS, single process (PM2 for restart/reload)
- memory: ~400KB total cache footprint (orderbooks + pre-computed results for all exchanges × pairs × sizes)
- network: Parallel fetches to 5+ exchange APIs every 5 minutes; must handle per-exchange rate limits
- team: Solo developer (Zhiwen)

## Non-negotiable Rules
- Read-only: No orders are ever placed — monitoring only
- No API keys for exchanges: Only public endpoints, never risk account credentials
- Graceful degradation: Single exchange failure must not break the entire system — show available data, mark failed exchange as degraded
- Data transparency: Always expose data age (seconds since last refresh) in API responses and UI
- Perps only: No spot markets — keep scope focused
