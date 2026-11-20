import { createTranslator, defaultLocale, isLocale, type Locale, type MessageKey } from '@netboxplus/i18n';
import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react';

/** Where the chosen language is remembered in this browser. */
export const localeStorageKey = 'nbp-admin-lang';

function rememberedLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(localeStorageKey);
    return stored !== null && isLocale(stored) ? stored : defaultLocale;
  } catch {
    return defaultLocale;
  }
}

interface LocaleContextValue {
  readonly locale: Locale;
  readonly t: (key: MessageKey) => string;
  readonly setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/** The panel's language: Turkish unless one was chosen in this browser. */
export function LocaleProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [locale, setLocale] = useState<Locale>(rememberedLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      t: createTranslator(locale),
      setLocale: (next) => {
        setLocale(next);
        try {
          window.localStorage.setItem(localeStorageKey, next);
        } catch {
          // Not remembered (private window, blocked storage): this tab still switches.
        }
      },
    }),
    [locale],
  );
  return <LocaleContext value={value}>{children}</LocaleContext>;
}

export function useLocale(): LocaleContextValue {
  const value = use(LocaleContext);
  if (!value) {
    throw new Error('useLocale needs a LocaleProvider above it.');
  }
  return value;
}
