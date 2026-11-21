import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { EmailDetails, EmailSummary } from '../data/emails';
import { gatewayUrl, locationOf, problem, renderApp, server, signInWith } from '../test/render';

const notificationUrl = `${gatewayUrl}/admin/notification`;
const authUrl = `${gatewayUrl}/admin/auth`;
const userId = '0195f0e0-0000-7000-8000-0000000000d1';

function summary(email: Partial<EmailSummary> & { id: string }): EmailSummary {
  return {
    userId,
    kind: 'Welcome',
    status: 'Sent',
    subject: 'NetBoxPlus’a hoş geldin',
    attempts: 1,
    createdAt: '2026-11-20T10:00:00Z',
    sentAt: '2026-11-20T10:00:05Z',
    ...email,
  };
}

const failed: EmailDetails = {
  id: 'mail-1',
  userId,
  kind: 'PaymentFailed',
  sourceKey: 'in_123',
  status: 'Failed',
  subject: 'Ödemen alınamadı',
  attempts: 8,
  nextAttemptAt: '2026-11-21T10:00:00Z',
  lastError: 'SMTP 550: mailbox unavailable',
  hasContent: true,
  createdAt: '2026-11-20T10:00:00Z',
  sentAt: null,
};

const page = (items: EmailSummary[], totalCount = items.length) =>
  HttpResponse.json({ items, pageNumber: 1, pageSize: 20, totalCount });

describe('EmailsPage', () => {
  it('lists the queue, filtered by status, kind and user in the address', async () => {
    signInWith(['notification:emails:read']);
    const asked: string[] = [];
    server.use(
      http.get(`${notificationUrl}/emails`, ({ request }) => {
        asked.push(new URL(request.url).search);
        return page(
          [
            summary({ id: 'mail-2' }),
            summary({
              id: 'mail-1',
              kind: 'PaymentFailed',
              status: 'Failed',
              subject: 'Ödemen alınamadı',
              attempts: 8,
            }),
          ],
          45,
        );
      }),
    );
    const { router } = renderApp(`/emails?userId=${userId}`);

    const table = await screen.findByRole('table');
    expect(document.title).toBe('E-postalar');
    expect(
      within(screen.getByRole('navigation', { name: 'Yönetim menüsü' })).getByRole('link', {
        name: 'E-postalar',
      }),
    ).toHaveAttribute('href', '/emails');
    const rows = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((row) =>
        within(row)
          .getAllByRole('cell')
          .map((cell) => cell.textContent),
      );
    expect(rows.map((row) => row.slice(0, 4))).toEqual([
      ['NetBoxPlus’a hoş geldin', 'Hoş geldin', 'Gönderildi', '1'],
      ['Ödemen alınamadı', 'Ödeme alınamadı', 'Başarısız', '8'],
    ]);
    expect(rows[0]?.[4]).toMatch(/2026/);
    expect(screen.getByRole('link', { name: 'Ödemen alınamadı' })).toHaveAttribute('href', '/emails/mail-1');
    expect(screen.getByText('Bir kullanıcının e-postaları gösteriliyor.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Sonraki' }));
    await waitFor(() => {
      expect(locationOf(router)).toBe(`/emails?userId=${userId}&page=2`);
    });
    await userEvent.selectOptions(screen.getByLabelText('Durum'), 'Başarısız');
    await waitFor(() => {
      expect(locationOf(router)).toBe(`/emails?userId=${userId}&status=Failed`);
    });
    await userEvent.selectOptions(screen.getByLabelText('Tür'), 'Ödeme alınamadı');
    await waitFor(() => {
      expect(locationOf(router)).toBe(`/emails?userId=${userId}&status=Failed&kind=PaymentFailed`);
    });
    expect(screen.getByLabelText('Tür')).toHaveValue('PaymentFailed');
    await userEvent.click(screen.getByRole('button', { name: 'Herkesi göster' }));
    await waitFor(() => {
      expect(locationOf(router)).toBe('/emails?status=Failed&kind=PaymentFailed');
    });
    expect(screen.queryByText('Bir kullanıcının e-postaları gösteriliyor.')).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Tür'), 'Hepsi');
    await waitFor(() => {
      expect(locationOf(router)).toBe('/emails?status=Failed');
    });
    expect(asked).toEqual([
      `?userId=${userId}&page=1&pageSize=20`,
      `?userId=${userId}&page=2&pageSize=20`,
      `?status=Failed&userId=${userId}&page=1&pageSize=20`,
      `?status=Failed&kind=PaymentFailed&userId=${userId}&page=1&pageSize=20`,
      '?status=Failed&kind=PaymentFailed&page=1&pageSize=20',
      '?status=Failed&page=1&pageSize=20',
    ]);
  });

  it('asks again while an e-mail is waiting to go, and stops once none is', async () => {
    signInWith(['notification:emails:read']);
    let asked = 0;
    server.use(
      http.get(`${notificationUrl}/emails`, () => {
        asked += 1;
        return page([summary({ id: 'mail-3', status: asked === 1 ? 'Pending' : 'Sent', attempts: 0 })]);
      }),
    );
    renderApp('/emails');

    expect(await screen.findByText('Bekliyor', { selector: 'span' })).toBeInTheDocument();
    expect(
      await screen.findByText('Gönderildi', { selector: 'span' }, { timeout: 7000 }),
    ).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 5500));
    expect(asked).toBe(2);
  }, 15000);

  it('says when nothing matches and when the queue cannot be read', async () => {
    signInWith(['notification:emails:read']);
    let answer = () => page([]);
    server.use(http.get(`${notificationUrl}/emails`, () => answer()));
    const first = renderApp('/emails?status=bogus&kind=bogus');
    expect(await screen.findByText('E-posta bulunamadı.')).toBeInTheDocument();
    expect(screen.getByLabelText('Durum')).toHaveValue('');
    expect(screen.getByLabelText('Tür')).toHaveValue('');
    first.unmount();

    answer = () => problem(403, 'Error.Forbidden');
    renderApp('/emails');
    expect(await screen.findByRole('alert')).toHaveTextContent(/./);
  });
});

describe('EmailPage', () => {
  it('shows a failed e-mail and sends it again', async () => {
    signInWith(['notification:emails:read', 'notification:emails:write', 'auth:users:read']);
    let current = failed;
    let answer = () => problem(409, 'Email.NotFailed');
    let retried = 0;
    server.use(
      http.get(`${notificationUrl}/emails/${failed.id}`, () => HttpResponse.json(current)),
      http.post(`${notificationUrl}/emails/${failed.id}/retry`, () => {
        retried += 1;
        return answer();
      }),
    );
    renderApp(`/emails/${failed.id}`);

    expect(await screen.findByRole('heading', { level: 1, name: 'Ödemen alınamadı' })).toBeInTheDocument();
    expect(document.title).toBe('Ödemen alınamadı');
    const facts = Object.fromEntries(
      screen.getAllByRole('term').map((term) => [term.textContent, term.nextElementSibling?.textContent]),
    );
    expect(facts).toEqual({
      Tür: 'Ödeme alınamadı',
      Kullanıcı: 'Kullanıcıyı aç',
      Deneme: '8',
      'Kuyruğa girdi': expect.stringMatching(/2026/) as string,
      Gönderildi: '—',
      İçerik: 'Saklanıyor',
      Kaynak: 'in_123',
    });
    expect(screen.getByRole('link', { name: 'Kullanıcıyı aç' })).toHaveAttribute('href', `/users/${userId}`);
    expect(screen.getByText('SMTP 550: mailbox unavailable')).toBeInTheDocument();

    const retry = screen.getByRole('region', { name: 'Tekrar gönder' });
    expect(retry).toHaveTextContent('ilk denemeden başlayarak');
    await userEvent.click(within(retry).getByRole('button', { name: 'Tekrar gönder' }));
    expect(await within(retry).findByRole('alert')).toHaveTextContent(
      'Sadece başarısız bir e-posta tekrar gönderilebilir.',
    );

    answer = () => {
      current = { ...failed, status: 'Pending', attempts: 0, lastError: null };
      return new HttpResponse(null, { status: 204 });
    };
    await userEvent.click(within(retry).getByRole('button', { name: 'Tekrar gönder' }));
    expect(await screen.findByText('Bekliyor')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Tekrar gönder' })).not.toBeInTheDocument();
    expect(screen.getByText('Sonraki deneme')).toBeInTheDocument();
    expect(screen.queryByText('Son hata')).not.toBeInTheDocument();
    expect(retried).toBe(2);
  });

  it('asks again while the e-mail is waiting to go', async () => {
    signInWith(['notification:emails:read']);
    let asked = 0;
    server.use(
      http.get(`${notificationUrl}/emails/${failed.id}`, () => {
        asked += 1;
        return HttpResponse.json({
          ...failed,
          status: asked === 1 ? 'Pending' : 'Sent',
          sentAt: asked === 1 ? null : '2026-11-21T10:00:05Z',
        });
      }),
    );
    renderApp(`/emails/${failed.id}`);

    expect(await screen.findByText('Bekliyor')).toBeInTheDocument();
    expect(
      await screen.findByText('Gönderildi', { selector: 'span' }, { timeout: 7000 }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Sonraki deneme')).not.toBeInTheDocument();
    expect(screen.getByText('Gönderildi', { selector: 'dt' }).nextElementSibling).toHaveTextContent(/2026/);
  }, 10000);

  it('offers no sending again once the content is gone, or without the permission', async () => {
    signInWith(['notification:emails:read', 'notification:emails:write']);
    let current: EmailDetails = { ...failed, hasContent: false, lastError: null };
    server.use(http.get(`${notificationUrl}/emails/${failed.id}`, () => HttpResponse.json(current)));
    const first = renderApp(`/emails/${failed.id}`);

    const retry = await screen.findByRole('region', { name: 'Tekrar gönder' });
    expect(retry).toHaveTextContent('İçeriği artık saklanmıyor; tekrar gönderilemez.');
    expect(within(retry).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Silindi')).toBeInTheDocument();
    // Without the users permission, the user is named by id.
    expect(screen.queryByRole('link', { name: 'Kullanıcıyı aç' })).not.toBeInTheDocument();
    expect(screen.getByText(userId)).toBeInTheDocument();
    first.unmount();

    signInWith(['notification:emails:read']);
    current = failed;
    const second = renderApp(`/emails/${failed.id}`);
    await screen.findByRole('heading', { level: 1, name: 'Ödemen alınamadı' });
    expect(screen.queryByRole('region', { name: 'Tekrar gönder' })).not.toBeInTheDocument();
    second.unmount();

    signInWith(['notification:emails:read', 'notification:emails:write']);
    current = { ...failed, status: 'Sent', sentAt: '2026-11-20T10:00:05Z' };
    renderApp(`/emails/${failed.id}`);
    await screen.findByRole('heading', { level: 1, name: 'Ödemen alınamadı' });
    expect(screen.queryByRole('region', { name: 'Tekrar gönder' })).not.toBeInTheDocument();
  });

  it('says when the e-mail cannot be found', async () => {
    signInWith(['notification:emails:read']);
    server.use(http.get(`${notificationUrl}/emails/gone`, () => problem(404, 'Email.NotFound')));
    renderApp('/emails/gone');

    expect(await screen.findByRole('alert')).toHaveTextContent('Bu e-posta bulunamadı.');
  });
});

describe('UserEmails', () => {
  const deniz = {
    id: userId,
    email: 'deniz@example.test',
    emailVerified: true,
    isDisabled: false,
    lockedOutUntil: null,
    failedSignInCount: 0,
    createdAt: '2026-11-10T09:00:00Z',
    modifiedAt: null,
    roles: [],
  };

  it('shows the user’s latest e-mails on their page, asked beside the account', async () => {
    signInWith(['auth:users:read', 'notification:emails:read']);
    const asked: string[] = [];
    let releaseUser: () => void = () => undefined;
    const userHeld = new Promise<void>((resolve) => {
      releaseUser = resolve;
    });
    server.use(
      http.get(`${authUrl}/users/${userId}`, async () => {
        await userHeld;
        return HttpResponse.json(deniz);
      }),
      http.get(`${notificationUrl}/emails`, ({ request }) => {
        asked.push(new URL(request.url).search);
        return page(
          [
            summary({ id: 'mail-2' }),
            summary({ id: 'mail-1', status: 'Failed', subject: 'Ödemen alınamadı' }),
          ],
          9,
        );
      }),
    );
    renderApp(`/users/${userId}`);

    await waitFor(() => {
      expect(asked).toEqual([`?userId=${userId}&page=1&pageSize=5`]);
    });
    releaseUser();
    const panel = await screen.findByRole('region', { name: 'E-postalar' });
    expect(within(panel).getByRole('link', { name: 'Ödemen alınamadı' })).toHaveAttribute(
      'href',
      '/emails/mail-1',
    );
    expect(within(panel).getByText('Başarısız')).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'Hepsini gör (9)' })).toHaveAttribute(
      'href',
      `/emails?userId=${userId}`,
    );
  });

  it('says when the user has none or they cannot be read, and is left out without the permission', async () => {
    signInWith(['auth:users:read', 'notification:emails:read']);
    let answer = () => page([]);
    server.use(
      http.get(`${authUrl}/users/${userId}`, () => HttpResponse.json(deniz)),
      http.get(`${notificationUrl}/emails`, () => answer()),
    );
    const first = renderApp(`/users/${userId}`);
    const panel = await screen.findByRole('region', { name: 'E-postalar' });
    expect(await within(panel).findByText('E-postası yok.')).toBeInTheDocument();
    first.unmount();

    answer = () => page([summary({ id: 'mail-2' })], 1);
    const second = renderApp(`/users/${userId}`);
    const one = await screen.findByRole('region', { name: 'E-postalar' });
    await within(one).findByRole('link', { name: 'NetBoxPlus’a hoş geldin' });
    expect(within(one).queryByRole('link', { name: /Hepsini gör/ })).not.toBeInTheDocument();
    second.unmount();

    answer = () => problem(403, 'Error.Forbidden');
    const third = renderApp(`/users/${userId}`);
    expect(
      await within(await screen.findByRole('region', { name: 'E-postalar' })).findByRole('alert'),
    ).toHaveTextContent(/./);
    third.unmount();

    signInWith(['auth:users:read']);
    let asked = false;
    server.use(
      http.get(`${notificationUrl}/emails`, () => {
        asked = true;
        return page([]);
      }),
    );
    renderApp(`/users/${userId}`);
    await screen.findByRole('heading', { level: 1, name: 'deniz@example.test' });
    expect(screen.queryByRole('region', { name: 'E-postalar' })).not.toBeInTheDocument();
    expect(asked).toBe(false);
  });
});
