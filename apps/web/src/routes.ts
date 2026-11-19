import type { Locale } from '@netboxplus/i18n';

/** The pages other pages link to, in one place. */
export const routes = {
  home: (locale: Locale) => `/${locale}`,
  signIn: (locale: Locale) => `/${locale}/sign-in`,
  signUp: (locale: Locale) => `/${locale}/sign-up`,
  forgotPassword: (locale: Locale) => `/${locale}/forgot-password`,
};

/** Sign-in, coming back to `next` afterwards; the sign-in page checks `next` again before following it. */
export function signInPath(locale: Locale, next?: string): string {
  const base = routes.signIn(locale);
  return next ? `${base}?next=${encodeURIComponent(next)}` : base;
}
