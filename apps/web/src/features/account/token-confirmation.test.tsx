import { useSession } from '@netboxplus/core';
import { screen } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { gatewayUrl, navigation, problem, renderPage, server, signedOut } from '../../test/render';
import { EmailChangeConfirmation, EmailVerification } from './token-confirmation';

const session = {
  userId: '0195f0e0-0000-7000-8000-000000000001',
  email: 'viewer@example.test',
  roles: [],
  permissions: [],
  csrfToken: 'csrf-7',
};

/** As after moving between pages: the session is already known when the page mounts. */
function AfterSession({ children }: { children: ReactNode }) {
  return useSession().isPending ? null : children;
}

describe('EmailVerification', () => {
  it('sends the token once when the session is already known as the page mounts', async () => {
    navigation.search = new URLSearchParams({ token: 'verify-token' });
    let sent = 0;
    server.use(
      signedOut,
      http.post(`${gatewayUrl}/auth/email-verification/confirm`, () => {
        sent += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderPage(
      <AfterSession>
        <EmailVerification />
      </AfterSession>,
    );

    expect(await screen.findByText('E-posta adresin doğrulandı.')).toBeInTheDocument();
    expect(sent).toBe(1);
  });

  it('sends the single-use token once, even in strict mode', async () => {
    navigation.search = new URLSearchParams({ token: 'verify-token' });
    const sent: unknown[] = [];
    server.use(
      signedOut,
      http.post(`${gatewayUrl}/auth/email-verification/confirm`, async ({ request }) => {
        sent.push(await request.json());
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderPage(<EmailVerification />);

    expect(await screen.findByText('E-posta adresin doğrulandı.')).toBeInTheDocument();
    expect(sent).toEqual([{ token: 'verify-token' }]);
  });

  it("waits for a signed-in tab's session, so the change carries its CSRF token", async () => {
    navigation.search = new URLSearchParams({ token: 'verify-token' });
    const tokens: (string | null)[] = [];
    server.use(
      http.get(`${gatewayUrl}/session`, async () => {
        await delay(50);
        return HttpResponse.json(session);
      }),
      http.get(`${gatewayUrl}/auth/email-verification`, () =>
        HttpResponse.json({ verified: true, verifiedAt: null }),
      ),
      http.post(`${gatewayUrl}/auth/email-verification/confirm`, ({ request }) => {
        tokens.push(request.headers.get('X-CSRF-Token'));
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderPage(<EmailVerification />);

    expect(await screen.findByText('E-posta adresin doğrulandı.')).toBeInTheDocument();
    expect(tokens).toEqual(['csrf-7']);
  });

  it('says when the link is spent or expired', async () => {
    navigation.search = new URLSearchParams({ token: 'old' });
    server.use(
      signedOut,
      http.post(`${gatewayUrl}/auth/email-verification/confirm`, () =>
        problem(400, 'EmailVerification.TokenInvalid'),
      ),
    );

    renderPage(<EmailVerification />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bu doğrulama bağlantısı geçersiz ya da süresi dolmuş.',
    );
  });
});

describe('EmailChangeConfirmation', () => {
  it('tells the visitor when the new address was taken meanwhile', async () => {
    navigation.search = new URLSearchParams({ token: 'change-token' });
    server.use(
      signedOut,
      http.post(`${gatewayUrl}/auth/email-change/confirm`, () => problem(409, 'User.EmailTaken')),
    );

    renderPage(<EmailChangeConfirmation />, 'en');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'An account with this email address already exists.',
    );
  });

  it('sends nothing without a token', () => {
    server.use(signedOut);

    renderPage(<EmailChangeConfirmation />);

    expect(screen.getByRole('alert')).toHaveTextContent('Bu bağlantı eksik ya da bozuk.');
  });
});
