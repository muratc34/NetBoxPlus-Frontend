import { createTranslator } from '@netboxplus/i18n';
import { describe, expect, it } from 'vitest';
import { formatLanguages, formatRuntime, formatSeasonCount, metaDescription } from './format';

const tr = createTranslator('tr');
const en = createTranslator('en');

describe('formatRuntime', () => {
  it('says hours and minutes, or minutes under an hour', () => {
    expect(formatRuntime(108, tr)).toBe('1 sa 48 dk');
    expect(formatRuntime(120, en)).toBe('2h 0m');
    expect(formatRuntime(60, tr)).toBe('1 sa 0 dk');
    expect(formatRuntime(59, tr)).toBe('59 dk');
    expect(formatRuntime(45, en)).toBe('45m');
  });
});

describe('formatSeasonCount', () => {
  it('counts seasons', () => {
    expect(formatSeasonCount(1, en)).toBe('1 season');
    expect(formatSeasonCount(2, en)).toBe('2 seasons');
    expect(formatSeasonCount(3, tr)).toBe('3 sezon');
  });
});

describe('formatLanguages', () => {
  it("names each language in the page's language, without its region", () => {
    expect(formatLanguages(['tr-TR', 'en-US'], 'tr')).toEqual(['Türkçe', 'İngilizce']);
    expect(formatLanguages(['tr-TR', 'en-US'], 'en')).toEqual(['Turkish', 'English']);
  });

  it('names the region only when two variants of a language are offered', () => {
    expect(formatLanguages(['en-US', 'en-GB', 'de-DE'], 'en')).toEqual([
      'American English',
      'British English',
      'German',
    ]);
  });

  it('names a language once', () => {
    expect(formatLanguages(['tr-TR', 'tr-TR'], 'en')).toEqual(['Turkish']);
    expect(formatLanguages([], 'en')).toEqual([]);
  });
});

describe('metaDescription', () => {
  it('keeps a short text whole, flattening its spaces', () => {
    expect(metaDescription('  A keeper\n meets a stranger.  ')).toBe('A keeper meets a stranger.');
  });

  it('keeps a text of exactly the limit whole', () => {
    const text = 'a'.repeat(50);
    expect(metaDescription(text, 50)).toBe(text);
  });

  it('cuts a long text at a word, with an ellipsis', () => {
    const text = `${'word '.repeat(40)}end.`;
    const cut = metaDescription(text, 50);
    expect(cut.length).toBeLessThanOrEqual(50);
    expect(cut).toMatch(/^(word )*word…$/);
  });
});
