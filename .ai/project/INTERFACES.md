# Interface Contracts

## Core Interface: ExchangeAdapter

```typescript
interface ExchangeAdapter {
  name: string;
  fetchOrderbook(pair: string, limit: number): Promise<Orderbook | null>;
  getTakerFeeBps(): number;
  getSymbol(pair: string): string | null;
  getSupportedPairs(): Promise<string[]>;
  close(): Promise<void>;
}
```

All exchange adapters implement this interface. The core engine only depends on this contract.

## Data Types

```typescript
interface Orderbook {
  exchange: string;
  symbol: string;
  asks: OrderbookEntry[];  // ascending by price
  bids: OrderbookEntry[];  // descending by price
  timestamp: number;
  midPrice: number;
}

interface OrderbookEntry {
  price: number;
  amount: number;  // base currency
}

interface SlippageResult {
  exchange: string;
  pair: string;            // config name: "BTC", "GOLD"
  symbol: string;          // exchange-specific: "BTC/USDT:USDT"
  side: 'buy' | 'sell';
  notionalUSD: number;
  leverage: number;
  principalUSD: number;
  avgFillPrice: number;
  midPrice: number;
  slippageBps: number;
  feeBps: number;
  totalCostBps: number;
  costPctOfPrincipal: number;
  filledQty: number;
  orderbookDepthUsed: number;
  insufficientLiquidity: boolean;
}

interface MonitorSnapshot {
  timestamp: number;
  results: SlippageResult[];
}
```

## v1 Internal API (Web Dashboard)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Dashboard HTML page (inline JS/CSS) |
| `/api/snapshot` | GET | Latest `MonitorSnapshot` as JSON |
| `/api/events` | GET | SSE stream, pushes snapshot each tick |
| `/api/config` | GET | Server-side `config.json` |
| `/api/sizes` | POST | Sync custom order sizes `{ "sizes": [20000] }` |

## v2 Public API (Planned)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/exchanges` | GET | List supported exchanges with fees and status |
| `/api/v1/pairs` | GET | List supported trading pairs |
| `/api/v1/slippage/compare` | GET | Cross-exchange slippage comparison for one pair + amount |
| `/api/v1/slippage/all` | GET | All pairs × all exchanges batch query |
| `/api/v1/slippage` | GET | Single pair + exchange query |
| `/api/v1/status` | GET | System health + per-exchange latency and status |

### v2 API Query Parameters

**GET /api/v1/slippage/compare**

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `pair` | string | yes | — | Pair code: BTC, ETH, SOL, GOLD |
| `amount` | number | yes | — | Notional order size in USD |
| `leverage` | number | no | 10 | Leverage multiplier |
| `side` | string | no | buy | `buy` or `sell` |

### v2 API Response Format

All responses follow:
```json
{
  "pair": "BTC",
  "amount": 100000,
  "timestamp": "ISO-8601",
  "data_age_seconds": 45,
  "results": [ SlippageResult[] ],
  "best_exchange": "...",
  "worst_exchange": "..."
}
```

### v2 Rate Limiting

```
60 requests/min per IP
Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
429 response: { "error": "rate_limit_exceeded", "retry_after_seconds": N }
```
