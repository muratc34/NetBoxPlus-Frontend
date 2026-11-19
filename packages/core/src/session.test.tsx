import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createBrowserGateway, GatewayProvider } from './gateway';
import { createAppQueryClient } from './query-client';
import { queryKeys, useConfirmEmail, useSession, useSignIn, useSignOut, type Session } from './session';

const gatewayUrl = 'http://gateway.test';
const session: Session = {
  userId: '0195f0e0-0000-7000-8000-000000000001',
  email: 'viewer@example.test',
  roles: [],
  permissions: [],
  csrfToken: 'csrf-1',
};
const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

function setup(onSessionEnded = vi.fn()) {
  const queryClient: QueryClient = createAppQueryClient({ onSessionEnded });
  const gateway = createBrowserGateway(gatewayUrl);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <GatewayProvider gateway={gateway}>{children}</GatewayProvider>
    </QueryClientProvider>
  );
  return { queryClient, wrapper, onSessionEnded };
}

describe('useSession', () => {
  it('is null when the gateway has no session for the cookie', async () => {
    server.use(
      http.get(`${gatewayUrl}/session`, () =>
        HttpResponse.json({ status: 401, code: 'Session.Required' }, { status: 401 }),
      ),
    );
    const { wrapper, onSessionEnded } = setup();

    const { result } = renderHook(() => useSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toBeNull();
    expect(onSessionEnded).not.toHaveBeenCalled();
  });

  it('is the account, and its CSRF token goes with the next change', async () => {
    const sent: (string | null)[] = [];
    server.use(
      http.get(`${gatewayUrl}/session`, () => HttpResponse.json(session)),
      http.post(`${gatewayUrl}/session/sign-out`, ({ request }) => {
        sent.push(request.headers.get('X-CSRF-Token'));
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { wrapper, queryClient } = setup();

    const { result } = renderHook(() => ({ session: useSession(), signOut: useSignOut() }), { wrapper });
    await waitFor(() => {
      expect(result.current.session.data).toEqual(session);
    });
    await act(() => result.current.signOut.mutateAsync());

    expect(sent).toEqual(['csrf-1']);
    expect(queryClient.getQueryData(queryKeys.session)).toBeNull();
  });
});

describe('useSignIn', () => {
  it('keeps the new session and its token', async () => {
    const tokens: (string | null)[] = [];
    server.use(
      http.post(`${gatewayUrl}/session/sign-in`, async ({ request }) => {
        expect(await request.json()).toEqual({ email: session.email, password: 'correct horse battery' });
        return HttpResponse.json({ ...session, csrfToken: 'csrf-2' });
      }),
      http.post(`${gatewayUrl}/auth/email-verification/confirm`, ({ request }) => {
        tokens.push(request.headers.get('X-CSRF-Token'));
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { wrapper, queryClient } = setup();

    const { result } = renderHook(() => ({ signIn: useSignIn(), confirm: useConfirmEmail() }), { wrapper });
    await act(() =>
      result.current.signIn.mutateAsync({ email: session.email, password: 'correct horse battery' }),
    );
    await act(() => result.current.confirm.mutateAsync('token'));

    expect(queryClient.getQueryData<Session>(queryKeys.session)?.csrfToken).toBe('csrf-2');
    expect(tokens).toEqual(['csrf-2']);
  });

  it('reports wrong credentials without ending anything', async () => {
    server.use(
      http.post(`${gatewayUrl}/session/sign-in`, () =>
        HttpResponse.json({ status: 400, code: 'User.InvalidCredentials' }, { status: 400 }),
      ),
    );
    const { wrapper, onSessionEnded } = setup();

    const { result } = renderHook(() => useSignIn(), { wrapper });
    await act(async () => {
      await expect(
        result.current.mutateAsync({ email: session.email, password: 'wrong password!' }),
      ).rejects.toMatchObject({ code: 'User.InvalidCredentials' });
    });

    expect(onSessionEnded).not.toHaveBeenCalled();
  });
});

describe('createAppQueryClient', () => {
  it('reports a session that ended while the page was open', async () => {
    server.use(
      http.post(`${gatewayUrl}/auth/email-verification/confirm`, () =>
        HttpResponse.json({ status: 401, code: 'Session.Expired' }, { status: 401 }),
      ),
    );
    const { wrapper, onSessionEnded } = setup();

    const { result } = renderHook(() => useConfirmEmail(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync('token')).rejects.toMatchObject({ status: 401 });
    });

    expect(onSessionEnded).toHaveBeenCalledOnce();
  });
});
