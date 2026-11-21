import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { SubscriptionDetails, SubscriptionSummary } from '../data/billing';
import { gatewayUrl, locationOf, problem, renderApp, server, signInWith } from '../test/render';

const billingUrl = `${gatewayUrl}/admin/billing`;
const authUrl = `${gatewayUrl}/admin/auth`;
const userId = '0195f0e0-0000-7000-8000-0000000000d1';

function summary(subscription: Partial<SubscriptionSummary> & { id: string }): SubscriptionSummary {
  return {
    userId,
    email: 'deniz@example.test',
    planId: 'plan-premium',
    planName: 'Premium',
    status: 'Active',
    currentPeriodEnd: '2026-12-20T10:00:00Z',
    cancelAtPeriodEnd: false,
    createdAt: '2026-11-20T10:00:00Z',
    ...subscription,
  };
}

const details: SubscriptionDetails = {
  id: 'sub-1',
  userId,
  email: 'deniz@example.test',
  plan: { id: 'plan-premium', name: 'Premium', language: 'tr', quality: 'Hd', maxScreens: 4 },
  status: 'Active',
  providerSubscriptionId: 'sub_stripe_1',
  currentPeriodEnd: '2026-12-20T10:00:00Z',
  cancelAtPeriodEnd: false,
  canceledAt: null,
  revision: 3,
  createdAt: '2026-11-20T10:00:00Z',
  invoices: [
    {
      id: 'in-2',
      amountMinor: 24999,
      currency: 'TRY',
      status: 'PaymentFailed',
      issuedAt: '2026-12-20T10:00:00Z',
      paidAt: null,
      cardBrand: null,
      cardLast4: null,
    },
    {
      id: 'in-1',
      amountMinor: 24999,
      currency: 'TRY',
      status: 'Paid',
      issuedAt: '2026-11-20T10:00:00Z',
      paidAt: '2026-11-20T10:01:00Z',
      cardBrand: 'visa',
      cardLast4: '4242',
    },
  ],
};

const page = (items: SubscriptionSummary[], totalCount = items.length) =>
  HttpResponse.json({ items, pageNumber: 1, pageSize: 20, totalCount });

describe('SubscriptionsPage', () => {
  it('lists the subscriptions, filtered by status and user in the address', async () => {
    signInWith(['billing:subscriptions:read']);
    const asked: string[] = [];
    server.use(
      http.get(`${billingUrl}/subscriptions`, ({ request }) => {
        asked.push(new URL(request.url).search);
        return page(
          [
            summary({ id: 'sub-1' }),
            summary({
              id: 'sub-2',
              email: null,
              status: 'PastDue',
              cancelAtPeriodEnd: true,
              currentPeriodEnd: null,
            }),
          ],
          45,
        );
      }),
    );
    const { router } = renderApp(`/subscriptions?userId=${userId}`);

    const table = await screen.findByRole('table');
    expect(document.title).toBe('Abonelikler');
    const rows = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((row) =>
        within(row)
          .getAllByRole('cell')
          .map((cell) => cell.textContent),
      );
    expect(rows[0]?.slice(0, 3)).toEqual(['deniz@example.test', 'Premium', 'Aktif']);
    expect(rows[0]?.[3]).toMatch(/2026/);
    expect(rows[1]?.slice(0, 4)).toEqual([
      '(adres yok)',
      'Premium',
      'Ödeme bekleniyorDönem sonunda bitecek',
      '—',
    ]);
    expect(screen.getByRole('link', { name: 'deniz@example.test' })).toHaveAttribute(
      'href',
      '/subscriptions/sub-1',
    );
    expect(screen.getByText('Bir kullanıcının abonelikleri gösteriliyor.')).toBeInTheDocument();
    expect(asked).toEqual([`?userId=${userId}&page=1&pageSize=20`]);

    await userEvent.click(screen.getByRole('button', { name: 'Sonraki' }));
    await waitFor(() => {
      expect(locationOf(router)).toBe(`/subscriptions?userId=${userId}&page=2`);
    });
    await userEvent.selectOptions(screen.getByLabelText('Durum'), 'Ödeme bekleniyor');
    await waitFor(() => {
      expect(locationOf(router)).toBe(`/subscriptions?userId=${userId}&status=PastDue`);
    });
    await userEvent.click(screen.getByRole('button', { name: 'Herkesi göster' }));
    await waitFor(() => {
      expect(locationOf(router)).toBe('/subscriptions?status=PastDue');
    });
    expect(screen.queryByText('Bir kullanıcının abonelikleri gösteriliyor.')).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Durum'), 'Hepsi');
    await waitFor(() => {
      expect(locationOf(router)).toBe('/subscriptions');
    });
    expect(asked).toEqual([
      `?userId=${userId}&page=1&pageSize=20`,
      `?userId=${userId}&page=2&pageSize=20`,
      `?status=PastDue&userId=${userId}&page=1&pageSize=20`,
      '?status=PastDue&page=1&pageSize=20',
      '?page=1&pageSize=20',
    ]);
  });

  it('says when nothing matches and when the list cannot be read', async () => {
    signInWith(['billing:subscriptions:read']);
    let answer = () => page([]);
    server.use(http.get(`${billingUrl}/subscriptions`, () => answer()));
    const first = renderApp('/subscriptions?status=bogus');
    expect(await screen.findByText('Abonelik bulunamadı.')).toBeInTheDocument();
    expect(screen.getByLabelText('Durum')).toHaveValue('');
    first.unmount();

    answer = () => problem(403, 'Error.Forbidden');
    renderApp('/subscriptions');
    expect(await screen.findByRole('alert')).toHaveTextContent(/./);
  });
});

describe('SubscriptionPage', () => {
  it('shows the subscription with links to the user and the plan, and its invoices', async () => {
    signInWith(['billing:subscriptions:read', 'billing:plans:read', 'auth:users:read']);
    server.use(http.get(`${billingUrl}/subscriptions/sub-1`, () => HttpResponse.json(details)));
    renderApp('/subscriptions/sub-1');

    expect(await screen.findByRole('heading', { level: 1, name: 'Premium' })).toBeInTheDocument();
    expect(document.title).toBe('Premium · deniz@example.test');
    const facts = Object.fromEntries(
      screen.getAllByRole('term').map((term) => [term.textContent, term.nextElementSibling?.textContent]),
    );
    expect(facts).toMatchObject({
      Kullanıcı: 'deniz@example.test',
      Plan: 'Premium',
      Yenileme: 'Dönem sonunda yenilenir',
      'Stripe aboneliği': 'sub_stripe_1',
    });
    expect(screen.getByRole('link', { name: 'deniz@example.test' })).toHaveAttribute(
      'href',
      `/users/${userId}`,
    );
    expect(screen.getByRole('link', { name: 'Premium' })).toHaveAttribute('href', '/plans/plan-premium');
    const invoices = within(screen.getByRole('region', { name: 'Faturalar' }))
      .getAllByRole('row')
      .slice(1)
      .map((row) =>
        within(row)
          .getAllByRole('cell')
          .map((cell) => cell.textContent),
      );
    expect(invoices[0]).toEqual([expect.any(String), '₺249,99', 'Ödenemedi', '—', '—']);
    expect(invoices[1]?.slice(1, 3)).toEqual(['₺249,99', 'Ödendi']);
    expect(invoices[1]?.[3]).toMatch(/2026/);
    expect(invoices[1]?.[4]).toBe('visa •••• 4242');
  });

  it('names without links when the user or plan cannot be read, and says how it ends', async () => {
    signInWith(['billing:subscriptions:read']);
    let current: SubscriptionDetails = { ...details, cancelAtPeriodEnd: true, email: null, invoices: [] };
    server.use(http.get(`${billingUrl}/subscriptions/sub-1`, () => HttpResponse.json(current)));
    const first = renderApp('/subscriptions/sub-1');

    await screen.findByRole('heading', { level: 1, name: 'Premium' });
    expect(document.title).toBe('Premium · (adres yok)');
    expect(screen.queryByRole('link', { name: '(adres yok)' })).not.toBeInTheDocument();
    expect(screen.getByText('(adres yok)')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Premium' })).not.toBeInTheDocument();
    expect(screen.getByText('Dönem sonunda bitecek')).toBeInTheDocument();
    expect(screen.getByText('Henüz fatura yok.')).toBeInTheDocument();
    first.unmount();

    current = { ...details, status: 'Canceled', canceledAt: '2026-11-25T10:00:00Z', currentPeriodEnd: null };
    renderApp('/subscriptions/sub-1');
    expect(await screen.findByText(/tarihinde bitti$/)).toBeInTheDocument();
    expect(screen.getByText('Sona erdi')).toBeInTheDocument();
  });

  it('says when the subscription cannot be found', async () => {
    signInWith(['billing:subscriptions:read']);
    server.use(http.get(`${billingUrl}/subscriptions/gone`, () => problem(404, 'Subscription.NotFound')));
    renderApp('/subscriptions/gone');

    expect(await screen.findByRole('alert')).toHaveTextContent('Bu abonelik bulunamadı.');
  });
});

describe('UserSubscriptions', () => {
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

  it('shows the user’s latest subscriptions on their page, asked beside the account', async () => {
    signInWith(['auth:users:read', 'billing:subscriptions:read']);
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
      http.get(`${billingUrl}/subscriptions`, ({ request }) => {
        asked.push(new URL(request.url).search);
        return page(
          [summary({ id: 'sub-1' }), summary({ id: 'sub-0', status: 'Canceled', planName: 'Temel' })],
          7,
        );
      }),
    );
    renderApp(`/users/${userId}`);

    // Billing is asked while Auth has not answered yet.
    await waitFor(() => {
      expect(asked).toEqual([`?userId=${userId}&page=1&pageSize=5`]);
    });
    releaseUser();
    const panel = await screen.findByRole('region', { name: 'Abonelikler' });
    expect(within(panel).getByRole('link', { name: 'Premium' })).toHaveAttribute(
      'href',
      '/subscriptions/sub-1',
    );
    expect(within(panel).getByText('Sona erdi')).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'Hepsini gör (7)' })).toHaveAttribute(
      'href',
      `/subscriptions?userId=${userId}`,
    );
  });

  it('says when the user has none or they cannot be read, and is left out without the permission', async () => {
    signInWith(['auth:users:read', 'billing:subscriptions:read']);
    let answer = () => page([]);
    server.use(
      http.get(`${authUrl}/users/${userId}`, () => HttpResponse.json(deniz)),
      http.get(`${billingUrl}/subscriptions`, () => answer()),
    );
    const first = renderApp(`/users/${userId}`);
    const panel = await screen.findByRole('region', { name: 'Abonelikler' });
    expect(await within(panel).findByText('Aboneliği yok.')).toBeInTheDocument();
    expect(within(panel).queryByRole('link')).not.toBeInTheDocument();
    first.unmount();

    answer = () => page([summary({ id: 'sub-1' })], 1);
    const second = renderApp(`/users/${userId}`);
    const one = await screen.findByRole('region', { name: 'Abonelikler' });
    await within(one).findByRole('link', { name: 'Premium' });
    expect(within(one).queryByRole('link', { name: /Hepsini gör/ })).not.toBeInTheDocument();
    second.unmount();

    answer = () => problem(403, 'Error.Forbidden');
    const third = renderApp(`/users/${userId}`);
    expect(
      await within(await screen.findByRole('region', { name: 'Abonelikler' })).findByRole('alert'),
    ).toHaveTextContent(/./);
    third.unmount();

    signInWith(['auth:users:read']);
    let asked = false;
    server.use(
      http.get(`${billingUrl}/subscriptions`, () => {
        asked = true;
        return page([]);
      }),
    );
    renderApp(`/users/${userId}`);
    await screen.findByRole('heading', { level: 1, name: 'deniz@example.test' });
    expect(screen.queryByRole('region', { name: 'Abonelikler' })).not.toBeInTheDocument();
    expect(asked).toBe(false);
  });
});
