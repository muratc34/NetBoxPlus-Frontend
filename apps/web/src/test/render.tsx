import { createAppQueryClient, createBrowserGateway, GatewayProvider } from '@netboxplus/core';
import type { Locale } from '@netboxplus/i18n';
import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { StrictMode, type ReactElement } from 'react';
import { vi } from 'vitest';
import { LocaleProvider } from '../i18n/translator';
import { ProfileSelectionProvider } from '../profiles/profile-selection';

export const gatewayUrl = 'http://gateway.test';

/** The gateway as the tests answer it; each test adds its handlers. */
export const server = setupServer();

export const signedOut = http.get(`${gatewayUrl}/session`, () =>
  HttpResponse.json({ status: 401, code: 'Session.Required' }, { status: 401 }),
);

export function problem(status: number, code: string, extra: Record<string, unknown> = {}) {
  return HttpResponse.json({ status, code, ...extra }, { status });
}

/** What `next/navigation` gives the components; tests set the query string and read the redirects. */
export const navigation = {
  replace: vi.fn<(href: string) => void>(),
  push: vi.fn<(href: string) => void>(),
  search: new URLSearchParams(),
  pathname: '/tr',
};

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: navigation.replace,
    push: navigation.push,
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => navigation.search,
  usePathname: () => navigation.pathname,
}));

/** Renders inside the application's providers, in strict mode like development does. */
/** `withProfiles` adds the chosen-profile state, which asks for the profiles once there is a session. */
export function renderPage(
  element: ReactElement,
  locale: Locale = 'tr',
  options: { withProfiles?: boolean } = {},
) {
  const queryClient = createAppQueryClient({ onSessionEnded: vi.fn() });
  return render(
    <StrictMode>
      <LocaleProvider locale={locale}>
        <QueryClientProvider client={queryClient}>
          <GatewayProvider gateway={createBrowserGateway(gatewayUrl)}>
            {options.withProfiles ? <ProfileSelectionProvider>{element}</ProfileSelectionProvider> : element}
          </GatewayProvider>
        </QueryClientProvider>
      </LocaleProvider>
    </StrictMode>,
  );
}
