/**
 * i18n scaffolding.
 *
 * We ship English by default and register additional locales here. When a
 * locale key isn't found the getter falls back to the English string, then
 * to the key itself. Nothing in the app blocks on this — pages can render
 * without knowing which locale they're in.
 */

export const supportedLocales = ['en', 'es', 'fr', 'de', 'pt', 'ja'] as const;
export type Locale = (typeof supportedLocales)[number];

export const defaultLocale: Locale = 'en';

export function isSupported(locale: string): locale is Locale {
  return (supportedLocales as readonly string[]).includes(locale);
}

/**
 * Extract a locale from an Accept-Language header, matching by prefix. Falls
 * back to the default locale.
 */
export function pickLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return defaultLocale;
  const requested = acceptLanguage
    .split(',')
    .map((chunk) => chunk.split(';')[0]!.trim().toLowerCase());
  for (const req of requested) {
    const short = req.split('-')[0]!;
    if (isSupported(short)) return short;
  }
  return defaultLocale;
}
