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
/**
 * The chosen-profile state is there unless `withProfiles: false`; it asks for the session (signed out unless a
 * test answers otherwise, see setup.ts) and then for the profiles.
 */
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
            {options.withProfiles !== false ? (
              <ProfileSelectionProvider>{element}</ProfileSelectionProvider>
            ) : (
              element
            )}
          </GatewayProvider>
        </QueryClientProvider>
      </LocaleProvider>
    </StrictMode>,
  );
}

type AsyncComponent = (props: unknown) => Promise<ReactElement>;

function isAsyncComponent(type: unknown): type is AsyncComponent {
  return typeof type === 'function' && type.constructor.name === 'AsyncFunction';
}

/**
 * A page as the server renders it: Testing Library cannot render an async server component, so the ones at
 * the top (a route returning `<TitlePage />`) are awaited first.
 */
export async function serverRendered(node: ReactElement | Promise<ReactElement>): Promise<ReactElement> {
  const element = await node;
  return isAsyncComponent(element.type) ? serverRendered(element.type(element.props)) : element;
}

export const viewerSession = {
  userId: '0195f0e0-0000-7000-8000-000000000001',
  email: 'viewer@example.test',
  roles: [],
  permissions: [],
  csrfToken: 'csrf',
};

export const watchingProfile = {
  id: '0195f0e0-0000-7000-8000-0000000000a1',
  name: 'Deniz',
  maxAgeRating: 'Age18' as const,
};

/** Signed in with `profile` chosen: the gateway answers the session and the profiles, the cookie holds the choice. */
export function signInAs(profile: { id: string; name: string; maxAgeRating: string } = watchingProfile) {
  document.cookie = `nbp-profile=${profile.id}.${profile.maxAgeRating}; Path=/`;
  server.use(
    http.get(`${gatewayUrl}/session`, () => HttpResponse.json(viewerSession)),
    http.get(`${gatewayUrl}/auth/profiles`, () => HttpResponse.json([profile])),
  );
}
