import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { gatewayUrl, navigation, renderPage, server, signedOut } from '../test/render';
import { isCurrent, MobileTabBar, navItems, SiteHeader, tabItems } from './site-header';

const session = {
  userId: '0195f0e0-0000-7000-8000-000000000001',
  email: 'viewer@example.test',
  roles: [],
  permissions: [],
  csrfToken: 'csrf',
};
const ada = { id: '0195f0e0-0000-7000-8000-0000000000a2', name: 'Ada', maxAgeRating: 'Age7' };

describe('SiteHeader', () => {
  it('offers signing in to a visitor, next to the menu', async () => {
    server.use(signedOut);
    renderPage(<SiteHeader />, 'tr', { withProfiles: true });

    expect(await screen.findByRole('link', { name: 'Giriş yap' })).toHaveAttribute('href', '/tr/sign-in');
    const menu = screen.getByRole('navigation', { name: 'Ana menü' });
    expect(
      within(menu)
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['Ana Sayfa', '/tr'],
      ['Diziler', '/tr/series'],
      ['Filmler', '/tr/movies'],
      ['Listem', '/tr/my-list'],
    ]);
    expect(screen.getByRole('link', { name: 'Ara' })).toHaveAttribute('href', '/tr/search');
  });

  it('marks the section of the current page', async () => {
    server.use(signedOut);
    navigation.pathname = '/en/movies';
    renderPage(<SiteHeader />, 'en', { withProfiles: true });

    expect(await screen.findByRole('link', { name: 'Movies' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it("opens the watching profile's menu: switching profiles, and signing out, which forgets it", async () => {
    document.cookie = `nbp-profile=${ada.id}.Age7; Path=/`;
    server.use(
      http.get(`${gatewayUrl}/session`, () => HttpResponse.json(session)),
      http.get(`${gatewayUrl}/auth/profiles`, () => HttpResponse.json([ada])),
      http.post(`${gatewayUrl}/session/sign-out`, () => new HttpResponse(null, { status: 204 })),
    );
    renderPage(<SiteHeader />, 'tr', { withProfiles: true });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Ada: Profil menüsü' }));

    expect(await screen.findByRole('menuitem', { name: 'Profil değiştir' })).toHaveAttribute(
      'href',
      '/tr/profiles',
    );
    expect(screen.getByRole('menuitem', { name: 'Hesap' })).toHaveAttribute('href', '/tr/account');

    await user.click(screen.getByRole('menuitem', { name: 'Çıkış yap' }));

    await waitFor(() => {
      expect(navigation.push).toHaveBeenCalledWith('/tr');
    });
    expect(document.cookie).not.toContain('nbp-profile=');
  });
});

describe('MobileTabBar', () => {
  it('has the sections and search, the current one marked', () => {
    navigation.pathname = '/tr/series/0195f0e0-0000-7000-8000-000000000001';
    renderPage(<MobileTabBar />);

    expect(screen.getByRole('link', { name: 'Diziler' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/tr',
      '/tr/series',
      '/tr/movies',
      '/tr/search',
      '/tr/my-list',
    ]);
    expect(tabItems).toHaveLength(5);
  });
});

describe('isCurrent', () => {
  const [home, series] = navItems;

  it("is the home page only on itself, a section also on its titles' pages", () => {
    expect(home && isCurrent(home, 'tr', '/tr')).toBe(true);
    expect(home && isCurrent(home, 'tr', '/tr/series')).toBe(false);
    expect(series && isCurrent(series, 'tr', '/tr/series')).toBe(true);
    expect(series && isCurrent(series, 'tr', '/tr/series/abc')).toBe(true);
    expect(series && isCurrent(series, 'tr', '/tr/seriesx')).toBe(false);
    expect(series && isCurrent(series, 'en', '/tr/series')).toBe(false);
  });
});
