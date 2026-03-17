---
task: Build interactive API docs page with explorer
slug: 20260317-200000_api-docs-page-interactive-explorer
effort: advanced
phase: verify
progress: 26/26
mode: interactive
started: 2026-03-17T20:00:00+08:00
updated: 2026-03-17T20:00:10+08:00
---

## Context

Build a comprehensive /docs page for the Slippage Monitor API. The page documents 5 REST endpoints with interactive try-it functionality, code examples in 3 languages, rate limit/error reference, methodology explanation, and a downloadable OpenAPI spec. Must match existing dark theme and CSS variable system. No external UI libraries — pure CSS consistent with globals.css patterns.

### Risks
- Interactive Try It may fail if API returns errors due to data collector not running — must handle gracefully
- OpenAPI YAML must stay in sync with actual endpoint implementations
- Code examples must be accurate and tested against real endpoints

### Plan
1. Create OpenAPI YAML spec file (static asset in /public)
2. Build /docs page as Next.js page with client components for interactivity
3. Implement endpoint documentation sections with Try It panels
4. Add code example components with language toggle
5. Add reference sections (rate limits, errors, methodology)
6. Add download link for OpenAPI spec
7. Add CSS for docs page matching existing theme

## Criteria

- [x] ISC-1: /docs route renders a dedicated documentation page
- [x] ISC-2: Page header shows API title and version info
- [x] ISC-3: GET /api/v1/status endpoint documented with description
- [x] ISC-4: GET /api/v1/exchanges endpoint documented with description
- [x] ISC-5: GET /api/v1/pairs endpoint documented with description
- [x] ISC-6: GET /api/v1/slippage/all endpoint documented with params
- [x] ISC-7: GET /api/v1/slippage/compare endpoint documented with params
- [x] ISC-8: Each endpoint shows request parameters table
- [x] ISC-9: Each endpoint shows example response JSON
- [x] ISC-10: Try It button present on each endpoint section
- [x] ISC-11: Try It panel accepts parameter inputs for parameterized endpoints
- [x] ISC-12: Try It panel executes live GET request on submit
- [x] ISC-13: Try It panel displays formatted JSON response
- [x] ISC-14: Try It panel shows error state on request failure
- [x] ISC-15: Python code example shown for each endpoint
- [x] ISC-16: JavaScript code example shown for each endpoint
- [x] ISC-17: curl code example shown for each endpoint
- [x] ISC-18: Language toggle switches between Python/JS/curl examples
- [x] ISC-19: Rate limit section documents 60 req/min per IP limit
- [x] ISC-20: Rate limit section documents X-RateLimit-* response headers
- [x] ISC-21: Error codes section documents 400/404/429/500 responses
- [x] ISC-22: Error response format documented with example JSON
- [x] ISC-23: Data source section explains orderbook-based methodology
- [x] ISC-24: Calculation methodology explains slippage/fee/total cost formula
- [x] ISC-25: OpenAPI YAML spec file exists at /openapi.yaml
- [x] ISC-26: Download link for OpenAPI spec visible on docs page
- [x] ISC-A-1: Anti: existing dashboard page must not be broken
- [x] ISC-A-2: Anti: no external UI component libraries added

## Decisions

- 2026-03-17 20:00: Using client-side React components for Try It interactivity, not a separate API testing tool
- 2026-03-17 20:00: OpenAPI spec as static YAML in /public, not generated at runtime
- 2026-03-17 20:00: All docs content in single page with anchor navigation, not multi-page
