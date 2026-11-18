import { describe, expect, it } from 'vitest';
import { createTranslator, defaultLocale, isLocale, locales } from './index';
import { tr } from './messages/tr';

describe('createTranslator', () => {
  it('has a non-empty text for every key in every locale', () => {
    for (const locale of locales) {
      const t = createTranslator(locale);
      for (const key of Object.keys(tr) as (keyof typeof tr)[]) {
        expect(t(key).trim(), `${locale}: ${key}`).not.toBe('');
      }
    }
  });

  it('returns the text of the asked locale', () => {
    expect(createTranslator('tr')('web.comingSoon.title')).toBe('Çok yakında');
    expect(createTranslator('en')('web.comingSoon.title')).toBe('Coming soon');
  });
});

describe('isLocale', () => {
  it('accepts only supported locales', () => {
    expect(isLocale('tr')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('de')).toBe(false);
    expect(isLocale('TR')).toBe(false);
  });

  it('defaults to Turkish', () => {
    expect(defaultLocale).toBe('tr');
  });
});
