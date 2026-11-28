import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  gatewayUrl,
  navigation,
  problem,
  renderPage,
  server,
  signedOut,
  viewerSession,
} from '../../test/render';
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

const laptopKey = {
  id: '0195f0e0-0000-7000-8000-00000000f001',
  name: 'Laptop',
  createdAt: '2026-11-21T10:00:00Z',
  lastUsedAt: null,
};

interface Answers {
  readonly devices?: readonly object[];
  readonly passkeys?: readonly object[];
  readonly signInAlerts?: boolean;
}

function signedIn({
  devices = [thisBrowser, phone, unknown],
  passkeys = [laptopKey],
  signInAlerts = true,
}: Answers = {}) {
  server.use(
    http.get(`${gatewayUrl}/session`, () => HttpResponse.json(viewerSession)),
    http.get(`${gatewayUrl}/session/devices`, () => HttpResponse.json(devices)),
    http.get(`${gatewayUrl}/session/passkeys`, () => HttpResponse.json(passkeys)),
    http.get(`${gatewayUrl}/notification/me/notification-preferences`, () =>
      HttpResponse.json({ signInAlerts }),
    ),
  );
}

function page() {
  return renderPage(<SecurityPage />, 'tr', { withProfiles: false });
}

/** A browser that makes passkeys: the JSON methods pass options through, `create` answers with `credential`. */
function supportPasskeys(create: (options: unknown) => Promise<unknown>) {
  vi.stubGlobal('PublicKeyCredential', {
    parseCreationOptionsFromJSON: (json: unknown) => ({ parsed: json }),
    parseRequestOptionsFromJSON: (json: unknown) => ({ parsed: json }),
  });
  Object.defineProperty(navigator, 'credentials', {
    configurable: true,
    value: { create: ({ publicKey }: { publicKey: unknown }) => create(publicKey) },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it('lists the passkeys, and says so when the browser cannot make one', async () => {
    signedIn();
    page();

    const passkeys = await screen.findByRole('region', { name: 'Passkey’ler' });
    expect(await within(passkeys).findByText('Laptop')).toBeInTheDocument();
    expect(within(passkeys).getByText(/henüz kullanılmadı/)).toBeInTheDocument();
    expect(within(passkeys).getByText('Bu tarayıcı passkey desteklemiyor.')).toBeInTheDocument();
    expect(within(passkeys).queryByRole('button', { name: 'Passkey ekle' })).not.toBeInTheDocument();
  });

  it('adds a passkey: the password, the browser’s window, then the answer, named after this device', async () => {
    signedIn({ passkeys: [] });
    const options = { challenge: 'Y2hhbGxlbmdl', rp: { id: 'localhost', name: 'NetBoxPlus' } };
    const created: unknown[] = [];
    supportPasskeys((publicKey) => {
      created.push(publicKey);
      return Promise.resolve({ toJSON: () => ({ id: 'cred', type: 'public-key' }) });
    });
    const sent: unknown[] = [];
    server.use(
      http.post(`${gatewayUrl}/session/passkeys/options`, async ({ request }) => {
        sent.push(await request.json());
        return HttpResponse.json({ challengeId: 'challenge-1', options });
      }),
      http.post(`${gatewayUrl}/session/passkeys`, async ({ request }) => {
        sent.push(await request.json());
        return HttpResponse.json({ id: 'new' }, { status: 201 });
      }),
    );
    page();

    await userEvent.click(await screen.findByRole('button', { name: 'Passkey ekle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Passkey ekle' });
    expect(within(dialog).getByLabelText('Ad')).toHaveValue('Chrome · Windows');
    await userEvent.type(within(dialog).getByLabelText('Mevcut şifre'), 'correct horse');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Devam et' }));

    expect(await screen.findByText('Passkey eklendi.')).toBeInTheDocument();
    expect(created).toEqual([{ parsed: options }]);
    expect(sent).toEqual([
      { password: 'correct horse' },
      {
        challengeId: 'challenge-1',
        name: 'Chrome · Windows',
        credential: { id: 'cred', type: 'public-key' },
      },
    ]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the form quietly when the browser’s window is closed, and shows a wrong password', async () => {
    signedIn({ passkeys: [] });
    supportPasskeys(() => Promise.reject(new DOMException('closed', 'NotAllowedError')));
    let attempts = 0;
    server.use(
      http.post(`${gatewayUrl}/session/passkeys/options`, () => {
        attempts++;
        return attempts === 1
          ? HttpResponse.json({ challengeId: 'c', options: { challenge: 'x' } })
          : problem(400, 'User.PasswordIncorrect');
      }),
    );
    page();

    await userEvent.click(await screen.findByRole('button', { name: 'Passkey ekle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Passkey ekle' });
    await userEvent.type(within(dialog).getByLabelText('Mevcut şifre'), 'correct horse');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Devam et' }));

    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: 'Devam et' })).toBeEnabled();
    });
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Devam et' }));
    expect(await within(dialog).findByText('Şifre hatalı.')).toBeInTheDocument();
  });

  it('renames and deletes a passkey', async () => {
    signedIn();
    const changes: string[] = [];
    server.use(
      http.put(`${gatewayUrl}/session/passkeys/:id`, async ({ params, request }) => {
        changes.push(`rename ${String(params.id)} ${JSON.stringify(await request.json())}`);
        return new HttpResponse(null, { status: 204 });
      }),
      http.delete(`${gatewayUrl}/session/passkeys/:id`, ({ params }) => {
        changes.push(`delete ${String(params.id)}`);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    page();

    await userEvent.click(await screen.findByRole('button', { name: 'Yeniden adlandır: Laptop' }));
    const rename = await screen.findByRole('dialog', { name: 'Passkey’i yeniden adlandır' });
    await userEvent.clear(within(rename).getByLabelText('Ad'));
    await userEvent.type(within(rename).getByLabelText('Ad'), 'Work laptop');
    await userEvent.click(within(rename).getByRole('button', { name: 'Kaydet' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Sil: Laptop' }));
    const remove = await screen.findByRole('dialog', { name: '“Laptop” silinsin mi?' });
    await userEvent.click(within(remove).getByRole('button', { name: 'Sil' }));

    await waitFor(() => {
      expect(changes).toEqual([`rename ${laptopKey.id} {"name":"Work laptop"}`, `delete ${laptopKey.id}`]);
    });
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
