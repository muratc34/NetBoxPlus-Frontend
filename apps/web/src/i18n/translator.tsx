'use client';

import { createTranslator, type Locale, type MessageKey } from '@netboxplus/i18n';
import { createContext, use, useMemo, type ReactNode } from 'react';

interface LocaleContextValue {
  readonly locale: Locale;
  readonly t: (key: MessageKey) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ locale, children }: Readonly<{ locale: Locale; children: ReactNode }>) {
  const value = useMemo(() => ({ locale, t: createTranslator(locale) }), [locale]);
  return <LocaleContext value={value}>{children}</LocaleContext>;
}

/** The page's language and its texts. */
export function useLocale(): LocaleContextValue {
  const value = use(LocaleContext);
  if (!value) {
    throw new Error('useLocale needs a LocaleProvider above it.');
  }
  return value;
}
