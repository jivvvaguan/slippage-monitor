# Slippage Monitor v2 — Product Requirements Document

> **Status**: Draft
> **Author**: Zhiwen / PAI
> **Date**: 2026-03-17
> **Version**: 2.0

---

## 1. Overview

### 1.1 背景

v1 是一个本地运行的内部工具，轮询 5 个交易所的永续合约 orderbook 深度，为预设的下单金额计算滑点。它是单用户的、预计算固定金额的、没有公开 API。

### 1.2 v2 愿景

打造一个**公开的永续合约滑点比较平台**，任何用户都可以：
- 实时查看各交易所、各交易对的 Perps 滑点成本对比
- 输入**任意下单金额**，即时看到各所滑点对比
- 通过 API 接口调用滑点数据（AI Agent / 量化开发者）

### 1.3 市场机会

**竞品调研结论：当前市场上不存在公开的跨交易所永续合约滑点对比工具。**

- Kaiko、CoinMetrics 提供企业级 API（$5K+/月），但没有消费者产品
- 没有任何公开工具让散户或小型量化团队一目了然地对比各所滑点成本
- 这是一个明确的市场空白

### 1.4 核心洞察

> **Orderbook 是共享资源（获取成本高，所有用户相同），滑点计算是用户函数（极其廉价，<1ms）。**

因此架构策略：后端只负责抓取和缓存 orderbook + 预计算常见金额的滑点结果。自定义金额通过 API 即时计算（读缓存 orderbook，<1ms）。这消除了每用户的服务器计算负载。

---

## 2. 用户画像

| 用户类型 | 需求 | 访问方式 |
|---------|------|---------|
| **散户交易者** | 下单前看看哪个所滑点最低 | Web Dashboard |
| **量化开发者** | 集成到交易策略中，动态选择最优执行所 | REST API |
| **AI Agent** | 自动查询滑点成本，辅助交易决策 | REST API |
| **做市商/机构** | 评估各所深度质量 | Web + API |
| **KOL/分析师** | 引用数据做内容 | Web（截图分享） |

---

## 3. 功能需求

### 3.1 Web Dashboard

#### 3.1.1 主页面 — 滑点对比网格

```
┌─────────────────────────────────────────────────────┐
│  Perps Slippage Monitor     [EN] [🌙] ● 实时 10:32  │
│  下单金额: [$10K] [$50K] [$100K✓] [$500K] [$1M]    │
│  自定义: [________] [计算]    杠杆: [10x ▼]         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  BTC-PERP                                           │
│  ┌──────────┬────────┬────────┬────────┬──────────┐ │
│  │ 交易所   │ 滑点   │ 手续费 │ 总成本  │ 成本金额 │ │
│  ├──────────┼────────┼────────┼────────┼──────────┤ │
│  │ HL ✓Best │ 0.07   │ 4.5    │ 4.57   │ $45.70   │ │
│  │ Binance  │ 0.01   │ 5.0    │ 5.01   │ $50.10   │ │
│  │ Bybit    │ 0.01   │ 5.5    │ 5.51   │ $55.10   │ │
│  │ SoDEX    │ 1.20   │ 4.0    │ 5.20   │ $52.00   │ │
│  └──────────┴────────┴────────┴────────┴──────────┘ │
│                                                     │
│  ETH-PERP                                           │
│  [同上结构]                                          │
│                                                     │
│  SOL-PERP    GOLD-PERP                              │
│  [同上]      [同上]                                  │
└─────────────────────────────────────────────────────┘
```

**核心交互：**
- 预设金额按钮：$10K / $50K / $100K（默认）/ $500K / $1M
- 自定义金额输入：用户输入任意 USD 金额 → 调用 API → 即时显示结果
- 杠杆下拉：1x-100x，影响「占本金%」的显示
- 交易所/交易对筛选
- 最优/最差高亮（绿/红）
- 数据时效指示：「数据更新于 X 分钟前」

#### 3.1.2 设计要求
- 默认白色主题，支持暗色主题切换
- 中文（默认）/ English 切换
- 响应式适配移动端
- 页面可截图分享（适合 KOL 引用）

### 3.2 公开 API

#### 3.2.1 Endpoints

```
GET  /api/v1/exchanges
GET  /api/v1/pairs
GET  /api/v1/slippage?pair=BTC&amount=100000
GET  /api/v1/slippage/compare?pair=BTC&amount=100000
GET  /api/v1/slippage/all?amount=100000
GET  /api/v1/status
```

#### 3.2.2 核心 API 详细设计

**GET /api/v1/slippage/compare?pair=BTC&amount=100000**

请求参数：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `pair` | string | 是 | 交易对代号：BTC, ETH, SOL, GOLD |
| `amount` | number | 是 | 下单名义金额（USD） |
| `leverage` | number | 否 | 杠杆倍率，默认 10 |
| `side` | string | 否 | buy 或 sell，默认 buy |

响应示例：

```json
{
  "pair": "BTC",
  "amount": 100000,
  "leverage": 10,
  "side": "buy",
  "timestamp": "2026-03-17T10:30:00Z",
  "data_age_seconds": 45,
  "next_refresh_seconds": 255,
  "results": [
    {
      "exchange": "Hyperliquid",
      "mid_price": 73042.5,
      "avg_fill_price": 73043.01,
      "slippage_bps": 0.07,
      "fee_bps": 4.5,
      "total_cost_bps": 4.57,
      "cost_usd": 45.70,
      "cost_pct_of_principal": 0.457,
      "sufficient_liquidity": true
    },
    {
      "exchange": "Binance",
      "mid_price": 73043.15,
      "avg_fill_price": 73043.88,
      "slippage_bps": 0.10,
      "fee_bps": 5.0,
      "total_cost_bps": 5.10,
      "cost_usd": 51.00,
      "cost_pct_of_principal": 0.510,
      "sufficient_liquidity": true
    }
  ],
  "best_exchange": "Hyperliquid",
  "worst_exchange": "SoDEX"
}
```

**GET /api/v1/slippage/all?amount=100000**

一次返回所有交易对 × 所有交易所的滑点对比（批量查询）。

**GET /api/v1/exchanges**

```json
{
  "exchanges": [
    {
      "id": "binance",
      "name": "Binance",
      "type": "CEX",
      "taker_fee_bps": 5.0,
      "quote_currency": "USDT",
      "supported_pairs": ["BTC", "ETH", "SOL", "GOLD"],
      "status": "online",
      "last_update": "2026-03-17T10:30:00Z"
    }
  ]
}
```

**GET /api/v1/status**

```json
{
  "status": "healthy",
  "exchanges": {
    "binance": { "status": "online", "last_success": "2026-03-17T10:30:00Z", "latency_ms": 230 },
    "bybit": { "status": "online", "last_success": "2026-03-17T10:30:00Z", "latency_ms": 180 },
    "hyperliquid": { "status": "online", "last_success": "2026-03-17T10:30:00Z", "latency_ms": 150 },
    "sodex": { "status": "degraded", "last_success": "2026-03-17T10:25:00Z", "latency_ms": 2100 }
  },
  "cache_refresh_interval_seconds": 300,
  "next_refresh": "2026-03-17T10:35:00Z"
}
```

#### 3.2.3 API 策略

| 层级 | 认证 | 限流 | 适用 |
|------|------|------|------|
| **公开层** | 无需认证 | 60 req/min per IP | 散户浏览、轻量调用 |
| **API Key（后续）** | 免费注册 | 300 req/min per key | AI Agent、量化开发者 |

> v2 初版只做公开层（IP 限流）。API Key 机制在用户量超过 1000 DAU 后启用。

#### 3.2.4 API 文档

- OpenAPI / Swagger spec
- 交互式 API Explorer（try-it-out）
- 代码示例：Python、JavaScript、curl
- 访问路径：`/docs` 或 `/api-docs`

---

## 4. 技术架构

### 4.1 架构决策（来自 Council 共识）

| 决策 | 选择 | 理由 |
|------|------|------|
| **框架** | Next.js | 全栈 SSR，API Routes 内置，v1 TypeScript 可复用，SEO 友好 |
| **数据策略** | 后端预计算 + 按需 API | 减少前端复杂度，保护原始数据，缓存友好 |
| **API 认证** | 初期无认证 + IP 限流 | 零摩擦，先获取用户，后续再加 API Key |
| **部署** | VPS + PM2 | $6/月，足够 <10K DAU，简单可靠 |

### 4.2 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                         VPS ($6/mo)                         │
│                                                             │
│  ┌──────────────────┐     ┌───────────────────────────────┐ │
│  │  Data Collector   │     │        Next.js App            │ │
│  │  (node-cron)      │     │                               │ │
│  │                   │     │  ┌─────────┐  ┌────────────┐ │ │
│  │  Every 5 min:     │────▶│  │ In-mem  │  │ API Routes │ │ │
│  │  fetch orderbooks │     │  │ Cache   │──│            │ │ │
│  │  from 4 exchanges │     │  │         │  │ /api/v1/*  │ │ │
│  │  compute slippage │     │  └─────────┘  └────────────┘ │ │
│  │  for preset amts  │     │                               │ │
│  └──────────────────┘     │  ┌─────────────────────────┐  │ │
│                            │  │     Frontend (React)     │  │ │
│                            │  │  - Comparison grid       │  │ │
│                            │  │  - Custom amount input   │  │ │
│                            │  │  - Exchange/pair filters  │  │ │
│                            │  └─────────────────────────┘  │ │
│                            └───────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ↑
                    Users (Web) + AI Agents (API)
```

### 4.3 数据流

```
Exchange APIs (Binance, Bybit, Hyperliquid, SoDEX)
     ↓  (每 5 分钟轮询)
Orderbook Snapshots (in-memory cache, 16 pairs × exchanges)
     ↓
Pre-compute Slippage (preset amounts: $10K, $50K, $100K, $500K, $1M)
     ↓
Cache Results (in-memory, keyed by exchange+pair+amount)
     ↓
┌────────────────────────────────────┐
│ Serve:                             │
│  - Pre-computed → instant response │
│  - Custom amount → read orderbook  │
│    cache + compute on-demand (<1ms)│
└────────────────────────────────────┘
```

### 4.4 缓存策略

| 数据 | 缓存位置 | TTL | 刷新策略 |
|------|---------|-----|---------|
| 原始 Orderbook | Server in-memory | 5 min | 定时轮询覆盖 |
| 预计算滑点结果 | Server in-memory | 5 min | 随 orderbook 刷新重算 |
| API 响应 | HTTP Cache-Control | 60s | `max-age=60, stale-while-revalidate=300` |

**数据时效性展示：**
- API 响应包含 `data_age_seconds` 和 `next_refresh_seconds`
- 前端显示「数据更新于 X 分钟前」
- 超过 10 分钟无更新的交易所标记为 `degraded`

### 4.5 项目结构（Next.js）

```
slippage-monitor-v2/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # Dashboard 主页
│   │   ├── layout.tsx          # Root layout (theme, lang)
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── exchanges/route.ts
│   │   │       ├── pairs/route.ts
│   │   │       ├── slippage/route.ts
│   │   │       ├── slippage/compare/route.ts
│   │   │       ├── slippage/all/route.ts
│   │   │       ├── status/route.ts
│   │   │       └── docs/route.ts
│   │   └── docs/page.tsx       # API 文档页面
│   │
│   ├── components/             # React 组件
│   │   ├── SlippageGrid.tsx    # 滑点对比网格
│   │   ├── AmountSelector.tsx  # 金额选择器 + 自定义输入
│   │   ├── ExchangeFilter.tsx  # 交易所筛选
│   │   ├── PairTabs.tsx        # 交易对切换
│   │   ├── FreshnessBadge.tsx  # 数据时效指示
│   │   └── ThemeLangToggle.tsx # 主题/语言切换
│   │
│   ├── lib/                    # 共享逻辑
│   │   ├── exchanges/          # 交易所适配器（从 v1 迁移）
│   │   │   ├── types.ts
│   │   │   ├── ccxt-adapter.ts
│   │   │   ├── sodex.ts
│   │   │   └── lighter.ts
│   │   ├── slippage.ts         # 滑点计算引擎（从 v1 迁移）
│   │   ├── cache.ts            # 缓存管理器
│   │   ├── collector.ts        # 数据采集调度
│   │   └── config.ts           # 配置
│   │
│   └── i18n/                   # 国际化
│       ├── zh.ts
│       └── en.ts
│
├── public/
│   └── og-image.png            # 社交分享图
├── next.config.js
├── package.json
└── ecosystem.config.js         # PM2 配置
```

---

## 5. 交易所支持

### 5.1 v2 支持矩阵

| Exchange | Type | Adapter | Taker Fee | Quote | GOLD 映射 |
|----------|------|---------|-----------|-------|-----------|
| Binance | CEX | CCXT | 5.0 bps | USDT | PAXG |
| Bybit | CEX | CCXT | 5.5 bps | USDT | XAUT |
| Hyperliquid | DEX | CCXT | 4.5 bps | USDC | PAXG |
| SoDEX | DEX | Custom | 4.0 bps | USD | XAUT |

> Lighter 保留 adapter 代码但默认关闭。可在 config 中启用。

### 5.2 新增交易所流程

1. 实现 `ExchangeAdapter` 接口（或使用 `CcxtAdapter` 配置）
2. 在 `collector.ts` 注册
3. 在配置中添加费率和 pair 映射
4. 无需改前端 — 自动显示

---

## 6. 非功能需求

### 6.1 性能

| 指标 | 目标 |
|------|------|
| 预计算滑点 API 响应 | < 50ms |
| 自定义金额 API 响应 | < 100ms |
| 页面首屏加载 | < 2s |
| 并发支持 | 1000+ 同时在线 |
| Orderbook 刷新 | 每 5 分钟 |

### 6.2 可用性

| 指标 | 目标 |
|------|------|
| 服务 SLA | 99.5%（允许单交易所降级） |
| 单交易所故障 | 不影响其他所展示 |
| 部署中断 | 零停机（PM2 reload） |

### 6.3 安全

- 无用户数据存储
- 无 API Key 存储（v2 初版）
- 无交易所 API Key（纯公开数据）
- Rate limiting 防止 DDoS

---

## 7. 迭代计划

### Phase 1: 核心功能（1-2 周）

- [ ] Next.js 项目搭建，从 v1 迁移核心模块
- [ ] Data Collector：定时抓取 + 缓存
- [ ] API Routes：/slippage/compare、/slippage/all、/exchanges、/pairs、/status
- [ ] 前端：滑点对比网格 + 预设金额选择器
- [ ] 部署到 VPS + PM2

### Phase 2: 用户体验（1 周）

- [ ] 自定义金额输入 + 即时计算
- [ ] 交易所/交易对筛选
- [ ] 杠杆选择器
- [ ] 数据时效指示
- [ ] 明暗主题 + 中英文
- [ ] 响应式移动端适配

### Phase 3: API 产品化（1 周）

- [ ] OpenAPI spec + Swagger UI at /docs
- [ ] 代码示例 (Python / JS / curl)
- [ ] Rate limiting middleware
- [ ] CORS 配置
- [ ] 错误响应标准化

### Phase 4: 增长（持续）

- [ ] SEO 优化（meta tags、OG image）
- [ ] 分享功能（URL 带参数，可分享特定对比）
- [ ] API Key 注册系统（当 DAU > 1000）
- [ ] 新增交易所（OKX、dYdX、Aster 等）
- [ ] 历史数据存储 + 趋势图（v3 scope）

---

## 8. 关键决策记录

| # | 决策 | 选择 | 备选 | 理由 |
|---|------|------|------|------|
| 1 | 框架 | Next.js | Hono+Workers, Vanilla Node | 全栈统一、API Routes 内置、SSR/SEO、TypeScript 原生 |
| 2 | 数据策略 | 预计算 + 按需 API | 全量 orderbook 下发 | 减少前端复杂度、保护原始数据、payload 小、缓存友好 |
| 3 | API 认证 | 初期无认证 + IP 限流 | 强制 API Key | 零摩擦获取用户、不需要用户系统、后续再加 |
| 4 | 部署 | VPS + PM2 | Docker Compose, CF Workers | 最低成本（$6/月）、足够 10K DAU、简单可靠 |
| 5 | 缓存 | 内存 + HTTP Cache-Control | Redis, SQLite | 数据量小（~400KB）、无持久化需求、零依赖 |
| 6 | Scope | 仅 Perps | Perps + Spot | 聚焦、差异化、减少工程量 |

---

## 9. 成功指标

| 指标 | 目标（上线 3 个月） |
|------|-------------------|
| DAU | > 500 |
| API 日调用量 | > 5,000 |
| 支持交易所数 | ≥ 5 |
| API 文档完整度 | OpenAPI spec + 3 语言示例 |
| 服务可用性 | > 99.5% |

---

## 10. 风险与缓解

| 风险 | 影响 | 概率 | 缓解 |
|------|------|------|------|
| 交易所 API 变更 | 数据中断 | 中 | CCXT 社区维护、降级展示 |
| 大量 API 滥用 | 服务器过载 | 低 | IP 限流 + 后续 API Key |
| 竞品出现 | 市场份额 | 低 | 先发优势、免费定位 |
| VPS 故障 | 服务中断 | 低 | PM2 自动重启、监控告警 |
| 数据准确性质疑 | 用户信任 | 中 | 显示数据时效、开源计算逻辑 |

---

## 附录 A: v1 → v2 迁移清单

| v1 模块 | v2 位置 | 变更 |
|---------|---------|------|
| `src/types.ts` | `src/lib/exchanges/types.ts` | 新增 `pair` 字段（已有） |
| `src/exchanges/ccxt-adapter.ts` | `src/lib/exchanges/ccxt-adapter.ts` | 直接复用 |
| `src/exchanges/sodex.ts` | `src/lib/exchanges/sodex.ts` | 直接复用 |
| `src/exchanges/lighter.ts` | `src/lib/exchanges/lighter.ts` | 直接复用 |
| `src/core/slippage.ts` | `src/lib/slippage.ts` | 直接复用 |
| `src/core/orderbook.ts` | `src/lib/collector.ts` | 重构为定时任务 |
| `src/core/monitor.ts` | `src/lib/collector.ts` | 合并到 collector |
| `src/output/web.ts` | 废弃 | Next.js 前端替代 |
| `src/output/cli.ts` | 保留为 dev 工具 | 可选 |
| `config.json` | `src/lib/config.ts` | 硬编码 + env vars |

## 附录 B: API Rate Limit 设计

```
# 初期：基于 IP 的简单限流
Rate Limit: 60 requests per minute per IP
Headers:
  X-RateLimit-Limit: 60
  X-RateLimit-Remaining: 57
  X-RateLimit-Reset: 1679044200

# 超限响应
HTTP 429 Too Many Requests
{
  "error": "rate_limit_exceeded",
  "message": "Rate limit of 60 requests per minute exceeded",
  "retry_after_seconds": 23
}
```

## 附录 C: 竞品参考

| 产品 | 类型 | 滑点功能 | 价格 | 差异 |
|------|------|---------|------|------|
| Kaiko | 企业 API | 有（slippage endpoint） | $5K+/月 | 仅 API、企业定价 |
| CoinMetrics | 企业 API | 有（liquidity metrics） | 企业定价 | 仅 API |
| Amberdata | 企业数据 | 有（orderbook metrics） | 企业定价 | 无消费者产品 |
| CoinGecko | 公开 | 无滑点 | 免费 | 只有价格/市值 |
| **Slippage Monitor v2** | **公开工具** | **跨所对比** | **免费** | **唯一消费者产品** |
