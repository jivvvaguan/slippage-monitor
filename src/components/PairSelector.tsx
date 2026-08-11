'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Locale } from '@/i18n';
import { t } from '@/i18n';


interface PairOption {
  id: string;
  tier: number;
  comparable_exchanges: number;
}

interface Props {
  selectedPair: string;
  onPairChange: (pair: string) => void;
  locale: Locale;
}

export default function PairSelector({ selectedPair, onPairChange, locale }: Props) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [pairs, setPairs] = useState<PairOption[]>([]);

  // The universe is whatever SoDEX lists right now, so it comes from the API
  // rather than a compiled-in constant.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/v1/pairs')
      .then(r => (r.ok ? r.json() : null))
      .then(json => { if (!cancelled && json?.pairs) setPairs(json.pairs); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (!search) return pairs;
    const q = search.toLowerCase();
    return pairs.filter(p => p.id.toLowerCase().includes(q));
  }, [search, pairs]);

  // Tier-1 is the curated shortlist; showing all 83 as chips is unusable.
  const hot = useMemo(() => pairs.filter(p => p.tier === 1), [pairs]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-lg font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            {selectedPair} <span className="text-xs text-gray-400">▼</span>
          </button>
          {isOpen && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t(locale, 'searchPair')}
                className="w-full px-3 py-2 text-sm border-b border-gray-200 dark:border-gray-700 bg-transparent focus:outline-none"
                autoFocus
              />
              <div className="max-h-64 overflow-y-auto">
                {filtered.map(pair => (
                  <button
                    key={pair.id}
                    onClick={() => { onPairChange(pair.id); setIsOpen(false); setSearch(''); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between gap-2 ${
                      pair.id === selectedPair ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : ''
                    }`}
                  >
                    <span>{pair.id}-PERP</span>
                    <span className="text-[10px] text-gray-400 shrink-0">
                      {pair.comparable_exchanges > 1
                        ? t(locale, 'venueCount', { n: String(pair.comparable_exchanges) })
                        : t(locale, 'sodexOnly')}
                    </span>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <div className="px-3 py-4 text-sm text-gray-400 text-center">{t(locale, 'noData')}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">{t(locale, 'hotPairs')}:</span>
        {hot.map(pair => (
          <button
            key={pair.id}
            onClick={() => onPairChange(pair.id)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              pair.id === selectedPair
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {pair.id}
          </button>
        ))}
        {pairs.length > 0 && (
          <span className="text-xs text-gray-400 ml-1">
            {t(locale, 'totalPairs', { n: String(pairs.length) })}
          </span>
        )}
      </div>
    </div>
  );
}
