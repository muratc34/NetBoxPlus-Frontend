import { describe, expect, it } from 'vitest';
import { createAdminClients, createPublicClients, csrfHeader } from './client';

function recorder(status = 200, body: unknown = {}) {
  const requests: Request[] = [];
  const fetch = (request: Request) => {
    requests.push(request);
    return Promise.resolve(
      new Response(status === 204 ? null : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  };
  return { requests, fetch };
}

const baseUrl = 'http://localhost:5100';

describe('createPublicClients', () => {
  it('sends each service its public paths under its gateway prefix', async () => {
    const { requests, fetch } = recorder();
    const clients = createPublicClients({ baseUrl, fetch });

    await clients.catalog.GET('/titles', { params: { query: { sort: 'Popular' } } });
    await clients.auth.GET('/profiles');
    await clients.session.GET('/session');
    await clients.streaming.GET('/profiles/{profileId}/my-list', { params: { path: { profileId: 'p1' } } });

    expect(requests.map((request) => request.url)).toEqual([
      'http://localhost:5100/catalog/titles?sort=Popular',
      'http://localhost:5100/auth/profiles',
      'http://localhost:5100/session',
      'http://localhost:5100/streaming/profiles/p1/my-list',
    ]);
  });

  it('sends the session cookie by default and leaves it out when asked', async () => {
    const browser = recorder();
    await createPublicClients({ baseUrl, fetch: browser.fetch }).catalog.GET('/genres');
    const server = recorder();
    await createPublicClients({ baseUrl, fetch: server.fetch, credentials: 'omit' }).catalog.GET('/genres');

    expect(browser.requests[0]?.credentials).toBe('include');
    expect(server.requests[0]?.credentials).toBe('omit');
  });

  it('tolerates a trailing slash on the gateway address', async () => {
    const { requests, fetch } = recorder();

    await createPublicClients({ baseUrl: `${baseUrl}/`, fetch }).catalog.GET('/genres');

    expect(requests[0]?.url).toBe('http://localhost:5100/catalog/genres');
  });

  it('cannot name admin paths or the auth endpoints the gateway keeps to itself', () => {
    const clients = createPublicClients({ baseUrl, fetch: recorder().fetch });

    // Type-level checks: these lines compile only while the paths are absent from the public types.
    const unreachable = () => {
      // @ts-expect-error admin paths are only in the admin clients
      void clients.catalog.GET('/admin/movies');
      // @ts-expect-error the gateway signs in through /session/sign-in, never Auth's /sign-in
      void clients.auth.POST('/sign-in', { body: { email: 'a@example.test', password: 'secret' } });
      // @ts-expect-error the token-returning /me stays behind the gateway
      void clients.auth.GET('/me');
    };

    expect(unreachable).toBeTypeOf('function');
  });
});

describe('createAdminClients', () => {
  it('sends admin paths under /admin/<service> without repeating /admin', async () => {
    const { requests, fetch } = recorder();
    const clients = createAdminClients({ baseUrl, fetch });

    await clients.auth.GET('/users');
    await clients.catalog.GET('/movies');
    await clients.notification.GET('/emails');
    await clients.session.GET('/session');

    expect(requests.map((request) => request.url)).toEqual([
      'http://localhost:5100/admin/auth/users',
      'http://localhost:5100/admin/catalog/movies',
      'http://localhost:5100/admin/notification/emails',
      'http://localhost:5100/admin/session',
    ]);
  });
});

describe('CSRF token', () => {
  it('is sent with changing requests only', async () => {
    const { requests, fetch } = recorder(204);
    const clients = createPublicClients({ baseUrl, fetch, csrfToken: () => 'token-1' });

    await clients.catalog.GET('/genres');
    await clients.streaming.PUT('/profiles/{profileId}/my-list/{titleId}', {
      params: { path: { profileId: 'p1', titleId: 't1' } },
    });
    await clients.streaming.DELETE('/profiles/{profileId}/my-list/{titleId}', {
      params: { path: { profileId: 'p1', titleId: 't1' } },
    });
    await clients.session.POST('/session/sign-out');

    expect(requests.map((request) => `${request.method} ${String(request.headers.get(csrfHeader))}`)).toEqual(
      ['GET null', 'PUT token-1', 'DELETE token-1', 'POST token-1'],
    );
  });

  it('is read at request time, so a new session token is used at once', async () => {
    const { requests, fetch } = recorder(204);
    const session: { token?: string } = {};
    const clients = createAdminClients({ baseUrl, fetch, csrfToken: () => session.token });

    await clients.session.POST('/session/sign-out');
    session.token = 'token-2';
    await clients.session.POST('/session/sign-out');

    expect(requests.map((request) => request.headers.get(csrfHeader))).toEqual([null, 'token-2']);
  });
});
