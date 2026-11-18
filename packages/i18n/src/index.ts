import { en } from './messages/en';
import { tr, type MessageKey, type Messages } from './messages/tr';

export type { MessageKey, Messages };

export const locales = ['tr', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'tr';

const catalogs: Record<Locale, Messages> = { tr, en };

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/** Returns a lookup for one locale; keys are checked at compile time, so a missing text cannot ship. */
export function createTranslator(locale: Locale): (key: MessageKey) => string {
  const messages = catalogs[locale];
  return (key) => messages[key];
}
