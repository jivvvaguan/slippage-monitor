# Perps Slippage Monitor

永续合约滑点与 Taker 成本实时监控系统。通过抓取各交易所 orderbook 深度，模拟 Market Order 下单，计算用户实际承受的滑点 + 手续费总成本。

Real-time perpetual futures slippage and taker cost monitor. Fetches live orderbook depth, simulates market orders, and computes actual taker cost (slippage + fees) across multiple exchanges.

## Supported Exchanges

| Exchange | Type | Adapter | API | Taker Fee (Base) | Quote |
|----------|------|---------|-----|-----------------|-------|
| **Binance** | CEX | CCXT | REST | 0.05% (5 bps) | USDT |
| **Bybit** | CEX | CCXT | REST | 0.055% (5.5 bps) | USDT |
| **Hyperliquid** | DEX | CCXT | REST | 0.045% (4.5 bps) | USDC |
| **SoDEX** | DEX | Custom REST | `mainnet-gw.sodex.dev` | 0.04% (4 bps) | USD |
| **Lighter** | DEX | Custom REST | `mainnet.zklighter.elliot.ai` | 0% (0 bps) | USDC |

> Lighter adapter is included but disabled by default in config.json. Add `"lighter"` to the `exchanges` array to enable.

## Supported Pairs

| Config Name | Binance | Bybit | Hyperliquid | SoDEX | Lighter |
|-------------|---------|-------|-------------|-------|---------|
| `BTC` | BTC/USDT:USDT | BTC/USDT:USDT | BTC/USDC:USDC | BTC-USD | BTC (market_id=1) |
| `ETH` | ETH/USDT:USDT | ETH/USDT:USDT | ETH/USDC:USDC | ETH-USD | ETH (market_id=0) |
| `SOL` | SOL/USDT:USDT | SOL/USDT:USDT | SOL/USDC:USDC | SOL-USD | SOL (market_id=2) |
| `GOLD` | PAXG/USDT:USDT | XAUT/USDT:USDT | PAXG/USDC:USDC | XAUT-USD | N/A |

> GOLD 在各所映射到各自流动性最好的黄金合约（PAXG 或 XAUT）。

## Quick Start

```bash
# Install
npm install

# CLI only (terminal table, auto-refresh)
npx tsx src/index.ts

# CLI + Web Dashboard
npx tsx src/index.ts --web
# Dashboard: http://localhost:3456
```

## Configuration

### config.json

```json
{
  "pairs": ["BTC", "ETH", "SOL", "GOLD"],
  "exchanges": ["binance", "bybit", "hyperliquid", "sodex"],
  "orderSizesUSD": [10000, 50000, 100000, 500000, 1000000],
  "leverage": 10,
  "refreshIntervalMs": 10000,
  "webPort": 3456,
  "orderbookDepthLimit": 500
}
```

| Field | Description | Default |
|-------|-------------|---------|
| `pairs` | 监控的交易对代号 | BTC, ETH, SOL, GOLD |
| `exchanges` | 启用的交易所（需在 index.ts 中有对应 adapter） | binance, bybit, hyperliquid, sodex |
| `orderSizesUSD` | 模拟下单名义金额（美元） | 10K, 50K, 100K, 500K, 1M |
| `leverage` | 杠杆倍率（用于计算本金 = 名义值/杠杆） | 10 |
| `refreshIntervalMs` | 数据刷新间隔（毫秒） | 10000 |
| `webPort` | Web Dashboard HTTP 端口 | 3456 |
| `orderbookDepthLimit` | 每次请求的 orderbook 最大档位数 | 500 |

### Web Dashboard Settings

Web Dashboard 右上角 ⚙ 按钮可打开配置面板：

- **交易对**：点击切换显示/隐藏各 pair
- **交易所**：点击切换显示/隐藏各 exchange
- **下单金额**：切换预设档位、添加自定义金额（自动同步后端计算）
- **杠杆倍率**：滑动条 1x-100x，实时重算「占本金%」列

所有设置持久化到 `localStorage`，刷新不丢失。

## Architecture

```
src/
├── types.ts                  # 共享类型定义
├── config.ts                 # 读取 config.json + 默认值
├── index.ts                  # 入口：初始化 adapters → 启动 monitor → 输出
│
├── exchanges/                # 交易所适配器（统一接口 ExchangeAdapter）
│   ├── base.ts               # 公用工具：normalizeOrderbook, computeMidPrice
│   ├── ccxt-adapter.ts       # 通用 CCXT 适配器（参数化，支持 Binance/Bybit/Hyperliquid）
│   ├── lighter.ts            # Lighter 自定义 REST 适配器
│   └── sodex.ts              # SoDEX 自定义 REST 适配器
│
├── core/                     # 核心逻辑
│   ├── orderbook.ts          # 并行获取所有交易所 orderbook
│   ├── slippage.ts           # 滑点计算引擎（走 orderbook 模拟吃单）
│   └── monitor.ts            # 轮询调度（setTimeout 递归，无重叠）
│
└── output/                   # 输出层
    ├── cli.ts                # CLI 表格渲染
    └── web.ts                # Web Dashboard（HTTP server + SSE + 前端 HTML/JS/CSS）
```

### Data Flow

```
config.json
    ↓
index.ts (init adapters)
    ↓
monitor.ts → orderbook.ts → [Exchange Adapters] → fetch orderbook (parallel)
    ↓
slippage.ts → calculate per (exchange, pair, size)
    ↓
MonitorSnapshot { timestamp, results: SlippageResult[] }
    ↓
┌─────────────┬────────────────────┐
│ cli.ts      │ web.ts             │
│ (stdout)    │ (HTTP + SSE push)  │
└─────────────┴────────────────────┘
```

### Key Types

```typescript
interface ExchangeAdapter {
  name: string;
  fetchOrderbook(pair: string, limit: number): Promise<Orderbook | null>;
  getTakerFeeBps(): number;
  getSymbol(pair: string): string | null;
  getSupportedPairs(): Promise<string[]>;
  close(): Promise<void>;
}

interface SlippageResult {
  exchange: string;
  pair: string;           // config name: "BTC", "GOLD"
  symbol: string;         // exchange-specific: "BTC/USDT:USDT"
  side: 'buy' | 'sell';
  notionalUSD: number;    // simulated order size
  leverage: number;
  principalUSD: number;   // notional / leverage
  avgFillPrice: number;   // VWAP after walking orderbook
  midPrice: number;       // (best_bid + best_ask) / 2
  slippageBps: number;    // (avgFill - mid) / mid × 10000
  feeBps: number;         // exchange taker fee
  totalCostBps: number;   // slippage + fee
  costPctOfPrincipal: number; // total_cost_bps / 10000 × leverage × 100
  insufficientLiquidity: boolean;
}
```

### Cost Formula

```
slippage_bps = (avg_fill_price - mid_price) / mid_price × 10000
total_cost_bps = slippage_bps + fee_bps
cost_usd = total_cost_bps / 10000 × notional_usd
cost_pct_of_principal = total_cost_bps / 10000 × leverage × 100
```

Example: $100K notional, 10x leverage, Binance BTC
- Mid price: $73,000, Avg fill: $73,003.65 → Slippage: 0.5 bps
- Fee: 5 bps → Total: 5.5 bps
- Cost USD: $5.50
- Principal: $10,000 → Cost % of principal: 0.55%

## How to Add a New Exchange

1. Create `src/exchanges/your-exchange.ts` implementing `ExchangeAdapter` interface
2. Key methods to implement:
   - `fetchOrderbook(pair, limit)` — return `{ bids, asks, midPrice, ... }` or `null`
   - `getTakerFeeBps()` — return base tier taker fee in bps
   - `getSymbol(pair)` — map config pair name to exchange symbol
3. Register in `src/index.ts` `CCXT_CONFIGS` map:
   ```typescript
   yourexchange: () => new YourAdapter(),
   ```
4. Add to `config.json` `exchanges` array

For CCXT-supported exchanges, you can skip step 1 and just add a config entry:
```typescript
yourexchange: () => new CcxtAdapter({
  exchangeId: 'yourexchange',   // CCXT exchange ID
  name: 'YourExchange',
  pairSymbols: { BTC: 'BTC/USDT:USDT', ... },
  takerFeeBps: 5.0,
  ccxtOptions: { options: { defaultType: 'swap' } },
}),
```

## How to Add a New Trading Pair

1. In `src/index.ts`, add the pair mapping to each exchange's `pairSymbols`:
   ```typescript
   binance: () => new CcxtAdapter({
     pairSymbols: { ..., NEWPAIR: 'NEWPAIR/USDT:USDT' },
   }),
   ```
2. For custom adapters (SoDEX, Lighter), update the `PAIR_SYMBOLS` map in the adapter file
3. Add to `config.json` `pairs` array

> If a pair doesn't exist on a specific exchange, it will be skipped gracefully.

## API Endpoints (Web Dashboard)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Dashboard HTML page |
| `/api/snapshot` | GET | Latest monitor snapshot (JSON) |
| `/api/events` | GET | SSE stream, pushes snapshot on each tick |
| `/api/config` | GET | Server-side config.json |
| `/api/sizes` | POST | Sync custom order sizes from frontend `{ "sizes": [20000] }` |

## Tech Stack

- **Runtime**: Node.js 22+ / Bun
- **Language**: TypeScript (strict mode)
- **Exchange API**: [CCXT](https://github.com/ccxt/ccxt) v4+ (Binance, Bybit, Hyperliquid)
- **HTTP**: Node.js built-in `http` module (zero framework)
- **CLI Table**: [cli-table3](https://github.com/cli-table/cli-table3)
- **Dev**: [tsx](https://github.com/privatenumber/tsx) for direct TS execution

## Notes

- No API keys required — all endpoints are public orderbook data
- No actual orders are placed — read-only monitoring
- CCXT `enableRateLimit: true` handles per-exchange rate limiting
- Lighter API max depth is 200 levels (capped in adapter)
- SoDEX API max depth is 1000 levels
- Web Dashboard supports light/dark theme toggle
- Bilingual UI: Chinese (default) / English, switchable in header
