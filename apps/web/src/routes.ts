import type { TitleKind } from '@netboxplus/core';
import { isLocale, type Locale } from '@netboxplus/i18n';

/** The pages other pages link to, in one place. */
export const routes = {
  home: (locale: Locale) => `/${locale}`,
  movies: (locale: Locale) => `/${locale}/movies`,
  series: (locale: Locale) => `/${locale}/series`,
  /** A movie's or a series' own page. */
  title: (locale: Locale, kind: TitleKind, id: string) =>
    `/${locale}/${kind === 'Movie' ? 'movies' : 'series'}/${id}`,
  person: (locale: Locale, id: string) => `/${locale}/people/${id}`,
  genre: (locale: Locale, id: string) => `/${locale}/genres/${id}`,
  search: (locale: Locale) => `/${locale}/search`,
  myList: (locale: Locale) => `/${locale}/my-list`,
  signIn: (locale: Locale) => `/${locale}/sign-in`,
  signUp: (locale: Locale) => `/${locale}/sign-up`,
  forgotPassword: (locale: Locale) => `/${locale}/forgot-password`,
  profiles: (locale: Locale) => `/${locale}/profiles`,
};

function withNext(base: string, next: string | undefined): string {
  return next ? `${base}?next=${encodeURIComponent(next)}` : base;
}

/** Sign-in, coming back to `next` afterwards; the sign-in page checks `next` again before following it. */
export function signInPath(locale: Locale, next?: string): string {
  return withNext(routes.signIn(locale), next);
}

/** "Who's watching?", going on to `next` once a profile is chosen. */
export function profilesPath(locale: Locale, next?: string): string {
  return withNext(routes.profiles(locale), next);
}

const accountPages = new Set([
  'sign-in',
  'sign-up',
  'forgot-password',
  'reset-password',
  'verify-email',
  'change-email',
  'profiles',
]);

/** Pages that work without a chosen profile: signing in, the e-mail links and choosing one. */
export function isAccountPage(pathname: string): boolean {
  const [first = '', second = ''] = pathname.split('/').filter((segment) => segment !== '');
  return isLocale(first) && accountPages.has(second);
}
