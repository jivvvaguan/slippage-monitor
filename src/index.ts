import { loadConfig } from './config.js';
import { CcxtAdapter } from './exchanges/ccxt-adapter.js';
import { LighterAdapter } from './exchanges/lighter.js';
import { SodexAdapter } from './exchanges/sodex.js';
import { startMonitorLoop } from './core/monitor.js';
import { renderCLI } from './output/cli.js';
import { startWebServer, updateWebSnapshot } from './output/web.js';
import type { ExchangeAdapter } from './types.js';

const CCXT_CONFIGS: Record<string, () => ExchangeAdapter> = {
  binance: () => new CcxtAdapter({
    exchangeId: 'binance',
    name: 'Binance',
    pairSymbols: { BTC: 'BTC/USDT:USDT', ETH: 'ETH/USDT:USDT', SOL: 'SOL/USDT:USDT', GOLD: 'PAXG/USDT:USDT' },
    takerFeeBps: 5.0, // 0.05% default taker fee for USDT-M perps
    ccxtOptions: { options: { defaultType: 'swap' } },
  }),
  bybit: () => new CcxtAdapter({
    exchangeId: 'bybit',
    name: 'Bybit',
    pairSymbols: { BTC: 'BTC/USDT:USDT', ETH: 'ETH/USDT:USDT', SOL: 'SOL/USDT:USDT', GOLD: 'XAUT/USDT:USDT' },
    takerFeeBps: 5.5, // 0.055% default taker fee
    ccxtOptions: { options: { defaultType: 'swap' } },
  }),
  hyperliquid: () => new CcxtAdapter({
    exchangeId: 'hyperliquid',
    name: 'Hyperliquid',
    pairSymbols: { BTC: 'BTC/USDC:USDC', ETH: 'ETH/USDC:USDC', SOL: 'SOL/USDC:USDC', GOLD: 'PAXG/USDC:USDC' },
    takerFeeBps: 4.5, // 0.045% Tier 0 perps taker fee
  }),
  lighter: () => new LighterAdapter(),
  sodex: () => new SodexAdapter(),
};

async function main() {
  const config = loadConfig();
  const enableWeb = process.argv.includes('--web') || process.argv.includes('-w');

  console.log('🔍 Perps Slippage Monitor');
  console.log(`   Exchanges: ${config.exchanges.join(', ')}`);
  console.log(`   Pairs: ${config.pairs.join(', ')}`);
  console.log(`   Order sizes: ${config.orderSizesUSD.map(s => `$${s.toLocaleString()}`).join(', ')}`);
  console.log(`   Leverage: ${config.leverage}x`);
  console.log(`   Refresh: ${config.refreshIntervalMs / 1000}s`);
  console.log('');

  const adapters: ExchangeAdapter[] = [];
  for (const name of config.exchanges) {
    const factory = CCXT_CONFIGS[name.toLowerCase()];
    if (factory) {
      adapters.push(factory());
      console.log(`  ✓ ${name} adapter initialized`);
    } else {
      console.warn(`  ✗ Unknown exchange: ${name}`);
    }
  }

  if (adapters.length === 0) {
    console.error('No valid exchanges configured. Exiting.');
    process.exit(1);
  }

  if (enableWeb) {
    startWebServer(config);
  }

  console.log('\n⏳ Fetching initial orderbook data...\n');

  const monitor = startMonitorLoop(adapters, config, (snapshot) => {
    process.stdout.write('\x1b[2J\x1b[H');
    console.log(renderCLI(snapshot, config));

    if (enableWeb) {
      updateWebSnapshot(snapshot);
    }
  });

  const shutdown = async () => {
    console.log('\n\n🛑 Shutting down...');
    monitor.stop();
    await Promise.all(adapters.map(a => a.close()));
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
