import { CcxtAdapter } from './exchanges/ccxt-adapter';
import { SodexAdapter } from './exchanges/sodex';
import { AsterAdapter } from './exchanges/aster';
import { EdgeXAdapter } from './exchanges/edgex';
import { LighterAdapter } from './exchanges/lighter';
import type { ExchangeAdapter } from './exchanges/types';
import { PAIRS, PRESET_AMOUNTS, DEFAULT_LEVERAGE } from './constants';

export interface AppConfig {
  pairs: readonly string[];
  presetAmounts: readonly number[];
  defaultLeverage: number;
  refreshIntervalMs: number;
  orderbookDepthLimit: number;
  rateLimitPerMinute: number;
}

export const APP_CONFIG: AppConfig = {
  pairs: PAIRS,
  presetAmounts: PRESET_AMOUNTS,
  defaultLeverage: DEFAULT_LEVERAGE,
  refreshIntervalMs: 300000, // 5 minutes
  // 1000 is the REST ceiling on Binance/Bybit/MEXC and roughly doubles the
  // price range the book spans; venues that cap lower just return less.
  orderbookDepthLimit: 1000,
  rateLimitPerMinute: 60,
};

export function createExchangeAdapters(): ExchangeAdapter[] {
  return [
    new CcxtAdapter({
      exchangeId: 'binance',
      name: 'Binance',
      pairSymbols: { BTC: 'BTC/USDT:USDT', ETH: 'ETH/USDT:USDT', SOL: 'SOL/USDT:USDT', GOLD: 'PAXG/USDT:USDT' },
      takerFeeBps: 5.0,
      ccxtOptions: { options: { defaultType: 'swap' } },
    }),
    new CcxtAdapter({
      exchangeId: 'bybit',
      name: 'Bybit',
      pairSymbols: { BTC: 'BTC/USDT:USDT', ETH: 'ETH/USDT:USDT', SOL: 'SOL/USDT:USDT', GOLD: 'XAUT/USDT:USDT' },
      takerFeeBps: 5.5,
      ccxtOptions: { options: { defaultType: 'swap' } },
    }),
    new CcxtAdapter({
      exchangeId: 'hyperliquid',
      name: 'Hyperliquid',
      pairSymbols: { BTC: 'BTC/USDC:USDC', ETH: 'ETH/USDC:USDC', SOL: 'SOL/USDC:USDC', GOLD: 'PAXG/USDC:USDC' },
      takerFeeBps: 4.5,
    }),
    new SodexAdapter(),
    // Phase 2 CEX — CCXT quick onboard
    new CcxtAdapter({
      exchangeId: 'bitget',
      name: 'Bitget',
      pairSymbols: { BTC: 'BTC/USDT:USDT', ETH: 'ETH/USDT:USDT', SOL: 'SOL/USDT:USDT' },
      takerFeeBps: 5.0,
      ccxtOptions: { options: { defaultType: 'swap' } },
    }),
    new CcxtAdapter({
      exchangeId: 'mexc',
      name: 'MEXC',
      pairSymbols: { BTC: 'BTC/USDT:USDT', ETH: 'ETH/USDT:USDT', SOL: 'SOL/USDT:USDT' },
      takerFeeBps: 6.0,
      ccxtOptions: { options: { defaultType: 'swap' } },
    }),
    new CcxtAdapter({
      exchangeId: 'okx',
      name: 'OKX',
      pairSymbols: { BTC: 'BTC/USDT:USDT', ETH: 'ETH/USDT:USDT', SOL: 'SOL/USDT:USDT' },
      takerFeeBps: 5.0,
      ccxtOptions: { options: { defaultType: 'swap' } },
    }),
    // Perp DEX — native REST adapters
    new AsterAdapter(),
    new EdgeXAdapter(),
    new LighterAdapter(),
  ];
}
