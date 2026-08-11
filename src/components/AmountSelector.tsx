'use client';

import { useState } from 'react';
import type { Locale } from '@/i18n';
import { t } from '@/i18n';
import { PRESET_AMOUNTS } from '@/lib/constants';

interface Props {
  selectedAmount: number;
  onAmountChange: (amount: number) => void;
  locale: Locale;
}

function formatAmount(n: number): string {
  if (n >= 1000000) return `$${n / 1000000}M`;
  if (n >= 1000) return `$${n / 1000}K`;
  return `$${n}`;
}

export default function AmountSelector({ selectedAmount, onAmountChange, locale }: Props) {
  const [customValue, setCustomValue] = useState('');

  const handleCustomSubmit = () => {
    const val = Number(customValue.replace(/[,$]/g, ''));
    if (val > 0) {
      onAmountChange(val);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-gray-500 dark:text-gray-400 mr-1">
        {t(locale, 'amount')}:
      </span>
      {PRESET_AMOUNTS.map(amount => (
        <button
          key={amount}
          onClick={() => onAmountChange(amount)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            selectedAmount === amount
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          {formatAmount(amount)}
        </button>
      ))}
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={customValue}
          onChange={e => setCustomValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCustomSubmit()}
          placeholder={t(locale, 'customAmount')}
          className="w-24 px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleCustomSubmit}
          className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          {t(locale, 'calculate')}
        </button>
      </div>
    </div>
  );
}
