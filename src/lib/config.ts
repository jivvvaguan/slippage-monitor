import { CcxtAdapter } from './exchanges/ccxt-adapter';
import { BinanceAdapter } from './exchanges/binance';
import { BitgetAdapter } from './exchanges/bitget';
import { OkxAdapter } from './exchanges/okx';
import { HyperliquidAdapter } from './exchanges/hyperliquid';
import { SodexAdapter } from './exchanges/sodex';
import { AsterAdapter } from './exchanges/aster';
import { EdgeXAdapter } from './exchanges/edgex';
import { SodexSpotAdapter } from './exchanges/sodex-spot';
import type { ExchangeAdapter } from './exchanges/types';
import type { MarketType } from './pairs';
import { PRESET_AMOUNTS, DEFAULT_LEVERAGE } from './constants';

export interface AppConfig {
  presetAmounts: readonly number[];
  defaultLeverage: number;
  refreshIntervalMs: number;
  orderbookDepthLimit: number;
  rateLimitPerMinute: number;
}

export const APP_CONFIG: AppConfig = {
  presetAmounts: PRESET_AMOUNTS,
  defaultLeverage: DEFAULT_LEVERAGE,
  refreshIntervalMs: 300000, // 5 minutes
  // 1000 is the REST ceiling on Binance/Bybit/MEXC and roughly doubles the
  // price range the book spans; venues that cap lower just return less.
  orderbookDepthLimit: 1000,
  rateLimitPerMinute: 60,
};

/**
 * Aster, EdgeX and Hyperliquid are perp-only venues here — Aster and EdgeX have
 * no spot at all, and Hyperliquid's spot universe is HIP-1 tokens with almost
 * no overlap with SoDEX's listings. Including them in a spot sweep would just
 * burn requests returning nothing.
 */
export function createExchangeAdapters(market: MarketType = 'perp'): ExchangeAdapter[] {
  if (market === 'spot') {
    return [
      new SodexSpotAdapter(),
      new CcxtAdapter({ exchangeId: 'binance', name: 'Binance', takerFeeBps: 10, market: 'spot' }),
      new CcxtAdapter({ exchangeId: 'bybit', name: 'Bybit', takerFeeBps: 10, market: 'spot' }),
      new CcxtAdapter({ exchangeId: 'okx', name: 'OKX', takerFeeBps: 10, market: 'spot' }),
      new CcxtAdapter({ exchangeId: 'bitget', name: 'Bitget', takerFeeBps: 10, market: 'spot' }),
      new CcxtAdapter({ exchangeId: 'mexc', name: 'MEXC', takerFeeBps: 10, market: 'spot' }),
    ];
  }

  return [
    new BinanceAdapter(),
    new CcxtAdapter({
      exchangeId: 'bybit',
      name: 'Bybit',
      takerFeeBps: 5.5,
      ccxtOptions: { options: { defaultType: 'swap' } },
    }),
    new HyperliquidAdapter(),
    new SodexAdapter(),
    // Phase 2 CEX — CCXT quick onboard
    new BitgetAdapter(),
    new CcxtAdapter({
      exchangeId: 'mexc',
      name: 'MEXC',
      takerFeeBps: 6.0,
      ccxtOptions: { options: { defaultType: 'swap' } },
    }),
    new OkxAdapter(),
    // Perp DEX — native REST adapters
    new AsterAdapter(),
    new EdgeXAdapter(),
  ];
}
