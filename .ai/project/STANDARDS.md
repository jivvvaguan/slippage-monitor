# Quality Standards

## Code Style
- TypeScript strict mode, no `any` types
- ES modules (`"type": "module"` in package.json)
- Named exports preferred over default exports
- Interfaces over type aliases for data shapes

## Exchange Adapter Standards
- Every adapter must implement `ExchangeAdapter` interface completely
- `fetchOrderbook()` must return `null` on failure, never throw
- `getSymbol()` returns `null` for unsupported pairs — caller handles gracefully
- Orderbook `bids` must be descending by price, `asks` ascending
- All prices and amounts as native `number` (not string)

## Error Handling
- Exchange fetch failures: log warning, return null, continue with other exchanges
- Never let a single exchange failure crash the monitor loop
- API responses: standardized `{ error: string, message: string }` on failure
- HTTP status codes: 400 (bad request), 404 (pair not found), 429 (rate limit), 500 (internal)

## Naming Conventions
- Files: kebab-case (`ccxt-adapter.ts`, `slippage.ts`)
- Interfaces: PascalCase (`ExchangeAdapter`, `SlippageResult`)
- Functions: camelCase (`fetchOrderbook`, `computeMidPrice`)
- Config pair names: UPPERCASE (`BTC`, `ETH`, `GOLD`)
- Exchange identifiers: lowercase (`binance`, `sodex`, `lighter`)

## Testing Approach
- No test framework currently — v1 is tested via live CLI observation
- v2 should add unit tests for slippage engine (pure function, easy to test)
- Exchange adapters tested via integration (real API calls in dev)

## Performance Standards
- Slippage computation: < 1ms per (exchange × pair × amount)
- Orderbook normalization: < 0.1ms per orderbook
- API response (pre-computed): < 50ms
- API response (custom amount): < 100ms
- No blocking I/O in the computation path

## Anti-patterns
- Never hardcode exchange API URLs in adapters — use config or CCXT defaults
- Never store exchange API keys — all endpoints are public
- Never place real orders — read-only monitoring only
- Never block the event loop with synchronous computation over large datasets
- Never cache stale data without age indication — always expose `data_age_seconds`
