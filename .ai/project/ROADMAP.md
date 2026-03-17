# Roadmap

## Current Phase
- name: v2 Development
- goal: Transform v1 internal CLI tool into a public web platform with REST API
- status: PRD complete, implementation not started

## v1 (Complete)
- Local CLI + web dashboard monitoring tool
- 5 exchanges: Binance, Bybit, Hyperliquid, SoDEX, Lighter
- 4 pairs: BTC, ETH, SOL, GOLD
- Preset order sizes with real-time refresh
- Web dashboard with SSE live updates, theme/language toggle

## v2 (In Progress — PRD stage)

### Backend
- [ ] Next.js project setup, migrate core modules from v1
- [ ] Data Collector: node-cron timed fetch (5 min) + in-memory cache
- [ ] Pre-compute slippage for preset amounts ($10K/$50K/$100K/$500K/$1M)
- [ ] API Routes: /slippage/compare, /slippage/all, /exchanges, /pairs, /status
- [ ] Custom amount API: compute on-demand from cached orderbooks (<1ms)
- [ ] Rate limiting middleware (60 req/min per IP)
- [ ] CORS, error standardization, structured logging

### Frontend
- [ ] Single-pair view (default BTC) + pair switcher/search
- [ ] Slippage comparison grid (sorted by total cost, best/worst highlighted)
- [ ] Preset amount buttons + custom amount input
- [ ] Leverage selector, hot pair shortcuts
- [ ] Data freshness indicator
- [ ] Light/dark theme + Chinese/English toggle
- [ ] Responsive mobile layout
- [ ] SEO (meta tags, OG image, structured data)
- [ ] Shareable URL with query params (?pair=ETH&amount=50000)

### API Documentation (/docs)
- [ ] Interactive API explorer (Try it buttons)
- [ ] Code examples: Python / JavaScript / curl
- [ ] Rate limit docs + error codes
- [ ] OpenAPI/Swagger YAML spec download

### Exchange Expansion
- [ ] Migrate v1 adapters: Binance, Bybit, Hyperliquid, SoDEX
- [ ] New (Phase 2): Aster, EdgeX (custom adapters)
- [ ] New (Phase 2): Bitget, MEXC, OKX (CCXT fast onboarding)

### Deployment
- [ ] VPS + PM2
- [ ] Domain + HTTPS
- [ ] Zero-downtime deploy (PM2 reload)
- [ ] Monitoring and alerting (uptime + exchange health)

## Deferred (Explicitly Not Now)
- API Key authentication tier (deferred until >1000 DAU)
- Spot market support (perps only for now)
- Historical data / time-series storage
- User accounts / preferences persistence
- WebSocket streaming (SSE sufficient for 5-min refresh cycle)
- Mobile native app
