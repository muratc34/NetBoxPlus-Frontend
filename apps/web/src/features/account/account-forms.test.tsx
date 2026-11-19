import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { gatewayUrl, navigation, problem, renderPage, server, signedOut } from '../../test/render';
import { ForgotPasswordForm } from './forgot-password-form';
import { ResetPasswordForm } from './reset-password-form';
import { SignUpForm } from './sign-up-form';

describe('SignUpForm', () => {
  it('checks the password before sending it', async () => {
    server.use(signedOut);
    renderPage(<SignUpForm />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('E-posta'), 'new@example.test');
    await user.type(screen.getByLabelText('Şifre'), 'short');
    await user.type(screen.getByLabelText('Şifre (tekrar)'), 'different');
    await user.click(screen.getByRole('button', { name: 'Kayıt ol' }));

    expect(await screen.findByText('Şifre en az 12 karakter olmalı.')).toBeInTheDocument();
    expect(screen.getByText('Şifreler aynı değil.')).toBeInTheDocument();
  });

  it("shows the backend's answer on the field it names", async () => {
    server.use(
      signedOut,
      http.post(`${gatewayUrl}/session/register`, () =>
        problem(409, 'User.EmailTaken', { errorCodes: { Email: ['User.EmailTaken'] } }),
      ),
    );
    renderPage(<SignUpForm />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('E-posta'), 'taken@example.test');
    await user.type(screen.getByLabelText('Şifre'), 'a long enough password');
    await user.type(screen.getByLabelText('Şifre (tekrar)'), 'a long enough password');
    await user.click(screen.getByRole('button', { name: 'Kayıt ol' }));

    expect(await screen.findByText('Bu e-posta adresiyle zaten bir hesap var.')).toBeInTheDocument();
    expect(screen.getByLabelText('E-posta')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('password rules', () => {
  it('take twelve characters and no fewer', async () => {
    server.use(signedOut);
    renderPage(<SignUpForm />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Şifre'), 'elevenchars');
    await user.click(screen.getByRole('button', { name: 'Kayıt ol' }));
    expect(await screen.findByText('Şifre en az 12 karakter olmalı.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Şifre'), 's');
    await user.click(screen.getByRole('button', { name: 'Kayıt ol' }));
    await waitFor(() => {
      expect(screen.queryByText('Şifre en az 12 karakter olmalı.')).not.toBeInTheDocument();
    });
  });
});

describe('ForgotPasswordForm', () => {
  it('answers the same for any address', async () => {
    let asked: unknown;
    server.use(
      signedOut,
      http.post(`${gatewayUrl}/session/password-reset`, async ({ request }) => {
        asked = await request.json();
        return new HttpResponse(null, { status: 202 });
      }),
    );
    renderPage(<ForgotPasswordForm />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('E-posta'), '  someone@example.test ');
    await user.click(screen.getByRole('button', { name: 'Bağlantı gönder' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Bu adrese bağlı bir hesap varsa');
    expect(asked).toEqual({ email: 'someone@example.test' });
  });
});

describe('ResetPasswordForm', () => {
  it('says so when the link has no token', () => {
    server.use(signedOut);
    renderPage(<ResetPasswordForm />);

    expect(screen.getByRole('alert')).toHaveTextContent('Bu bağlantı eksik ya da bozuk.');
  });

  it('sends the token with the new password, and offers signing in after', async () => {
    navigation.search = new URLSearchParams({ token: 'reset-token' });
    let sent: unknown;
    server.use(
      signedOut,
      http.post(`${gatewayUrl}/session/password-reset/confirm`, async ({ request }) => {
        sent = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderPage(<ResetPasswordForm />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Yeni şifre'), 'a brand new password');
    await user.type(screen.getByLabelText('Şifre (tekrar)'), 'a brand new password');
    await user.click(screen.getByRole('button', { name: 'Şifreyi değiştir' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Şifren değişti.');
    expect(sent).toEqual({ token: 'reset-token', newPassword: 'a brand new password' });
    expect(screen.getByRole('link', { name: 'Giriş yap' })).toHaveAttribute('href', '/tr/sign-in');
  });

  it("puts the backend's rule on the field it names, whatever its case", async () => {
    navigation.search = new URLSearchParams({ token: 'reset-token' });
    server.use(
      signedOut,
      http.post(`${gatewayUrl}/session/password-reset/confirm`, () =>
        problem(400, 'Validation.Failed', { errorCodes: { NewPassword: ['User.PasswordTooLong'] } }),
      ),
    );
    renderPage(<ResetPasswordForm />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Yeni şifre'), 'a brand new password');
    await user.type(screen.getByLabelText('Şifre (tekrar)'), 'a brand new password');
    await user.click(screen.getByRole('button', { name: 'Şifreyi değiştir' }));

    expect(await screen.findByText('Şifre en fazla 128 karakter olabilir.')).toBeInTheDocument();
    expect(screen.getByLabelText('Yeni şifre')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('offers a new link when the token is spent or expired', async () => {
    navigation.search = new URLSearchParams({ token: 'old-token' });
    server.use(
      signedOut,
      http.post(`${gatewayUrl}/session/password-reset/confirm`, () =>
        problem(400, 'PasswordReset.TokenInvalid'),
      ),
    );
    renderPage(<ResetPasswordForm />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Yeni şifre'), 'a brand new password');
    await user.type(screen.getByLabelText('Şifre (tekrar)'), 'a brand new password');
    await user.click(screen.getByRole('button', { name: 'Şifreyi değiştir' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('süresi dolmuş');
    });
    expect(screen.getByRole('link', { name: 'Yeni bağlantı iste' })).toHaveAttribute(
      'href',
      '/tr/forgot-password',
    );
  });
});
