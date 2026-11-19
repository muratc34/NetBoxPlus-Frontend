import { defaultLocale, isLocale, type Locale } from '@netboxplus/i18n';

/** The visitor's chosen language, set when they switch it; it outranks the browser's preference. */
export const localeCookie = 'nbp-lang';

/**
 * The language for an address that names none (a bookmark, a link in an e-mail): the visitor's choice,
 * else the first supported language the browser asks for (`en-GB` counts as `en`), else Turkish.
 */
export function preferredLocale(chosen: string | undefined, acceptLanguage: string | null): Locale {
  if (chosen !== undefined && isLocale(chosen)) {
    return chosen;
  }

  const wanted = (acceptLanguage ?? '')
    .split(',')
    .map((part, index) => {
      const [range = '', ...parameters] = part.trim().split(';');
      const quality = parameters
        .map((parameter) => /^\s*q=([\d.]+)\s*$/.exec(parameter)?.[1])
        .find((value) => value !== undefined);
      return {
        language: range.trim().toLowerCase().split('-')[0] ?? '',
        weight: quality === undefined ? 1 : Number(quality),
        index,
      };
    })
    .filter((entry) => entry.weight > 0)
    .sort((left, right) => right.weight - left.weight || left.index - right.index);

  return wanted.map((entry) => entry.language).find((language) => isLocale(language)) ?? defaultLocale;
}

/** The address with its language prefix swapped in or added: `/sign-in` → `/en/sign-in`. */
export function localizedPath(locale: Locale, path: string): string {
  const [first = '', ...rest] = path.split('/').filter((segment) => segment !== '');
  const segments = isLocale(first) ? rest : [first, ...rest].filter((segment) => segment !== '');
  return `/${[locale, ...segments].join('/')}`;
}
