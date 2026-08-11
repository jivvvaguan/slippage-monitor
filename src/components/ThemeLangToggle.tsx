'use client';

import { useCallback } from 'react';
import type { Locale } from '@/i18n';

interface Props {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
}

export default function ThemeLangToggle({ locale, onLocaleChange }: Props) {
  const toggleTheme = useCallback(() => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, []);

  return (
    <div className="flex items-center gap-2 text-sm">
      <button
        onClick={() => onLocaleChange(locale === 'zh' ? 'en' : 'zh')}
        className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        {locale === 'zh' ? 'EN' : '中文'}
      </button>
      <button
        onClick={toggleTheme}
        className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label="Toggle theme"
      >
        🌙
      </button>
    </div>
  );
}
