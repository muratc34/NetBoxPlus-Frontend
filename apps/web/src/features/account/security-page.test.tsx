import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { gatewayUrl, navigation, renderPage, server, signedOut, viewerSession } from '../../test/render';
import { SecurityPage } from './security-page';

const thisBrowser = {
  id: '0195f0e0-0000-7000-8000-00000000e001',
  kind: 'Customer',
  deviceLabel: 'Chrome · Windows',
  signedInAt: '2026-11-20T09:00:00Z',
  lastActiveAt: '2026-11-27T12:00:00Z',
  current: true,
};
const phone = {
  ...thisBrowser,
  id: '0195f0e0-0000-7000-8000-00000000e002',
  deviceLabel: 'Safari · iOS',
  current: false,
};
const unknown = {
  ...thisBrowser,
  id: '0195f0e0-0000-7000-8000-00000000e003',
  kind: 'Admin',
  deviceLabel: null,
  current: false,
};

interface Answers {
  readonly devices?: readonly object[];
  readonly signInAlerts?: boolean;
}

function signedIn({ devices = [thisBrowser, phone, unknown], signInAlerts = true }: Answers = {}) {
  server.use(
    http.get(`${gatewayUrl}/session`, () => HttpResponse.json(viewerSession)),
    http.get(`${gatewayUrl}/session/devices`, () => HttpResponse.json(devices)),
    http.get(`${gatewayUrl}/notification/me/notification-preferences`, () =>
      HttpResponse.json({ signInAlerts }),
    ),
  );
}

function page() {
  return renderPage(<SecurityPage />, 'tr', { withProfiles: false });
}

describe('SecurityPage', () => {
  it('sends a visitor without a session to sign in and back', async () => {
    navigation.pathname = '/tr/account/security';
    page();

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith('/tr/sign-in?next=%2Ftr%2Faccount%2Fsecurity');
    });
  });

  it('lists the devices, marks this one and the admin panel, and names an unknown one', async () => {
    signedIn();
    page();

    const devices = await screen.findByRole('region', { name: 'Cihazlar' });
    const rows = await within(devices).findAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Chrome · WindowsBu cihaz'),
      expect.stringContaining('Safari · iOS'),
      expect.stringContaining('Bilinmeyen cihazYönetim paneli'),
    ]);
  });

  it('signs another device out, and the list asks again', async () => {
    signedIn();
    const ended: string[] = [];
    server.use(
      http.delete(`${gatewayUrl}/session/devices/:id`, ({ params }) => {
        ended.push(String(params.id));
        return new HttpResponse(null, { status: 204 });
      }),
    );
    page();

    await userEvent.click(await screen.findByRole('button', { name: 'Çıkış yap: Safari · iOS' }));

    await waitFor(() => {
      expect(ended).toEqual([phone.id]);
    });
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('signs this browser out like signing out: off to sign in', async () => {
    signedIn();
    navigation.pathname = '/tr/account/security';
    server.use(
      http.delete(`${gatewayUrl}/session/devices/:id`, () => {
        // The gateway cleared the cookie: the session is gone from now on.
        server.use(signedOut);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    page();

    await userEvent.click(await screen.findByRole('button', { name: 'Çıkış yap: Chrome · Windows' }));

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith('/tr/sign-in?next=%2Ftr%2Faccount%2Fsecurity');
    });
  });

  it('signs every other device out after asking', async () => {
    signedIn();
    let ended = 0;
    server.use(
      http.delete(`${gatewayUrl}/session/devices`, () => {
        ended++;
        return HttpResponse.json({ ids: [phone.id, unknown.id] });
      }),
    );
    page();

    await userEvent.click(await screen.findByRole('button', { name: 'Diğer tüm cihazlardan çıkış yap' }));
    const dialog = await screen.findByRole('dialog', { name: 'Diğer cihazlardan çıkış yapılsın mı?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Diğer tüm cihazlardan çıkış yap' }));

    expect(await screen.findByText('Diğer bütün cihazlardan çıkış yapıldı.')).toBeInTheDocument();
    expect(ended).toBe(1);
  });

  it('offers no "all others" with only this device', async () => {
    signedIn({ devices: [thisBrowser] });
    page();

    await screen.findByRole('button', { name: 'Çıkış yap: Chrome · Windows' });
    expect(screen.queryByRole('button', { name: 'Diğer tüm cihazlardan çıkış yap' })).not.toBeInTheDocument();
  });

  it('turns the sign-in alert off and on', async () => {
    signedIn();
    const sent: unknown[] = [];
    server.use(
      http.put(`${gatewayUrl}/notification/me/notification-preferences`, async ({ request }) => {
        sent.push(await request.json());
        return new HttpResponse(null, { status: 204 });
      }),
    );
    page();

    const toggle = await screen.findByRole('switch', {
      name: /Yeni bir cihazdan giriş yapıldığında e-posta gönder/,
    });
    await waitFor(() => {
      expect(toggle).toBeEnabled();
    });
    expect(toggle).toBeChecked();

    await userEvent.click(toggle);
    await waitFor(() => {
      expect(toggle).not.toBeChecked();
    });
    expect(sent).toEqual([{ signInAlerts: false }]);
  });
});
