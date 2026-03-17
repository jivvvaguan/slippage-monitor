export interface Config {
  pairs: string[];
  exchanges: string[];
  orderSizesUSD: number[];
  leverage: number;
  refreshIntervalMs: number;
  webPort: number;
  orderbookDepthLimit: number;
}

const DEFAULT_CONFIG: Config = {
  pairs: ['BTC', 'ETH', 'SOL', 'XAUT'],
  exchanges: ['binance', 'bybit', 'hyperliquid', 'lighter', 'aster', 'edgex', 'bitget', 'mexc', 'okx'],
  orderSizesUSD: [10000, 50000, 100000, 500000],
  leverage: 10,
  refreshIntervalMs: 10000,
  webPort: 3456,
  orderbookDepthLimit: 500,
};

function parseJsonEnv<T>(envVal: string | undefined, fallback: T): T {
  if (!envVal) return fallback;
  try {
    return JSON.parse(envVal) as T;
  } catch {
    return fallback;
  }
}

function parseIntEnv(envVal: string | undefined, fallback: number): number {
  if (!envVal) return fallback;
  const n = parseInt(envVal, 10);
  return isNaN(n) ? fallback : n;
}

/**
 * Load config from environment variables.
 * Each setting can be overridden via env:
 *   SLIPPAGE_PAIRS='["BTC","ETH"]'
 *   SLIPPAGE_EXCHANGES='["binance","bybit"]'
 *   SLIPPAGE_ORDER_SIZES='[10000,50000]'
 *   SLIPPAGE_LEVERAGE=10
 *   SLIPPAGE_REFRESH_INTERVAL_MS=10000
 *   SLIPPAGE_WEB_PORT=3456
 *   SLIPPAGE_ORDERBOOK_DEPTH_LIMIT=500
 */
export function loadConfig(): Config {
  return {
    pairs: parseJsonEnv(process.env.SLIPPAGE_PAIRS, DEFAULT_CONFIG.pairs),
    exchanges: parseJsonEnv(process.env.SLIPPAGE_EXCHANGES, DEFAULT_CONFIG.exchanges),
    orderSizesUSD: parseJsonEnv(process.env.SLIPPAGE_ORDER_SIZES, DEFAULT_CONFIG.orderSizesUSD),
    leverage: parseIntEnv(process.env.SLIPPAGE_LEVERAGE, DEFAULT_CONFIG.leverage),
    refreshIntervalMs: parseIntEnv(process.env.SLIPPAGE_REFRESH_INTERVAL_MS, DEFAULT_CONFIG.refreshIntervalMs),
    webPort: parseIntEnv(process.env.SLIPPAGE_WEB_PORT, DEFAULT_CONFIG.webPort),
    orderbookDepthLimit: parseIntEnv(process.env.SLIPPAGE_ORDERBOOK_DEPTH_LIMIT, DEFAULT_CONFIG.orderbookDepthLimit),
  };
}
