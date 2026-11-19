import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { gatewayUrl, navigation, renderPage, server, signedOut } from '../test/render';
import { SiteHeader } from './site-header';

const session = {
  userId: '0195f0e0-0000-7000-8000-000000000001',
  email: 'viewer@example.test',
  roles: [],
  permissions: [],
  csrfToken: 'csrf',
};
const ada = { id: '0195f0e0-0000-7000-8000-0000000000a2', name: 'Ada', maxAgeRating: 'Age7' };

describe('SiteHeader', () => {
  it('offers signing in to a visitor', async () => {
    server.use(signedOut);
    renderPage(<SiteHeader />, 'tr', { withProfiles: true });

    expect(await screen.findByRole('link', { name: 'Giriş yap' })).toHaveAttribute('href', '/tr/sign-in');
  });

  it('shows the profile being watched, and signing out forgets it', async () => {
    document.cookie = `nbp-profile=${ada.id}.Age7; Path=/`;
    server.use(
      http.get(`${gatewayUrl}/session`, () => HttpResponse.json(session)),
      http.get(`${gatewayUrl}/auth/profiles`, () => HttpResponse.json([ada])),
      http.post(`${gatewayUrl}/session/sign-out`, () => new HttpResponse(null, { status: 204 })),
    );
    renderPage(<SiteHeader />, 'tr', { withProfiles: true });

    expect(await screen.findByRole('link', { name: 'Ada: Profil değiştir' })).toHaveAttribute(
      'href',
      '/tr/profiles',
    );

    await userEvent.setup().click(screen.getByRole('button', { name: 'Çıkış yap' }));

    await waitFor(() => {
      expect(navigation.push).toHaveBeenCalledWith('/tr');
    });
    expect(document.cookie).not.toContain('nbp-profile=');
  });
});
