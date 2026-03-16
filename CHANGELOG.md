# Changelog

All notable changes to this project are documented in this file.

## [1.0.0] - 2026-03-16

### Initial Release

**Core System**
- Slippage calculation engine: walks orderbook depth, computes VWAP, derives slippage in bps
- Parallel orderbook fetching across all exchanges via `Promise.all`
- Polling monitor loop with configurable interval (default 10s)
- Graceful shutdown on SIGINT/SIGTERM

**Exchange Adapters**
- `CcxtAdapter`: unified parameterized adapter for CCXT-supported exchanges
  - Binance USDT-M Perps (taker fee 5 bps)
  - Bybit USDT Perps (taker fee 5.5 bps)
  - Hyperliquid Perps (taker fee 4.5 bps)
- `LighterAdapter`: custom REST adapter for Lighter DEX (zero fee)
  - API: `mainnet.zklighter.elliot.ai/api/v1`
  - Orderbook limit capped at 200 (API constraint)
  - Auto-loads market metadata from `/orderBooks` endpoint
  - Retry-safe: failed meta load doesn't permanently block
- `SodexAdapter`: custom REST adapter for SoDEX Perps (taker fee 4 bps)
  - API: `mainnet-gw.sodex.dev/futures/fapi/market/v1/public`
  - Depth endpoint: `/m/depth?symbol=BTC-USD&size=N`
  - Handles scientific notation in price strings (e.g., "7.312E+4")

**GOLD Pair Mapping**
- Unified under config name `GOLD`, each exchange maps to its most liquid gold contract:
  - Binance → PAXG/USDT (only gold perp available)
  - Bybit → XAUT/USDT (better liquidity than PAXG on Bybit)
  - Hyperliquid → PAXG/USDC (only gold perp available)
  - SoDEX → XAUT-USD

**Output: CLI**
- Terminal table with auto-refresh (clears screen each tick)
- Chinese column headers
- Columns: 交易所, 中间价, 成交均价, 滑点(bps), 手续费(bps), 总成本(bps), 成本金额, 占本金%, 流动性
- Flag `--web` or `-w` to enable Web Dashboard alongside CLI

**Output: Web Dashboard**
- Single-page app served via built-in Node HTTP server (no framework)
- Real-time updates via Server-Sent Events (SSE)
- Light theme (default) / Dark theme toggle
- Chinese (default) / English language toggle
- Best cost row highlighted green, worst highlighted red
- Responsive layout for mobile

**Web Dashboard: Global Size Selector**
- Sticky bar below header with size buttons: $10K, $50K, $100K (default), $500K, $1M
- "Expand All" toggle to view all size tiers simultaneously
- Sizes formatted as $10K / $1M (not $10,000 / $1,000,000)

**Web Dashboard: Settings Panel**
- Side-sliding panel opened via ⚙ button
- **Pairs**: chip toggles for each configured pair (BTC, ETH, SOL, GOLD)
- **Exchanges**: chip toggles for each exchange
- **Order Sizes**: chip toggles for preset sizes + custom amount input
  - Custom sizes sync to backend via `POST /api/sizes`
  - Loading spinner shown while backend computes new size data
- **Leverage**: slider 1x-100x, real-time recalculation of cost % of principal
- All preferences saved to `localStorage`

**Configuration**
- `config.json` for server-side defaults (pairs, exchanges, sizes, leverage, refresh)
- Web Dashboard settings override display filtering client-side
- Custom sizes dynamically merged into backend calculation loop

### Development Notes

**Architecture decisions:**
- CCXT adapters unified into single `CcxtAdapter` class (vs 3 separate files) — eliminates ~210 lines of duplication
- Web dashboard is a single inline HTML string in `web.ts` — no build step, no static files, zero dependencies
- Monitor uses `setTimeout` recursion (not `setInterval`) — no overlapping ticks if API is slow
- `pair` field added to `SlippageResult` for display grouping (vs parsing exchange symbol)

**Fee rate verification (2026-03-16):**
- Binance: 0.05% confirmed via official fee page
- Bybit: 0.055% confirmed via official fee structure
- Hyperliquid: 0.045% confirmed via Tier 0 Fee Schedule screenshot
- SoDEX: 0.04% per internal specification
- Lighter: 0% (standard account) confirmed via official docs

**Known limitations:**
- Only simulates buy-side (ask) slippage — sell-side code exists but not exposed in UI
- Orderbook snapshot is point-in-time REST fetch, not streaming WebSocket
- Custom sizes need one polling cycle (~10s) to show data after adding
- Lighter is disabled by default (add to config.json to enable)
- No historical data storage — purely real-time monitoring

### Iteration Log

Below is the complete development iteration history:

| # | Change | Reason |
|---|--------|--------|
| 1 | Project scaffold + 4 exchange adapters | Initial build |
| 2 | Lighter adapter API fix: `market_id` param, limit cap 200 | API returned 400 on limit>200 |
| 3 | Unified 3 CCXT adapters into `CcxtAdapter` | /simplify review: 95% code duplication |
| 4 | Fixed Lighter `loadMeta()` permanent failure bug | metaLoaded set true on error → never retried |
| 5 | Binance taker fee corrected: 4.5 → 5.0 bps | Research agent confirmed 0.05% |
| 6 | Hyperliquid taker fee corrected: 3.5 → 4.5 bps | User provided Fee Schedule screenshot |
| 7 | All fees verified via parallel research agents | Binance 5, Bybit 5.5, Hyperliquid 4.5, Lighter 0 |
| 8 | Added SoDEX exchange (initially hit spot API) | User request |
| 9 | SoDEX switched from spot `/pro/p/quotation/depth` to futures `/futures/fapi/market/v1/public/m/depth` | User noticed mid-price mismatch |
| 10 | Bilingual UI (Chinese/English) | User request |
| 11 | Language toggle: both → single language only | User preferred clean single-language display |
| 12 | Added absolute cost column (成本金额 in USD) | User request |
| 13 | Removed depth column | User decided it wasn't needed |
| 14 | Web Dashboard redesign: light theme, card layout | User wanted cleaner design |
| 15 | Removed Lighter from default config | User request |
| 16 | XAUT/PAXG unified under GOLD display name | User request: each exchange uses best gold pair |
| 17 | Global size selector bar + $1M option | User wanted unified control across all pairs |
| 18 | Settings panel: pairs/exchanges/sizes/leverage | User wanted flexible configuration |
| 19 | Custom size sync to backend + loading spinner | Custom sizes had no data until backend computed |
