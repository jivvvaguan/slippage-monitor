'use client';

import type { Locale } from '@/i18n';
import { t } from '@/i18n';

interface ExchangeResult {
  exchange: string;
  mid_price: number;
  avg_fill_price: number;
  slippage_bps: number;
  fee_bps: number;
  total_cost_bps: number;
  cost_usd: number;
  cost_pct_of_principal: number;
  sufficient_liquidity: boolean;
}

interface Props {
  results: ExchangeResult[];
  locale: Locale;
}

export default function SlippageGrid({ results, locale }: Props) {
  if (results.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        {t(locale, 'noData')}
      </div>
    );
  }

  const bestIdx = 0;
  const worstIdx = results.length - 1;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">
              {t(locale, 'exchange')}
            </th>
            <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">
              {t(locale, 'slippage')} ({t(locale, 'bps')})
            </th>
            <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">
              {t(locale, 'fee')} ({t(locale, 'bps')})
            </th>
            <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">
              {t(locale, 'totalCost')} ({t(locale, 'bps')})
            </th>
            <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">
              {t(locale, 'costUsd')}
            </th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => {
            const isBest = i === bestIdx && results.length > 1;
            const isWorst = i === worstIdx && results.length > 1;
            return (
              <tr
                key={r.exchange}
                className={`border-b border-gray-100 dark:border-gray-800 transition-colors ${
                  isBest ? 'bg-green-50 dark:bg-green-900/10' : isWorst ? 'bg-red-50 dark:bg-red-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                }`}
              >
                <td className="py-3 px-4 font-medium">
                  <span className="flex items-center gap-2">
                    {r.exchange}
                    {isBest && <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">{t(locale, 'best')}</span>}
                    {isWorst && <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">{t(locale, 'worst')}</span>}
                    {!r.sufficient_liquidity && <span className="text-xs text-orange-500">⚠</span>}
                  </span>
                </td>
                <td className="text-right py-3 px-4 tabular-nums">{r.slippage_bps.toFixed(2)}</td>
                <td className="text-right py-3 px-4 tabular-nums">{r.fee_bps.toFixed(1)}</td>
                <td className={`text-right py-3 px-4 tabular-nums font-medium ${
                  isBest ? 'text-green-600 dark:text-green-400' : isWorst ? 'text-red-600 dark:text-red-400' : ''
                }`}>
                  {r.total_cost_bps.toFixed(2)}
                </td>
                <td className="text-right py-3 px-4 tabular-nums">${r.cost_usd.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="text-right text-xs text-gray-400 mt-2 px-4">
        {t(locale, 'sortedByTotalCost')}
      </div>
    </div>
  );
}
