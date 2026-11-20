import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { adminSession, gatewayUrl, locationOf, problem, renderApp, server, signInWith } from '../test/render';

function answerGenres() {
  server.use(http.get(`${gatewayUrl}/admin/catalog/genres`, () => HttpResponse.json([])));
}

describe('SignInPage', () => {
  it('comes first without a session and goes back to the page that asked', async () => {
    answerGenres();
    let sent: unknown;
    server.use(
      http.post(`${gatewayUrl}/admin/session/sign-in`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(adminSession);
      }),
    );
    const { router } = renderApp('/genres?x=1');

    await screen.findByRole('heading', { name: 'Yönetim paneline giriş' });
    expect(locationOf(router)).toBe('/sign-in?next=%2Fgenres%3Fx%3D1');
    expect(document.title).toBe('Yönetim paneline giriş');

    await userEvent.type(screen.getByLabelText('E-posta'), ' admin@example.test ');
    await userEvent.type(screen.getByLabelText('Şifre'), 'secret-1');
    await userEvent.click(screen.getByRole('button', { name: 'Giriş yap' }));

    await screen.findByRole('heading', { name: 'Türler' });
    expect(sent).toEqual({ email: 'admin@example.test', password: 'secret-1' });
    expect(locationOf(router)).toBe('/genres?x=1');
  });

  it('asks without a next address when the front door asked', async () => {
    const { router } = renderApp('/');

    await screen.findByRole('heading', { name: 'Yönetim paneline giriş' });
    expect(locationOf(router)).toBe('/sign-in');
  });

  it('shows the refusal on the form', async () => {
    server.use(
      http.post(`${gatewayUrl}/admin/session/sign-in`, () => problem(400, 'User.InvalidCredentials')),
    );
    renderApp('/sign-in');

    await userEvent.type(await screen.findByLabelText('E-posta'), 'admin@example.test');
    await userEvent.type(screen.getByLabelText('Şifre'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Giriş yap' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('E-posta ya da şifre hatalı.');
  });

  it('checks the fields before asking', async () => {
    renderApp('/sign-in');

    await userEvent.click(await screen.findByRole('button', { name: 'Giriş yap' }));

    expect(await screen.findAllByText('Bu alan zorunlu.')).toHaveLength(2);
    await userEvent.type(screen.getByLabelText('E-posta'), 'not-an-address');
    await userEvent.type(screen.getByLabelText('Şifre'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Giriş yap' }));
    expect(await screen.findByText('Geçerli bir e-posta adresi yaz.')).toBeInTheDocument();
  });

  it('goes on when already signed in, and never to another site', async () => {
    signInWith();
    answerGenres();
    const { router } = renderApp('/sign-in?next=//evil.test/x');

    await screen.findByRole('heading', { name: 'Türler' });
    expect(locationOf(router)).toBe('/genres');
  });
});
