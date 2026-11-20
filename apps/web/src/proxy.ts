import { isLocale } from '@netboxplus/i18n';
import { NextResponse, type NextRequest } from 'next/server';
import { contentSecurityPolicy, newNonce, parseOrigins } from './content-security-policy';
import { localeCookie, preferredLocale } from './i18n/locale';

const policyHeader = 'Content-Security-Policy';

/**
 * Every page lives under its language (`/tr/...`, `/en/...`). An address without one, such as the links
 * in e-mails (`/verify-email?token=…`), is sent to the same page in the visitor's language with its query.
 * Pages get a Content-Security-Policy with a fresh nonce; Next reads it from the request and puts it on
 * its scripts, which is why every page renders per request.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split('/')[1] ?? '';
  if (!isLocale(first)) {
    const locale = preferredLocale(
      request.cookies.get(localeCookie)?.value,
      request.headers.get('accept-language'),
    );
    const target = request.nextUrl.clone();
    target.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
    return NextResponse.redirect(target);
  }

  const policy = contentSecurityPolicy({
    nonce: newNonce(),
    gatewayOrigin: new URL(process.env.NEXT_PUBLIC_GATEWAY_URL ?? 'http://localhost:5100').origin,
    storageOrigins: parseOrigins(process.env.STORAGE_ORIGINS),
    development: process.env.NODE_ENV === 'development',
  });
  const headers = new Headers(request.headers);
  headers.set(policyHeader, policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set(policyHeader, policy);
  return response;
}

export const config = {
  // Not the framework's files, the health endpoint or files with an extension (icons, robots.txt).
  matcher: ['/((?!_next/|health/|.*\\.[^/]+$).*)'],
};
