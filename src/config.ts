import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { Config } from './types.js';

const DEFAULT_CONFIG: Config = {
  pairs: ['BTC', 'ETH', 'SOL', 'XAUT'],
  exchanges: ['binance', 'bybit', 'hyperliquid', 'lighter'],
  orderSizesUSD: [10000, 50000, 100000, 500000],
  leverage: 10,
  refreshIntervalMs: 10000,
  webPort: 3456,
  orderbookDepthLimit: 500,
};

export function loadConfig(configPath?: string): Config {
  const path = configPath ?? resolve(process.cwd(), 'config.json');
  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    console.warn(`⚠ Config file not found at ${path}, using defaults`);
    return DEFAULT_CONFIG;
  }
}
