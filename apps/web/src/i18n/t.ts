import { en, type Messages } from './messages/en';
import { defaultLocale, type Locale } from './config';

type MessageBundle = Messages;

const bundles: Record<Locale, Partial<MessageBundle>> = {
  en,
  es: {},
  fr: {},
  de: {},
  pt: {},
  ja: {},
};

type Path = string;

/**
 * Translate a dotted-path key like `"nav.dashboard"` against the given locale.
 * Falls back to English, then to the raw key. Supports `{var}` interpolation.
 */
export function t(path: Path, vars?: Record<string, string | number>, locale: Locale = defaultLocale): string {
  const value = lookup(bundles[locale], path) ?? lookup(bundles.en, path) ?? path;
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`));
}

function lookup(bundle: Partial<MessageBundle> | undefined, path: string): string | undefined {
  if (!bundle) return undefined;
  const parts = path.split('.');
  let current: unknown = bundle;
  for (const p of parts) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = (current as Record<string, unknown>)[p];
  }
  return typeof current === 'string' ? current : undefined;
}
