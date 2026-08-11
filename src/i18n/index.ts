import zh from './zh';
import en from './en';

export type Locale = 'zh' | 'en';
export type Translations = typeof zh;

const translations: Record<Locale, Translations> = { zh, en };

export function t(locale: Locale, key: keyof Translations, params?: Record<string, string>): string {
  let text = translations[locale][key] || translations['zh'][key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, v);
    }
  }
  return text;
}

export { zh, en };
