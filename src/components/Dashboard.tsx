'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Locale } from '@/i18n';
import { t } from '@/i18n';
import ThemeLangToggle from '@/components/ThemeLangToggle';
import MarketTabs, { type MarketType } from '@/components/MarketTabs';
import PairSelector from '@/components/PairSelector';
import AmountSelector from '@/components/AmountSelector';
import LeverageSelector from '@/components/LeverageSelector';
import SlippageGrid from '@/components/SlippageGrid';
import FreshnessBadge from '@/components/FreshnessBadge';

interface CompareResponse {
  market: MarketType;
  pair: string;
  amount: number;
  leverage: number;
  side: string;
  timestamp: string;
  data_age_seconds: number;
  next_refresh_seconds: number;
  results: any[];
  best_exchange: string | null;
  worst_exchange: string | null;
}

export default function Dashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [locale, setLocale] = useState<Locale>('zh');
  const [market, setMarket] = useState<MarketType>(
    searchParams.get('market') === 'spot' ? 'spot' : 'perp',
  );
  const [pair, setPair] = useState(searchParams.get('pair')?.toUpperCase() || 'BTC');
  const [amount, setAmount] = useState(Number(searchParams.get('amount')) || 100000);
  const [leverage, setLeverage] = useState(Number(searchParams.get('leverage')) || 10);
  const [data, setData] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const effectiveLeverage = market === 'spot' ? 1 : leverage;
      const res = await fetch(
        `/api/v1/slippage/compare?market=${market}&pair=${pair}&amount=${amount}&leverage=${effectiveLeverage}`,
      );
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [market, pair, amount, leverage]);

  // Update URL params
  useEffect(() => {
    const params = new URLSearchParams();
    // Market goes in the URL so a shared link opens on the tab it was made on.
    if (market !== 'perp') params.set('market', market);
    params.set('pair', pair);
    params.set('amount', String(amount));
    if (market === 'perp' && leverage !== 10) params.set('leverage', String(leverage));
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [market, pair, amount, leverage, router]);

  // Fetch on mount and when params change
  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Persist locale
  useEffect(() => {
    const saved = localStorage.getItem('locale') as Locale | null;
    if (saved) setLocale(saved);
  }, []);

  const handleLocaleChange = (newLocale: Locale) => {
    setLocale(newLocale);
    localStorage.setItem('locale', newLocale);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t(locale, 'title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t(locale, market === 'perp' ? 'subtitle' : 'subtitleSpot')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data && <FreshnessBadge dataAgeSeconds={data.data_age_seconds} locale={locale} />}
          <ThemeLangToggle locale={locale} onLocaleChange={handleLocaleChange} />
        </div>
      </div>

      {/* Market tabs */}
      <div className="mb-4">
        <MarketTabs market={market} onMarketChange={setMarket} locale={locale} />
      </div>

      {/* Pair selector */}
      <div className="mb-4">
        <PairSelector
          selectedPair={pair}
          onPairChange={setPair}
          market={market}
          onPairMissing={setPair}
          locale={locale}
        />
      </div>

      {/* Pair info line */}
      {data && data.results.length > 0 && (
        <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {pair}{market === 'perp' ? '-PERP' : '/USDC'} · ${data.results[0]?.mid_price?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </div>
      )}

      {/* Amount + Leverage row */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <AmountSelector selectedAmount={amount} onAmountChange={setAmount} locale={locale} />
        {/* Spot has no leverage: principal equals notional, so the selector
            would only produce a misleading "% of principal". */}
        {market === 'perp' && (
          <LeverageSelector leverage={leverage} onLeverageChange={setLeverage} locale={locale} />
        )}
      </div>

      {/* Results grid */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-400">{t(locale, 'loading')}</div>
        ) : (
          <SlippageGrid results={data?.results ?? []} locale={locale} />
        )}
      </div>

      {/* Footer */}
      <div className="mt-6 flex justify-between items-center text-xs text-gray-400">
        <a href="/docs" className="hover:text-blue-500 transition-colors">
          {t(locale, 'apiDocs')} →
        </a>
        <span>Slippage Monitor v2</span>
      </div>
    </div>
  );
}
