'use client';

import type { Locale } from '@/i18n';
import { t } from '@/i18n';

export type MarketType = 'perp' | 'spot';

interface Props {
  market: MarketType;
  onMarketChange: (market: MarketType) => void;
  locale: Locale;
}

const TABS: { id: MarketType; label: 'perps' | 'spot' }[] = [
  { id: 'perp', label: 'perps' },
  { id: 'spot', label: 'spot' },
];

export default function MarketTabs({ market, onMarketChange, locale }: Props) {
  return (
    <div
      role="tablist"
      className="inline-flex p-1 rounded-lg bg-gray-100 dark:bg-gray-800"
    >
      {TABS.map(tab => {
        const active = tab.id === market;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active}
            onClick={() => onMarketChange(tab.id)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              active
                ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {t(locale, tab.label)}
          </button>
        );
      })}
    </div>
  );
}
