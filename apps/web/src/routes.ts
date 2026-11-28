import type { TitleKind } from '@netboxplus/core';
import { isLocale, type Locale } from '@netboxplus/i18n';

export interface WatchOptions {
  /** The episode of a series to play. */
  readonly episode?: string;
  /** From the beginning instead of where the profile stopped. */
  readonly fromStart?: boolean;
}

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
  history: (locale: Locale) => `/${locale}/history`,
  signIn: (locale: Locale) => `/${locale}/sign-in`,
  signUp: (locale: Locale) => `/${locale}/sign-up`,
  forgotPassword: (locale: Locale) => `/${locale}/forgot-password`,
  profiles: (locale: Locale) => `/${locale}/profiles`,
  plans: (locale: Locale) => `/${locale}/plans`,
  account: (locale: Locale) => `/${locale}/account`,
  accountSecurity: (locale: Locale) => `/${locale}/account/security`,
  /** The player: a movie, or a series' `episode` (the series goes on where it stopped without one). */
  watch: (locale: Locale, titleId: string, options: WatchOptions = {}) => {
    const query = new URLSearchParams();
    if (options.episode) {
      query.set('episode', options.episode);
    }
    if (options.fromStart) {
      query.set('from', 'start');
    }
    const search = query.toString();
    return `/${locale}/watch/${titleId}${search ? `?${search}` : ''}`;
  },
};

function withNext(base: string, next: string | undefined): string {
  return next ? `${base}?next=${encodeURIComponent(next)}` : base;
}

/** Sign-in, coming back to `next` afterwards; the sign-in page checks `next` again before following it. */
export function signInPath(locale: Locale, next?: string): string {
  return withNext(routes.signIn(locale), next);
}

/** Sign-up, going on to `next` (after choosing a profile) once the account is made. */
export function signUpPath(locale: Locale, next?: string): string {
  return withNext(routes.signUp(locale), next);
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
  'plans',
  'account',
  'unsubscribe',
]);

/** Pages that work without a chosen profile: signing in, the e-mail links (unsubscribing too), choosing one, plans and the account. */
export function isAccountPage(pathname: string): boolean {
  const [first = '', second = ''] = pathname.split('/').filter((segment) => segment !== '');
  return isLocale(first) && accountPages.has(second);
}
