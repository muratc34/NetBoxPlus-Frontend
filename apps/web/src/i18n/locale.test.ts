import { describe, expect, it } from 'vitest';
import { localizedPath, preferredLocale } from './locale';

describe('preferredLocale', () => {
  it("follows the visitor's own choice first", () => {
    expect(preferredLocale('en', 'tr-TR,tr;q=0.9')).toBe('en');
  });

  it('takes the first supported language the browser prefers, by weight', () => {
    expect(preferredLocale(undefined, 'en-GB,en;q=0.9,tr;q=0.8')).toBe('en');
    expect(preferredLocale(undefined, 'de-DE,de;q=0.9,en;q=0.5,tr;q=0.7')).toBe('tr');
    expect(preferredLocale(undefined, 'tr;q=0.2, en;q=0.8')).toBe('en');
  });

  it('falls back to Turkish', () => {
    expect(preferredLocale(undefined, null)).toBe('tr');
    expect(preferredLocale('de', 'fr,de;q=0.9')).toBe('tr');
    expect(preferredLocale(undefined, 'en;q=0')).toBe('tr');
  });
});

describe('localizedPath', () => {
  it('adds or swaps the language prefix', () => {
    expect(localizedPath('en', '/sign-in')).toBe('/en/sign-in');
    expect(localizedPath('en', '/tr/sign-in')).toBe('/en/sign-in');
    expect(localizedPath('tr', '/')).toBe('/tr');
  });
});
