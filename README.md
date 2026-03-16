# Perps Slippage Monitor

Real-time perpetual futures slippage and taker cost monitor across Binance, Bybit, Hyperliquid, and Lighter.

Simulates market orders at configurable notional sizes and computes actual taker cost (slippage + fees) as a percentage of principal.

## Setup

```bash
npm install
```

## Usage

### CLI only
```bash
npx tsx src/index.ts
```

### CLI + Web Dashboard
```bash
npx tsx src/index.ts --web
# Dashboard at http://localhost:3456
```

## Configuration

Edit `config.json`:

```json
{
  "pairs": ["BTC", "ETH", "SOL", "XAUT"],
  "exchanges": ["binance", "bybit", "hyperliquid", "lighter"],
  "orderSizesUSD": [10000, 50000, 100000, 500000],
  "leverage": 10,
  "refreshIntervalMs": 10000,
  "webPort": 3456,
  "orderbookDepthLimit": 500
}
```

| Field | Description |
|-------|-------------|
| `pairs` | Base assets to monitor (e.g., BTC, ETH, SOL) |
| `exchanges` | Exchanges to query |
| `orderSizesUSD` | Simulated order notional values in USD |
| `leverage` | Leverage multiplier for principal calculation |
| `refreshIntervalMs` | Polling interval in milliseconds |
| `webPort` | Web dashboard HTTP port |
| `orderbookDepthLimit` | Max orderbook depth levels to fetch |

## How It Works

1. Fetches live orderbook depth from each exchange via CCXT (Binance, Bybit, Hyperliquid) or direct REST API (Lighter)
2. Simulates a market buy order by walking the ask side of the orderbook
3. Computes Volume Weighted Average Price (VWAP) from filled levels
4. Calculates slippage = deviation of VWAP from mid-price (in bps)
5. Adds exchange taker fee (in bps)
6. Expresses total cost as percentage of principal (notional / leverage)

### Cost Formula

```
slippage_bps = (avg_fill_price - mid_price) / mid_price × 10000
total_cost_bps = slippage_bps + fee_bps
cost_% = total_cost_bps / 10000 × leverage × 100
```

### Default Fee Rates (Base Tier)

| Exchange | Taker Fee |
|----------|-----------|
| Binance | 0.05% (5 bps) |
| Bybit | 0.055% (5.5 bps) |
| Hyperliquid | 0.045% (4.5 bps) |
| Lighter | 0% (0 bps) |

## Notes

- No API keys required — uses public orderbook endpoints only
- No actual orders are placed
- XAUT/GOLD perps may not be available on all exchanges (displayed as N/A)
- Lighter uses USDC as quote currency; Binance/Bybit use USDT
