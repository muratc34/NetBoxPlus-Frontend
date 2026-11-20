import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { gatewayUrl, navigation, problem, renderPage, server, signedOut } from '../../test/render';
import { SignInForm } from './sign-in-form';

const session = {
  userId: '0195f0e0-0000-7000-8000-000000000001',
  email: 'viewer@example.test',
  roles: [],
  permissions: [],
  csrfToken: 'csrf',
};

async function fill(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('E-posta'), email);
  await user.type(screen.getByLabelText('Şifre'), password);
  await user.click(screen.getByRole('button', { name: 'Giriş yap' }));
}

describe('SignInForm', () => {
  it('says what is missing before sending anything', async () => {
    server.use(signedOut);
    renderPage(<SignInForm />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Giriş yap' }));

    expect(await screen.findAllByText('Bu alan zorunlu.')).toHaveLength(2);
    expect(screen.getByLabelText('E-posta')).toHaveAttribute('aria-invalid', 'true');
  });

  it('tells wrong credentials apart from nothing else', async () => {
    server.use(
      signedOut,
      http.post(`${gatewayUrl}/session/sign-in`, () => problem(400, 'User.InvalidCredentials')),
    );
    renderPage(<SignInForm />);

    await fill('viewer@example.test', 'not the password');

    expect(await screen.findByRole('alert')).toHaveTextContent('E-posta ya da şifre hatalı.');
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('goes on to choosing a profile, then back to the page that asked for signing in', async () => {
    navigation.search = new URLSearchParams({ next: '/tr/search?q=gece' });
    server.use(
      signedOut,
      http.post(`${gatewayUrl}/session/sign-in`, () => HttpResponse.json(session)),
    );
    renderPage(<SignInForm />);

    await fill('viewer@example.test', 'the right password');

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith('/tr/profiles?next=%2Ftr%2Fsearch%3Fq%3Dgece');
    });
  });

  it('keeps the page that asked when the visitor signs up instead', () => {
    navigation.search = new URLSearchParams({ next: '/tr/plans' });
    server.use(signedOut);
    renderPage(<SignInForm />);

    expect(screen.getByRole('link', { name: 'Kayıt ol' })).toHaveAttribute(
      'href',
      '/tr/sign-up?next=%2Ftr%2Fplans',
    );
  });

  it('never follows a next address off the site', async () => {
    navigation.search = new URLSearchParams({ next: '//evil.example/steal' });
    server.use(
      signedOut,
      http.post(`${gatewayUrl}/session/sign-in`, () => HttpResponse.json(session)),
    );
    renderPage(<SignInForm />, 'en');

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'viewer@example.test');
    await user.type(screen.getByLabelText('Password'), 'the right password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith('/en/profiles');
    });
  });

  it('puts rate limiting on the form', async () => {
    server.use(
      signedOut,
      http.post(`${gatewayUrl}/session/sign-in`, () => problem(429, 'RateLimit.Exceeded')),
    );
    renderPage(<SignInForm />);

    await fill('viewer@example.test', 'the right password');

    expect(await screen.findByRole('alert')).toHaveTextContent('Çok fazla deneme yaptın.');
  });
});
