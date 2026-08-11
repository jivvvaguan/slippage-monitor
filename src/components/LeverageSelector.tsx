'use client';

import type { Locale } from '@/i18n';
import { t } from '@/i18n';

const LEVERAGE_OPTIONS = [1, 2, 3, 5, 10, 20, 25, 50, 75, 100];

interface Props {
  leverage: number;
  onLeverageChange: (leverage: number) => void;
  locale: Locale;
}

export default function LeverageSelector({ leverage, onLeverageChange, locale }: Props) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500 dark:text-gray-400">
        {t(locale, 'leverage')}:
      </span>
      <select
        value={leverage}
        onChange={e => onLeverageChange(Number(e.target.value))}
        className="px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {LEVERAGE_OPTIONS.map(lev => (
          <option key={lev} value={lev}>{lev}x</option>
        ))}
      </select>
    </div>
  );
}
