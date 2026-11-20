import { useSession } from '@netboxplus/core';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import {
  gatewayUrl,
  navigation,
  problem,
  renderPage,
  server,
  signInAs,
  viewerSession,
} from '../../test/render';
import { DeleteAccount } from './delete-account';

function subscription(status: string | null) {
  server.use(
    http.get(`${gatewayUrl}/billing/subscription`, () =>
      status
        ? HttpResponse.json({
            id: 's',
            status,
            plan: { id: 'p', name: 'Premium', language: 'tr', quality: 'Hd', maxScreens: 4 },
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
            canceledAt: null,
            startedAt: '2026-11-20T12:00:00Z',
          })
        : problem(404, 'Subscription.None'),
    ),
  );
}

function deletion(answer?: () => Response) {
  const sent: unknown[] = [];
  server.use(
    http.post(`${gatewayUrl}/session/deletion`, async ({ request }) => {
      sent.push(await request.json());
      return answer ? answer() : new HttpResponse(null, { status: 204 });
    }),
  );
  return sent;
}

/** The session as the rest of the page sees it: its address, or "none" once forgotten. */
function SessionProbe() {
  const session = useSession();
  return (
    <p data-testid="session">{session.data === undefined ? 'loading' : (session.data?.email ?? 'none')}</p>
  );
}

const cachedSession = () => screen.getByTestId('session').textContent;

function page() {
  return renderPage(
    <>
      <DeleteAccount />
      <SessionProbe />
    </>,
  );
}

async function confirm(password: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Hesabı sil' }));
  const dialog = await screen.findByRole('dialog', { name: 'Hesabın kalıcı olarak silinsin mi?' });
  if (password) {
    await user.type(within(dialog).getByLabelText('Mevcut şifre'), password);
  }
  await user.click(within(dialog).getByRole('button', { name: 'Hesabı kalıcı olarak sil' }));
  return dialog;
}

describe('DeleteAccount', () => {
  it('says what is deleted, and that a live membership ends at once', async () => {
    signInAs();
    subscription('Active');
    page();

    expect(screen.getByRole('region', { name: 'Hesabı sil' })).toHaveTextContent('kalıcı olarak siler');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Hesabı sil' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleDescription(
      'Profillerin, izleme geçmişin ve Listem silinir. Bu geri alınamaz.',
    );
    expect(
      await within(dialog).findByText('Aktif üyeliğin hemen ve iadesiz iptal edilir.'),
    ).toBeInTheDocument();
  });

  it('leaves the membership out when there is none to end', async () => {
    signInAs();
    subscription('Canceled');
    page();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Hesabı sil' }));

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText(/iadesiz/)).not.toBeInTheDocument();
  });

  it('asks for the password before sending anything', async () => {
    signInAs();
    subscription(null);
    const sent = deletion();
    page();

    const dialog = await confirm('');

    expect(await within(dialog).findByText('Bu alan zorunlu.')).toBeInTheDocument();
    expect(sent).toEqual([]);
  });

  it('puts a wrong password on its field and keeps the account', async () => {
    signInAs();
    subscription(null);
    deletion(() => problem(400, 'User.PasswordIncorrect'));
    page();

    const dialog = await confirm('wrong');

    expect(await within(dialog).findByText('Şifre hatalı.')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Mevcut şifre')).toHaveAttribute('aria-invalid', 'true');
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('says why else it could not', async () => {
    signInAs();
    subscription(null);
    deletion(() => problem(429, 'RateLimit.Exceeded'));
    page();

    const dialog = await confirm('the password');

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Çok fazla deneme yaptın.');
  });

  it('forgets a cancelled attempt', async () => {
    signInAs();
    subscription(null);
    deletion(() => problem(400, 'User.PasswordIncorrect'));
    page();
    const user = userEvent.setup();

    await confirm('wrong');
    await screen.findByText('Şifre hatalı.');
    await user.click(screen.getByRole('button', { name: 'Vazgeç' }));
    await user.click(screen.getByRole('button', { name: 'Hesabı sil' }));

    expect(within(await screen.findByRole('dialog')).getByLabelText('Mevcut şifre')).toHaveValue('');
    expect(screen.queryByText('Şifre hatalı.')).not.toBeInTheDocument();
  });

  it('says the account is gone, then forgets it in this tab and goes home', async () => {
    signInAs();
    subscription(null);
    const sent = deletion();
    page();
    await waitFor(() => {
      expect(cachedSession()).toBe(viewerSession.email);
    });

    const dialog = await confirm('the password');

    expect(await within(dialog).findByRole('heading', { name: 'Hesabın silindi.' })).toBeInTheDocument();
    expect(sent).toEqual([{ password: 'the password' }]);
    // Still known until the visitor leaves: the page would otherwise send them to sign in first.
    expect(cachedSession()).toBe(viewerSession.email);
    expect(document.cookie).toContain('nbp-profile=');

    await userEvent.setup().click(within(dialog).getByRole('button', { name: 'Ana sayfaya dön' }));

    expect(navigation.replace).toHaveBeenCalledWith('/tr');
    expect(cachedSession()).toBe('none');
    expect(document.cookie).not.toContain('nbp-profile=');
  });

  it('goes home too when the dialog is closed after the deletion', async () => {
    signInAs();
    subscription(null);
    deletion();
    page();

    await confirm('the password');
    await screen.findByRole('heading', { name: 'Hesabın silindi.' });
    await userEvent.setup().keyboard('{Escape}');

    expect(navigation.replace).toHaveBeenCalledWith('/tr');
    expect(cachedSession()).toBe('none');
  });
});
