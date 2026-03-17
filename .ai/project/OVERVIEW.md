# Project Overview

## Identity
- project: slippage-monitor
- one-liner: Real-time perpetual futures slippage & taker cost monitor across CEX and DEX exchanges
- stage: production

## Problem
Traders and exchange operators need to compare execution costs across exchanges before placing large perps orders. Current tools don't simulate orderbook walk to calculate true slippage at various order sizes. Without this, users can't assess the real cost of market orders (slippage + fees) across exchanges side-by-side.

## Product Intent
We provide a read-only monitoring tool that fetches live orderbook depth from multiple exchanges, simulates market orders at configurable notional sizes (10K–1M USD), and computes the actual taker cost breakdown (slippage bps + fee bps = total cost bps). The tool runs as a CLI terminal table with auto-refresh, or as a web dashboard with SSE live updates. After deploying this, an operator can instantly see which exchange offers the lowest execution cost for a given pair and size — enabling smarter order routing and competitive benchmarking for SoDEX.

## Success Metrics
- primary: Accurate slippage calculation matching real orderbook depth within 1 bps tolerance
- secondary:
  - Sub-10s refresh cycle across all exchanges
  - Support 5+ exchanges with unified adapter interface
  - Web dashboard responsive with real-time SSE updates
- timeframe: ongoing operational tool

## Anti-goals (What We Are NOT Building)
- Not an execution engine: no orders are placed, read-only monitoring only
- Not a historical analytics platform: real-time snapshots only, no persistence
- Not a full DEX aggregator: we compare costs, not route orders

## Users
- primary: SoDEX operations team — needs competitive cost benchmarking against Binance, Bybit, Hyperliquid to ensure SoDEX offers competitive execution
- secondary: Traders evaluating execution cost across exchanges before placing large orders

## Tech Stack
- Runtime: Node.js 22+ / Bun
- Language: TypeScript (strict mode, ES2022 target)
- Exchange API: CCXT v4+ (Binance, Bybit, Hyperliquid) + custom REST adapters (SoDEX, Lighter)
- HTTP Server: Node.js built-in `http` module (zero framework)
- CLI: cli-table3
- Dev: tsx for direct TS execution
- No API keys required — all public orderbook endpoints

## Supported Exchanges
| Exchange | Type | Adapter | Taker Fee |
|----------|------|---------|-----------|
| Binance | CEX | CCXT | 5 bps |
| Bybit | CEX | CCXT | 5.5 bps |
| Hyperliquid | DEX | CCXT | 4.5 bps |
| SoDEX | DEX | Custom REST | 4 bps |
| Lighter | DEX | Custom REST | 0 bps |

## Supported Pairs
BTC, ETH, SOL, GOLD (mapped to exchange-specific symbols per adapter)

## Architecture
```
src/
├── types.ts              # Shared type definitions (ExchangeAdapter, SlippageResult, etc.)
├── config.ts             # Reads config.json + defaults
├── index.ts              # Entry: init adapters → start monitor → output
├── exchanges/            # Exchange adapters (unified ExchangeAdapter interface)
│   ├── base.ts           # normalizeOrderbook, computeMidPrice
│   ├── ccxt-adapter.ts   # Generic CCXT adapter (Binance/Bybit/Hyperliquid)
│   ├── lighter.ts        # Lighter custom REST adapter
│   └── sodex.ts          # SoDEX custom REST adapter
├── core/                 # Core logic
│   ├── orderbook.ts      # Parallel orderbook fetch across all exchanges
│   ├── slippage.ts       # Slippage calculation engine (orderbook walk simulation)
│   └── monitor.ts        # Polling scheduler (recursive setTimeout, no overlap)
└── output/               # Output layer
    ├── cli.ts            # CLI table rendering
    └── web.ts            # Web dashboard (HTTP + SSE + inline HTML/JS/CSS)
```

## Upstream Dependencies
- CCXT v4+: exchange API abstraction for CEX orderbooks
- SoDEX gateway API (mainnet-gw.sodex.dev): SoDEX orderbook data
- Lighter API (mainnet.zklighter.elliot.ai): Lighter orderbook data
