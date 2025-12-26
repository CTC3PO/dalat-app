import type { Locale } from '@/lib/types';

export const SUPPORTED_LOCALES: Locale[] = ['en', 'fr', 'vi'];

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  vi: 'Tiếng Việt',
};

export const LOCALE_FLAGS: Record<Locale, string> = {
  en: '🇬🇧',
  fr: '🇫🇷',
  vi: '🇻🇳',
};

export function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en';

  const browserLang = navigator.language.split('-')[0].toLowerCase();

  if (SUPPORTED_LOCALES.includes(browserLang as Locale)) {
    return browserLang as Locale;
  }

  return 'en';
}

export function isValidLocale(locale: string): locale is Locale {
  return SUPPORTED_LOCALES.includes(locale as Locale);
}
