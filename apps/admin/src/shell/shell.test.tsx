import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { localeStorageKey } from '../i18n';
import { catalogUrl, gatewayUrl, locationOf, renderApp, server, signInWith } from '../test/render';

const emptyPeople = { items: [], pageNumber: 1, pageSize: 20, totalCount: 0 };

function answerLists() {
  server.use(
    http.get(`${catalogUrl}/genres`, () => HttpResponse.json([])),
    http.get(`${catalogUrl}/people`, () => HttpResponse.json(emptyPeople)),
  );
}

describe('Shell', () => {
  it('shows the sections the session may see and opens the first', async () => {
    signInWith(['catalog:people:read']);
    answerLists();
    const { router } = renderApp('/');

    await screen.findByRole('heading', { name: 'Kişiler' });
    expect(locationOf(router)).toBe('/people');
    const menu = screen.getByRole('navigation', { name: 'Yönetim menüsü' });
    expect(
      within(menu)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Kişiler']);
    expect(within(menu).getByRole('link', { name: 'Kişiler' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('admin@example.test')).toBeInTheDocument();
  });

  it('lists every section in order for a session with them all', async () => {
    signInWith();
    answerLists();
    renderApp('/');

    const menu = await screen.findByRole('navigation', { name: 'Yönetim menüsü' });
    expect(
      within(menu)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Türler', 'Kişiler']);
    expect(await screen.findByRole('heading', { name: 'Türler' })).toBeInTheDocument();
  });

  it('says so when no section is allowed', async () => {
    signInWith([]);
    renderApp('/');

    expect(await screen.findByText('Bu panelde yetkin olan bir bölüm yok.')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('keeps a page from a session without its permission', async () => {
    signInWith(['catalog:people:read']);
    renderApp('/genres');

    expect(await screen.findByRole('alert')).toHaveTextContent('Bu sayfa için yetkin yok.');
    expect(screen.queryByRole('heading', { name: 'Türler' })).not.toBeInTheDocument();
  });

  it('keeps making a person from a session that may only read', async () => {
    signInWith(['catalog:people:read']);
    renderApp('/people/new');

    expect(await screen.findByRole('alert')).toHaveTextContent('Bu sayfa için yetkin yok.');
  });

  it('answers an unknown address inside the panel', async () => {
    signInWith();
    renderApp('/nowhere');

    expect(await screen.findByText('Sayfa bulunamadı')).toBeInTheDocument();
  });

  it('switches the language and remembers it', async () => {
    signInWith();
    answerLists();
    renderApp('/genres');

    await screen.findByRole('heading', { name: 'Türler' });
    expect(document.documentElement.lang).toBe('tr');
    const group = screen.getByRole('group', { name: 'Dil' });
    expect(within(group).getByRole('button', { name: 'Türkçe' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(within(group).getByRole('button', { name: 'English' }));

    expect(await screen.findByRole('heading', { name: 'Genres' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Language' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Türkçe' })).toHaveAttribute('aria-pressed', 'false');
    expect(document.documentElement.lang).toBe('en');
    expect(window.localStorage.getItem(localeStorageKey)).toBe('en');
  });

  it('starts in the remembered language and ignores anything else stored', async () => {
    signInWith();
    answerLists();
    window.localStorage.setItem(localeStorageKey, 'en');
    const first = renderApp('/genres');
    expect(await screen.findByRole('heading', { name: 'Genres' })).toBeInTheDocument();
    first.unmount();

    window.localStorage.setItem(localeStorageKey, 'de');
    renderApp('/genres');
    expect(await screen.findByRole('heading', { name: 'Türler' })).toBeInTheDocument();
  });

  it('opens and closes the menu on a narrow screen', async () => {
    signInWith();
    answerLists();
    renderApp('/genres');

    const toggle = await screen.findByRole('button', { name: 'Menü' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const menu = screen.getByRole('navigation', { name: 'Yönetim menüsü' });
    expect(toggle).toHaveAttribute('aria-controls', menu.id);
    expect(menu).toHaveClass('hidden');

    await userEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Menüyü kapat' })).toHaveAttribute('aria-expanded', 'true');
    expect(menu).toHaveClass('block');

    await userEvent.click(within(menu).getByRole('link', { name: 'Kişiler' }));
    expect(await screen.findByRole('button', { name: 'Menü' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('signs out with the CSRF token and goes to signing in', async () => {
    signInWith();
    answerLists();
    let token: string | null = null;
    server.use(
      http.post(`${gatewayUrl}/admin/session/sign-out`, ({ request }) => {
        token = request.headers.get('X-CSRF-Token');
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { router, queryClient } = renderApp('/genres');

    await userEvent.click(await screen.findByRole('button', { name: 'Çıkış yap' }));

    await screen.findByRole('heading', { name: 'Yönetim paneline giriş' });
    expect(token).toBe('csrf-admin');
    expect(locationOf(router)).toBe('/sign-in');
    expect(queryClient.getQueryData(['admin', 'catalog', 'genres'])).toBeUndefined();
  });

  it('leaves the session behind even when signing out fails', async () => {
    signInWith();
    answerLists();
    server.use(http.post(`${gatewayUrl}/admin/session/sign-out`, () => HttpResponse.error()));
    const { router } = renderApp('/genres');

    await userEvent.click(await screen.findByRole('button', { name: 'Çıkış yap' }));

    await waitFor(() => {
      expect(locationOf(router)).toBe('/sign-in');
    });
    expect(await screen.findByRole('heading', { name: 'Yönetim paneline giriş' })).toBeInTheDocument();
  });
});
