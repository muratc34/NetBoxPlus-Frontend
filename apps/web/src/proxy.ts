import { isLocale } from '@netboxplus/i18n';
import { NextResponse, type NextRequest } from 'next/server';
import { localeCookie, preferredLocale } from './i18n/locale';

/**
 * Every page lives under its language (`/tr/...`, `/en/...`). An address without one, such as the links
 * in e-mails (`/verify-email?token=…`), is sent to the same page in the visitor's language with its query.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split('/')[1] ?? '';
  if (isLocale(first)) {
    return NextResponse.next();
  }

  const locale = preferredLocale(
    request.cookies.get(localeCookie)?.value,
    request.headers.get('accept-language'),
  );
  const target = request.nextUrl.clone();
  target.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
  return NextResponse.redirect(target);
}

export const config = {
  // Not the framework's files, the health endpoint or files with an extension (icons, robots.txt).
  matcher: ['/((?!_next/|health/|.*\\.[^/]+$).*)'],
};
