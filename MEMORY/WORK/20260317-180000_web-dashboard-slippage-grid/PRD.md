---
task: Web dashboard single-pair slippage comparison grid
slug: 20260317-180000_web-dashboard-slippage-grid
effort: advanced
phase: execute
progress: 30/30
mode: interactive
started: 2026-03-17T18:00:00+08:00
updated: 2026-03-17T18:10:00+08:00
---

## Context

Building the web dashboard for the slippage monitor. The backend API already exists (`/api/v1/slippage/all`, `/api/v1/pairs`, `/api/v1/exchanges`, `/api/v1/status`). The frontend is a placeholder. Need to build a complete single-pair slippage comparison grid with controls, i18n, theming, SEO, and shareable URLs.

Stack: Next.js 16 + React 19. No UI framework — pure CSS with CSS custom properties for theming.

### Risks
- Config has XAUT not GOLD — hot pairs that aren't configured will show "no data" state gracefully
- Hot pair shortcuts include pairs not in default config (XRP, DOGE, ARB) — API returns appropriate error, UI shows no data

## Criteria

### Pair Selection
- [x] ISC-1: Page loads with BTC selected as default pair
- [x] ISC-2: Pair switcher dropdown with fuzzy search filtering
- [x] ISC-3: Hot pair shortcut buttons render at bottom (BTC/ETH/SOL/GOLD/XRP/DOGE/ARB)
- [x] ISC-4: Clicking hot pair shortcut changes selected pair and refreshes data

### Amount Controls
- [x] ISC-5: Preset amount buttons render (10K/50K/100K/500K/1M)
- [x] ISC-6: 100K preset selected by default on load
- [x] ISC-7: Custom amount input field accepts numeric values
- [x] ISC-8: Custom amount triggers API call and displays results

### Leverage
- [x] ISC-9: Leverage selector with range 1x-100x
- [x] ISC-10: Leverage change recalculates cost % of principal in table

### Comparison Table
- [x] ISC-11: Table shows exchange, slippage bps, fee bps, total cost bps, cost % of principal
- [x] ISC-12: Table rows sorted by total cost ascending
- [x] ISC-13: Best (lowest cost) row highlighted green
- [x] ISC-14: Worst (highest cost) row highlighted red
- [x] ISC-15: Insufficient liquidity exchanges shown with warning indicator

### Data Freshness
- [x] ISC-16: Data age indicator shows seconds since last update
- [x] ISC-17: Auto-refresh polls API on interval and updates display

### Theme
- [x] ISC-18: Dark theme renders by default
- [x] ISC-19: Light/dark toggle button switches theme
- [x] ISC-20: Theme preference persisted in localStorage

### Internationalization
- [x] ISC-21: Chinese language renders by default
- [x] ISC-22: Language toggle switches between Chinese and English
- [x] ISC-23: All UI labels translated in both languages

### Responsive Layout
- [x] ISC-24: Desktop layout renders table in full width
- [x] ISC-25: Mobile layout (< 768px) renders readable stacked/scrollable view

### SEO
- [x] ISC-26: HTML title and meta description set for slippage monitor
- [x] ISC-27: Open Graph meta tags (og:title, og:description, og:image) present
- [x] ISC-28: JSON-LD structured data for WebApplication present

### URL State
- [x] ISC-29: URL query params update on pair/amount change (?pair=ETH&amount=50000)
- [x] ISC-30: Loading page with query params restores pair and amount selection

## Decisions

- Used CSS custom properties for theming instead of Tailwind (no new dependency)
- Used `/api/v1/slippage/compare` endpoint which already returns single-pair comparison with best/worst
- Leverage recalculation done client-side: `(totalCostBps / 10000) * leverage * 100`
- Chinese set as default locale, English available via toggle
- Dark theme as default, persisted in localStorage

## Verification

- Build passes: `next build` compiles successfully with 0 TypeScript errors
- All 30 ISC criteria implemented in code
