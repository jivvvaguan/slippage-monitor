# System Architecture

## Module Map (v1 — Current)

```
src/
├── types.ts              # Shared interfaces: Config, Orderbook, SlippageResult, ExchangeAdapter, MonitorSnapshot
├── config.ts             # Reads config.json, merges defaults
├── index.ts              # Entry point: init adapters → start monitor → attach outputs
│
├── exchanges/            # Exchange adapter layer (unified ExchangeAdapter interface)
│   ├── base.ts           # Shared utils: normalizeOrderbook(), computeMidPrice()
│   ├── ccxt-adapter.ts   # Generic CCXT adapter — parameterized for Binance/Bybit/Hyperliquid
│   ├── sodex.ts          # SoDEX custom REST adapter (mainnet-gw.sodex.dev)
│   └── lighter.ts        # Lighter custom REST adapter (mainnet.zklighter.elliot.ai)
│
├── core/                 # Business logic
│   ├── orderbook.ts      # Parallel orderbook fetch across all configured exchanges
│   ├── slippage.ts       # Slippage calculation engine — walks orderbook to simulate market order fill
│   └── monitor.ts        # Polling scheduler — recursive setTimeout, non-overlapping ticks
│
└── output/               # Presentation layer
    ├── cli.ts            # CLI terminal table (cli-table3), auto-refresh
    └── web.ts            # Web dashboard — HTTP server + SSE push + inline HTML/JS/CSS
```

## v2 Target Architecture (Next.js)

```
slippage-monitor-v2/
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── page.tsx             # Dashboard — single-pair slippage comparison grid
│   │   ├── layout.tsx           # Root layout (theme, i18n)
│   │   ├── docs/page.tsx        # Interactive API documentation page
│   │   └── api/v1/              # Public REST API
│   │       ├── exchanges/       # GET — list supported exchanges + fees
│   │       ├── pairs/           # GET — list supported pairs
│   │       ├── slippage/        # GET — single pair + amount query
│   │       ├── slippage/compare/# GET — cross-exchange comparison
│   │       ├── slippage/all/    # GET — all pairs × all exchanges batch
│   │       └── status/          # GET — system health + per-exchange status
│   │
│   ├── components/              # React components
│   ├── lib/                     # Core logic (migrated from v1)
│   │   ├── exchanges/           # Adapter layer (v1 exchanges/ → here)
│   │   ├── slippage.ts          # Calculation engine (v1 core/slippage.ts → here)
│   │   ├── cache.ts             # In-memory orderbook + result cache
│   │   ├── collector.ts         # Timed data collection (replaces v1 monitor.ts + orderbook.ts)
│   │   └── config.ts            # Config via env vars (replaces v1 config.json)
│   └── i18n/                    # zh.ts + en.ts
│
├── public/                      # Static assets (OG image, favicon)
└── ecosystem.config.js          # PM2 production config
```

## Modules

### Exchange Adapter Layer (`exchanges/`)
- **Interface**: `ExchangeAdapter` — `fetchOrderbook()`, `getTakerFeeBps()`, `getSymbol()`, `getSupportedPairs()`, `close()`
- **CCXT adapters**: Single parameterized `CcxtAdapter` class handles Binance, Bybit, Hyperliquid via constructor config
- **Custom adapters**: SoDEX and Lighter have bespoke REST implementations due to non-standard APIs
- **Extension pattern**: New CEX = add config object; new DEX = implement `ExchangeAdapter`

### Slippage Engine (`core/slippage.ts`)
- Pure function: `(orderbook, notionalUSD, feeBps, leverage) → SlippageResult`
- Walks orderbook levels simulating market order fill
- Computes: avg fill price, slippage bps, total cost bps, cost % of principal
- Handles insufficient liquidity gracefully (flag + partial fill)

### Monitor (`core/monitor.ts`)
- Recursive `setTimeout` scheduler — no overlap between ticks
- Each tick: fetch all orderbooks in parallel → compute slippage for all (exchange × pair × size) combinations → emit snapshot
- Snapshot pushed to CLI output and SSE clients simultaneously

### Output Layer (`output/`)
- **CLI**: Formats `MonitorSnapshot` into colored terminal table, clears and reprints each tick
- **Web**: Node.js `http` server serving inline HTML dashboard + SSE `/api/events` endpoint

## Dependency Flow

```
config.ts → index.ts → exchanges/* → core/orderbook.ts → core/slippage.ts → core/monitor.ts → output/*
```

- `config.ts` is read once at startup
- `index.ts` instantiates adapters based on config, wires them to monitor
- `monitor.ts` orchestrates the fetch-compute-emit loop
- Output modules are passive consumers of `MonitorSnapshot`

## Data Flow

```
Exchange REST APIs (public, no auth)
    ↓  parallel fetch per tick (every refreshIntervalMs)
Orderbook[] (normalized: { bids, asks, midPrice })
    ↓  per (exchange × pair × orderSize)
SlippageResult[] (slippage bps, fee bps, total cost bps, cost USD)
    ↓
MonitorSnapshot { timestamp, results[] }
    ↓
├── cli.ts → terminal table (stdout)
└── web.ts → SSE push to browser + /api/snapshot HTTP endpoint
```
