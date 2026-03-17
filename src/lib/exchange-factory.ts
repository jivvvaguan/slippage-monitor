import { CcxtAdapter } from './exchanges/ccxt-adapter';
import { LighterAdapter } from './exchanges/lighter';
import { SodexAdapter } from './exchanges/sodex';
import { AsterAdapter } from './exchanges/aster';
import { EdgeXAdapter } from './exchanges/edgex';
import type { ExchangeAdapter } from './exchanges/types';

type AdapterFactory = () => ExchangeAdapter;

const ADAPTER_FACTORIES: Record<string, AdapterFactory> = {
  binance: () =>
    new CcxtAdapter({
      exchangeId: 'binance',
      name: 'Binance',
      pairSymbols: {
        BTC: 'BTC/USDT:USDT',
        ETH: 'ETH/USDT:USDT',
        SOL: 'SOL/USDT:USDT',
        GOLD: 'PAXG/USDT:USDT',
      },
      takerFeeBps: 5.0,
      ccxtOptions: { options: { defaultType: 'swap' } },
    }),
  bybit: () =>
    new CcxtAdapter({
      exchangeId: 'bybit',
      name: 'Bybit',
      pairSymbols: {
        BTC: 'BTC/USDT:USDT',
        ETH: 'ETH/USDT:USDT',
        SOL: 'SOL/USDT:USDT',
        GOLD: 'XAUT/USDT:USDT',
      },
      takerFeeBps: 5.5,
      ccxtOptions: { options: { defaultType: 'swap' } },
    }),
  hyperliquid: () =>
    new CcxtAdapter({
      exchangeId: 'hyperliquid',
      name: 'Hyperliquid',
      pairSymbols: {
        BTC: 'BTC/USDC:USDC',
        ETH: 'ETH/USDC:USDC',
        SOL: 'SOL/USDC:USDC',
        GOLD: 'PAXG/USDC:USDC',
      },
      takerFeeBps: 4.5,
    }),
  lighter: () => new LighterAdapter(),
  sodex: () => new SodexAdapter(),
  aster: () => new AsterAdapter(),
  edgex: () => new EdgeXAdapter(),
  bitget: () =>
    new CcxtAdapter({
      exchangeId: 'bitget',
      name: 'Bitget',
      pairSymbols: {
        BTC: 'BTC/USDT:USDT',
        ETH: 'ETH/USDT:USDT',
        SOL: 'SOL/USDT:USDT',
      },
      takerFeeBps: 6.0,
      ccxtOptions: { options: { defaultType: 'swap' } },
    }),
  mexc: () =>
    new CcxtAdapter({
      exchangeId: 'mexc',
      name: 'MEXC',
      pairSymbols: {
        BTC: 'BTC/USDT:USDT',
        ETH: 'ETH/USDT:USDT',
        SOL: 'SOL/USDT:USDT',
      },
      takerFeeBps: 6.0,
      ccxtOptions: { options: { defaultType: 'swap' } },
    }),
  okx: () =>
    new CcxtAdapter({
      exchangeId: 'okx',
      name: 'OKX',
      pairSymbols: {
        BTC: 'BTC/USDT:USDT',
        ETH: 'ETH/USDT:USDT',
        SOL: 'SOL/USDT:USDT',
      },
      takerFeeBps: 5.0,
      ccxtOptions: { options: { defaultType: 'swap' } },
    }),
};

export function createAdapter(exchangeName: string): ExchangeAdapter | null {
  const factory = ADAPTER_FACTORIES[exchangeName.toLowerCase()];
  if (!factory) {
    console.warn(`[exchange-factory] Unknown exchange: ${exchangeName}`);
    return null;
  }
  return factory();
}

export function createAdapters(exchangeNames: string[]): ExchangeAdapter[] {
  const adapters: ExchangeAdapter[] = [];
  for (const name of exchangeNames) {
    const adapter = createAdapter(name);
    if (adapter) {
      adapters.push(adapter);
    }
  }
  return adapters;
}
