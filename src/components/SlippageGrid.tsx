'use client';

import type { Locale } from '@/i18n';
import { t } from '@/i18n';
import { formatCompactUSD } from '@/lib/format';
import { DEPTH_BANDS } from '@/lib/depth';

interface DepthBandResult {
  band_pct: number;
  bid_usd: number;
  ask_usd: number;
  bid_complete: boolean;
  ask_complete: boolean;
  book_coverage_pct: number;
}

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
  depth_bands: (DepthBandResult | null)[];
}

interface Props {
  results: ExchangeResult[];
  locale: Locale;
}

const TH = 'py-3 px-3 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap';
const TD = 'py-3 px-3 tabular-nums whitespace-nowrap';

/** Sub-0.01% spans would render as "±0.00%", which reads as "no book at all". */
function formatCoverage(pct: number): string {
  return pct < 0.01 ? '<0.01' : pct.toFixed(3);
}

/**
 * One side of a depth band. A truncated book is prefixed with ≥ because the
 * figure is only a lower bound — without it a dense book (Binance spans just
 * ±0.18% from a REST snapshot) reads as shallower than a sparse one that does
 * span the band, which inverts the ranking.
 */
function DepthSide({ label, usd, complete }: { label: string; usd: number | null; complete: boolean | null }) {
  return (
    <div className="flex items-baseline justify-end gap-1.5">
      <span className="text-[10px] text-gray-400">{label}</span>
      {usd === null || complete === null ? (
        <span className="text-gray-400">—</span>
      ) : (
        <span className={complete ? '' : 'text-orange-600 dark:text-orange-400'}>
          {complete ? '' : '≥'}{formatCompactUSD(usd)}
        </span>
      )}
    </div>
  );
}

function DepthCell({ band, locale }: { band: DepthBandResult | null; locale: Locale }) {
  const truncated = band !== null && (!band.bid_complete || !band.ask_complete);
  return (
    <td
      className={`text-right ${TD}`}
      title={truncated ? t(locale, 'depthTruncated', { band: String(band.band_pct) }) : undefined}
    >
      <DepthSide label={t(locale, 'depthBid')} usd={band?.bid_usd ?? null} complete={band?.bid_complete ?? null} />
      <DepthSide label={t(locale, 'depthAsk')} usd={band?.ask_usd ?? null} complete={band?.ask_complete ?? null} />
      {truncated && (
        <div className="text-[10px] text-gray-400 mt-0.5">
          {t(locale, 'depthCoverage', { pct: formatCoverage(band.book_coverage_pct) })}
        </div>
      )}
    </td>
  );
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
  // Only a *measured* band that fell short counts as truncated — a venue with
  // no depth data at all must not trigger the whole-table lower-bound notice.
  const anyTruncated = results.some(r =>
    r.depth_bands.some(b => b !== null && (!b.bid_complete || !b.ask_complete)),
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className={`text-left ${TH}`}>{t(locale, 'exchange')}</th>
            <th className={`text-right ${TH}`}>{t(locale, 'midPrice')}</th>
            <th className={`text-right ${TH}`}>{t(locale, 'slippage')} ({t(locale, 'bps')})</th>
            <th className={`text-right ${TH}`}>{t(locale, 'fee')} ({t(locale, 'bps')})</th>
            <th className={`text-right ${TH}`}>{t(locale, 'totalCost')} ({t(locale, 'bps')})</th>
            <th className={`text-right ${TH}`}>{t(locale, 'costUsd')}</th>
            <th className={`text-right ${TH}`}>{t(locale, 'costPctOfPrincipal')}</th>
            {DEPTH_BANDS.map(band => (
              <th key={band} className={`text-right ${TH}`}>
                {t(locale, 'depthBand', { band: String(band * 100) })}
              </th>
            ))}
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
                <td className="py-3 px-3 font-medium">
                  <span className="flex items-center gap-2">
                    {r.exchange}
                    {isBest && <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">{t(locale, 'best')}</span>}
                    {isWorst && <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">{t(locale, 'worst')}</span>}
                    {!r.sufficient_liquidity && <span className="text-xs text-orange-500" title={t(locale, 'insufficientLiquidity')}>⚠</span>}
                  </span>
                </td>
                <td className={`text-right ${TD}`}>
                  {r.mid_price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </td>
                <td className={`text-right ${TD}`}>{r.slippage_bps.toFixed(2)}</td>
                <td className={`text-right ${TD}`}>{r.fee_bps.toFixed(1)}</td>
                <td className={`text-right ${TD} font-medium ${
                  isBest ? 'text-green-600 dark:text-green-400' : isWorst ? 'text-red-600 dark:text-red-400' : ''
                }`}>
                  {r.total_cost_bps.toFixed(2)}
                </td>
                <td className={`text-right ${TD}`}>${r.cost_usd.toFixed(2)}</td>
                <td className={`text-right ${TD}`}>{r.cost_pct_of_principal.toFixed(3)}%</td>
                {DEPTH_BANDS.map((_, bandIdx) => (
                  <DepthCell key={bandIdx} band={r.depth_bands[bandIdx] ?? null} locale={locale} />
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {anyTruncated && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-3 px-3 leading-relaxed">
          {t(locale, 'depthLegend')}
        </div>
      )}
      <div className="text-right text-xs text-gray-400 mt-2 px-3">
        {t(locale, 'sortedByTotalCost')}
      </div>
    </div>
  );
}
