import type { Locale, MessageKey } from '@netboxplus/i18n';

type Translate = (key: MessageKey) => string;

/** "1 sa 48 dk", or "45 dk" under an hour. */
export function formatRuntime(minutes: number, t: Translate): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0
    ? t('title.runtime').replace('{hours}', String(hours)).replace('{minutes}', String(rest))
    : t('title.runtimeMinutes').replace('{minutes}', String(rest));
}

export function formatSeasonCount(count: number, t: Translate): string {
  return count === 1 ? t('title.seasons.one') : t('title.seasons.many').replace('{count}', String(count));
}

/**
 * The languages a video offers (BCP 47 with a region, such as `tr-TR`), named in the page's language. The
 * region is named only when two variants of a language are offered (American and British English);
 * otherwise "Turkish" says enough. Each language once, in the order given.
 */
export function formatLanguages(codes: readonly string[], locale: Locale): string[] {
  const base = (code: string) => code.split('-')[0]?.toLowerCase() ?? code;
  const counts = new Map<string, number>();
  for (const code of new Set(codes)) {
    counts.set(base(code), (counts.get(base(code)) ?? 0) + 1);
  }

  const languages = new Intl.DisplayNames([locale], { type: 'language' });
  const dialects = new Intl.DisplayNames([locale], { type: 'language', languageDisplay: 'dialect' });
  const names = [...new Set(codes)].map((code) => {
    const name = (counts.get(base(code)) ?? 0) > 1 ? dialects.of(code) : languages.of(base(code));
    return name ?? code;
  });
  return [...new Set(names)].map((name) => name.charAt(0).toLocaleUpperCase(locale) + name.slice(1));
}

/** A description for meta tags: the text's first sentences, at most about 160 characters. */
export function metaDescription(text: string, limit = 160): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= limit) {
    return flat;
  }
  const cut = flat.slice(0, limit - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > limit / 2 ? cut.slice(0, space) : cut).replace(/[\s,.;:]+$/, '')}…`;
}
