'use client';

import type { Locale } from '@/i18n';
import { t } from '@/i18n';

interface Props {
  dataAgeSeconds: number;
  locale: Locale;
}

export default function FreshnessBadge({ dataAgeSeconds, locale }: Props) {
  const minutes = Math.floor(dataAgeSeconds / 60);
  const seconds = dataAgeSeconds % 60;

  let timeStr: string;
  if (minutes > 0) {
    timeStr = `${minutes} ${t(locale, 'minutes')}`;
  } else {
    timeStr = `${seconds} ${t(locale, 'seconds')}`;
  }

  const isStale = dataAgeSeconds > 600;
  const isRecent = dataAgeSeconds < 60;

  return (
    <div className={`flex items-center gap-1.5 text-xs ${
      isStale ? 'text-red-500' : isRecent ? 'text-green-500' : 'text-gray-500 dark:text-gray-400'
    }`}>
      <span className={`w-2 h-2 rounded-full ${
        isStale ? 'bg-red-500' : isRecent ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
      }`} />
      {isRecent ? t(locale, 'live') : t(locale, 'updatedAgo', { time: timeStr })}
    </div>
  );
}
