'use client';

import { useState, useMemo } from 'react';
import type { Locale } from '@/i18n';
import { t } from '@/i18n';
import { PAIRS } from '@/lib/constants';

interface Props {
  selectedPair: string;
  onPairChange: (pair: string) => void;
  locale: Locale;
}

export default function PairSelector({ selectedPair, onPairChange, locale }: Props) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!search) return [...PAIRS];
    return PAIRS.filter(p => p.toLowerCase().includes(search.toLowerCase()));
  }, [search]);

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
              <div className="max-h-48 overflow-y-auto">
                {filtered.map(pair => (
                  <button
                    key={pair}
                    onClick={() => { onPairChange(pair); setIsOpen(false); setSearch(''); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      pair === selectedPair ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : ''
                    }`}
                  >
                    {pair}-PERP
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">{t(locale, 'hotPairs')}:</span>
        {PAIRS.map(pair => (
          <button
            key={pair}
            onClick={() => onPairChange(pair)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              pair === selectedPair
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {pair}
          </button>
        ))}
      </div>
    </div>
  );
}
