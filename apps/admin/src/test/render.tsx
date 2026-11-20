import { createAppQueryClient } from '@netboxplus/core';
import { render } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { StrictMode } from 'react';
import { createMemoryRouter } from 'react-router';
import { App } from '../app';
import { createAdminGateway } from '../data/gateway';
import type { BlockRequest } from '../data/blocks';
import type { BlobUpload } from '../data/images';
import { sessionKey } from '../data/session';
import { routes } from '../routes';

export const gatewayUrl = 'http://gateway.test';
export const catalogUrl = `${gatewayUrl}/admin/catalog`;

/** The gateway as the tests answer it; each test adds its handlers. */
export const server = setupServer();

export const signedOut = http.get(`${gatewayUrl}/admin/session`, () => problem(401, 'Session.Required'));

export function problem(status: number, code: string, extra: Record<string, unknown> = {}) {
  return HttpResponse.json({ status, code, ...extra }, { status });
}

/** Every permission the G1 pages look at. */
export const catalogPermissions = [
  'catalog:genres:read',
  'catalog:genres:write',
  'catalog:people:read',
  'catalog:people:write',
  'catalog:images:upload',
];

export const adminSession = {
  userId: '0195f0e0-0000-7000-8000-0000000000ad',
  email: 'admin@example.test',
  roles: ['Editor'],
  permissions: catalogPermissions,
  csrfToken: 'csrf-admin',
};

/** Signed in with `permissions`; the gateway answers the session. */
export function signInWith(permissions: readonly string[] = catalogPermissions) {
  server.use(
    http.get(`${gatewayUrl}/admin/session`, () => HttpResponse.json({ ...adminSession, permissions })),
  );
}

/** An upload that succeeds at once, for tests that do not look at it. */
export const uploadNothing: BlobUpload = () => Promise.resolve();

/**
 * The whole panel at `path`, in strict mode like development, with a memory router the test can read the
 * address from. `upload` stands in for the browser's storage upload.
 */
export function renderApp(path: string, options: { upload?: BlobUpload; sendBlock?: BlockRequest } = {}) {
  const queryClient = createAppQueryClient({
    onSessionEnded: () => {
      queryClient.setQueryData(sessionKey, null);
    },
  });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const gateway = createAdminGateway(gatewayUrl, {
    upload: options.upload ?? uploadNothing,
    sendBlock: options.sendBlock ?? (() => Promise.resolve()),
  });
  const view = render(
    <StrictMode>
      <App router={router} queryClient={queryClient} gateway={gateway} />
    </StrictMode>,
  );
  return { ...view, router, queryClient };
}

/** Where the router is now: the path and the query string. */
export function locationOf(router: ReturnType<typeof createMemoryRouter>): string {
  const { pathname, search } = router.state.location;
  return `${pathname}${search}`;
}
