# Architecture Decision Records

> Record cross-task decisions here. Format: DEC-YYYYMMDD-seq.

## DEC-20260316-01: Exchange Adapter Pattern

**Context**: Need to support CEX (Binance, Bybit) and DEX (Hyperliquid, SoDEX, Lighter) with very different APIs.

**Decision**: Unified `ExchangeAdapter` interface with two implementation strategies:
- `CcxtAdapter`: Generic parameterized class for CCXT-supported exchanges (config-driven, no code per exchange)
- Custom adapters: Bespoke implementations for non-CCXT exchanges (SoDEX, Lighter)

**Rationale**: CCXT handles 90%+ of CEX complexity. DEX APIs are non-standard and need custom handling. The interface abstraction means the core engine doesn't care which type of adapter is used.

## DEC-20260317-01: v2 Framework — Next.js

**Context**: v1 is a local CLI tool. v2 needs to be a public web platform with SEO, API routes, and SSR.

**Decision**: Next.js (App Router) for v2.

**Alternatives considered**:
- Hono + Cloudflare Workers: Lower cost but harder to do SSR, limited to edge runtime
- Vanilla Node.js + static HTML: v1 approach, doesn't scale to SEO/SSR needs

**Rationale**: Full-stack TypeScript, built-in API Routes, SSR for SEO, existing v1 code is TypeScript and directly portable.

## DEC-20260317-02: Data Strategy — Pre-compute + On-demand

**Context**: Users want instant slippage results. Orderbook fetching is expensive (rate-limited, 5+ exchanges). Slippage computation is cheap (<1ms per calculation).

**Decision**: Backend pre-computes slippage for preset amounts ($10K–$1M) every 5 minutes. Custom amounts compute on-demand from cached orderbooks.

**Rationale**: Orderbook is shared resource (same for all users, expensive to fetch). Slippage is user function (different per amount, cheap to compute). This decouples fetch cost from user count.

## DEC-20260317-03: No Authentication Initially

**Context**: v2 targets public access. Adding auth adds friction.

**Decision**: No API key for v2 launch. IP-based rate limiting (60 req/min). API Key tier deferred until >1000 DAU.

**Rationale**: Zero-friction onboarding maximizes adoption. Rate limiting prevents abuse. API keys add user account management overhead we don't need yet.

## DEC-20260317-04: Deployment — VPS + PM2

**Context**: Need cheapest viable production hosting.

**Decision**: Single VPS ($6/mo) with PM2 process manager.

**Alternatives considered**:
- Docker Compose: More complexity, same cost
- Vercel: Free tier limited, serverless doesn't suit background data collection

**Rationale**: PM2 provides zero-downtime reload, auto-restart on crash, log management. Sufficient for <10K DAU. Simple to operate.

## DEC-20260317-05: In-memory Cache Only

**Context**: Need to cache orderbooks and pre-computed results.

**Decision**: Pure in-memory cache, no Redis or database.

**Alternatives considered**:
- Redis: Adds infrastructure dependency
- SQLite: Adds persistence we don't need

**Rationale**: Total cache size ~400KB. Data is ephemeral (refreshed every 5 min). No persistence needed. Zero external dependencies.

## DEC-20260317-06: Scope — Perps Only

**Context**: Could monitor spot markets too.

**Decision**: Perpetual futures only, no spot.

**Rationale**: Focused positioning ("the perps slippage tool"), reduced engineering scope, clearer market differentiation. Spot can be added later if demand exists.
