import Table from 'cli-table3';
import type { MonitorSnapshot, SlippageResult, Config } from '../types.js';

export function renderCLI(snapshot: MonitorSnapshot, config: Config): string {
  const lines: string[] = [];
  const time = new Date(snapshot.timestamp).toLocaleTimeString();

  lines.push(`\n${'═'.repeat(92)}`);
  lines.push(`  永续合约滑点监控 | ${time} | 杠杆: ${config.leverage}x`);
  lines.push(`${'═'.repeat(92)}`);

  const byPair = new Map<string, SlippageResult[]>();
  for (const r of snapshot.results) {
    const pair = r.pair;
    const arr = byPair.get(pair) ?? [];
    arr.push(r);
    byPair.set(pair, arr);
  }

  for (const [pair, results] of byPair) {
    lines.push(`\n  ▸ ${pair}-PERP`);

    const bySizeMap = new Map<number, SlippageResult[]>();
    for (const r of results) {
      const arr = bySizeMap.get(r.notionalUSD) ?? [];
      arr.push(r);
      bySizeMap.set(r.notionalUSD, arr);
    }

    for (const [size, sizeResults] of bySizeMap) {
      const table = new Table({
        head: ['交易所', '中间价', '成交均价', '滑点(bps)', '手续费(bps)', '总成本(bps)', '成本金额', '占本金%', '流动性'],
        colWidths: [14, 14, 14, 12, 12, 12, 12, 11, 9],
        style: { head: ['cyan'] },
      });

      for (const r of sizeResults) {
        const costUSD = (r.totalCostBps / 10000) * r.notionalUSD;
        table.push([
          r.exchange,
          r.midPrice > 0 ? `$${formatNum(r.midPrice)}` : 'N/A',
          r.avgFillPrice > 0 ? `$${formatNum(r.avgFillPrice)}` : 'N/A',
          r.slippageBps.toFixed(2),
          r.feeBps.toFixed(1),
          r.totalCostBps.toFixed(2),
          `$${costUSD.toFixed(2)}`,
          `${r.costPctOfPrincipal.toFixed(3)}%`,
          r.insufficientLiquidity ? '⚠ 不足' : '✓',
        ]);
      }

      const principal = size / config.leverage;
      lines.push(`    下单: $${formatNum(size)} 名义值 | 本金: $${formatNum(principal)}`);
      lines.push(table.toString());
    }
  }

  const activeExchanges = new Set(snapshot.results.map(r => r.exchange));
  const configuredExchanges = config.exchanges.map(e => e.charAt(0).toUpperCase() + e.slice(1));
  const missing = configuredExchanges.filter(e => !activeExchanges.has(e));
  if (missing.length > 0) {
    lines.push(`\n  ⚠ 无数据: ${missing.join(', ')}`);
  }

  return lines.join('\n');
}

function formatNum(n: number): string {
  if (n >= 1000) {
    return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  return n.toFixed(4);
}
