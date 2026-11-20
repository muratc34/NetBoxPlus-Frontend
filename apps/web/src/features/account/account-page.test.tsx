import type { InvoiceSummary, MySubscription } from '@netboxplus/core';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { leaveSiteFor } from '../../leave-site';
import {
  gatewayUrl,
  navigation,
  problem,
  renderPage,
  server,
  signInAs,
  viewerSession,
} from '../../test/render';
import { AccountPage } from './account-page';
import { cardLabel, formatDate, Membership } from './membership';

vi.mock('../../leave-site', () => ({ leaveSiteFor: vi.fn() }));

const premium = {
  id: '0195f0e0-0000-7000-8000-0000000000b2',
  name: 'Premium',
  language: 'tr',
  quality: 'Hd' as const,
  maxScreens: 4,
};

function subscription(changes: Partial<MySubscription> = {}): MySubscription {
  return {
    id: 's',
    status: 'Active',
    plan: premium,
    currentPeriodEnd: '2026-12-20T12:00:00Z',
    cancelAtPeriodEnd: false,
    canceledAt: null,
    startedAt: '2026-11-20T12:00:00Z',
    ...changes,
  };
}

function invoice(index: number, changes: Partial<InvoiceSummary> = {}): InvoiceSummary {
  return {
    id: `0195f0e0-0000-7000-8000-${String(index).padStart(12, '0')}`,
    amountMinor: 19999,
    currency: 'TRY',
    status: 'Paid',
    issuedAt: '2026-11-20T12:00:00Z',
    paidAt: '2026-11-20T12:00:00Z',
    cardBrand: 'visa',
    cardLast4: '4242',
    ...changes,
  };
}

function billing({
  current,
  invoices = [],
}: {
  current: () => MySubscription | null;
  invoices?: InvoiceSummary[];
}) {
  const asked = { subscription: 0, invoices: [] as string[] };
  signInAs();
  server.use(
    http.get(`${gatewayUrl}/auth/email-verification`, () =>
      HttpResponse.json({ verified: true, verifiedAt: null }),
    ),
    http.get(`${gatewayUrl}/billing/subscription`, () => {
      asked.subscription++;
      const value = current();
      return value ? HttpResponse.json(value) : problem(404, 'Subscription.None');
    }),
    http.get(`${gatewayUrl}/billing/invoices`, ({ request }) => {
      const query = new URL(request.url).searchParams;
      asked.invoices.push(query.toString());
      const page = Number(query.get('page'));
      const size = Number(query.get('pageSize'));
      return HttpResponse.json({
        items: invoices.slice((page - 1) * size, page * size),
        pageNumber: page,
        pageSize: size,
        totalCount: invoices.length,
      });
    }),
  );
  return asked;
}

const membership = () => screen.getByRole('region', { name: 'Üyelik' });
const invoiceList = () => screen.getByRole('region', { name: 'Faturalar' });

beforeEach(() => {
  vi.mocked(leaveSiteFor).mockReset();
  navigation.pathname = '/tr/account';
});

describe('AccountPage', () => {
  it('sends a visitor without a session to sign in, coming back here', async () => {
    renderPage(<AccountPage />);

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith('/tr/sign-in?next=%2Ftr%2Faccount');
    });
  });

  it('waits for the session before sending anyone to sign in', async () => {
    billing({ current: () => null });
    server.use(
      http.get(`${gatewayUrl}/session`, async () => {
        await delay(100);
        return HttpResponse.json(viewerSession);
      }),
    );
    renderPage(<AccountPage />);

    expect(await screen.findByText('Henüz bir üyeliğin yok.')).toBeInTheDocument();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('puts the sign-in details first, then the membership, the profiles and deleting', async () => {
    billing({ current: () => null });
    renderPage(<AccountPage />);

    await screen.findByRole('region', { name: 'Giriş bilgileri' });
    expect(
      screen
        .getAllByRole('region')
        .map((region) => region.getAttribute('aria-labelledby') && region.querySelector('h2')?.textContent),
    ).toEqual(['Giriş bilgileri', 'Üyelik', 'Faturalar', 'Profiller', 'Hesabı sil']);
    expect(screen.getByRole('region', { name: 'Giriş bilgileri' })).toHaveTextContent(viewerSession.email);
    expect(screen.getByRole('link', { name: 'Profilleri yönet' })).toHaveAttribute('href', '/tr/profiles');
  });

  it('goes home after deleting the account, not to signing in', async () => {
    billing({ current: () => null });
    server.use(http.post(`${gatewayUrl}/session/deletion`, () => new HttpResponse(null, { status: 204 })));
    renderPage(<AccountPage />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Hesabı sil' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Mevcut şifre'), 'the password');
    await user.click(within(dialog).getByRole('button', { name: 'Hesabı kalıcı olarak sil' }));
    await user.click(await within(dialog).findByRole('button', { name: 'Ana sayfaya dön' }));

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(navigation.replace.mock.calls).toEqual([['/tr']]);
  });

  it('offers the plans to an account that never subscribed', async () => {
    billing({ current: () => null });
    renderPage(<AccountPage />);

    expect(await screen.findByText('Henüz bir üyeliğin yok.')).toBeInTheDocument();
    expect(within(membership()).getByRole('link', { name: 'Planları gör' })).toHaveAttribute(
      'href',
      '/tr/plans',
    );
    expect(await within(invoiceList()).findByText('Henüz fatura yok.')).toBeInTheDocument();
  });

  it("shows the subscription and opens the payment provider's page to manage it", async () => {
    billing({ current: () => subscription() });
    server.use(
      http.post(`${gatewayUrl}/billing/portal-sessions`, () =>
        HttpResponse.json({ url: 'https://portal.test/p' }),
      ),
    );
    renderPage(<AccountPage />);

    const portal = await screen.findByRole('button', { name: 'Ödeme ve üyelik ayarları' });
    const details = membership();
    expect(details).toHaveTextContent('PlanPremium · HD (1080p) · Aynı anda 4 ekran');
    expect(details).toHaveTextContent('DurumAktif');
    expect(details).toHaveTextContent('Sonraki ödeme: 20 Aralık 2026');
    expect(details).toHaveTextContent('Üyelik başlangıcı: 20 Kasım 2026');
    expect(portal).toHaveAccessibleDescription(/planını değiştirmek veya üyeliğini iptal etmek/);
    expect(within(details).queryByRole('link')).not.toBeInTheDocument();

    await userEvent.setup().click(portal);

    await waitFor(() => {
      expect(leaveSiteFor).toHaveBeenCalledWith('https://portal.test/p');
    });
    expect(portal).toBeDisabled();
    expect(portal).toHaveTextContent('Açılıyor…');
  });

  it('says why the portal did not open', async () => {
    billing({ current: () => subscription() });
    server.use(
      http.post(`${gatewayUrl}/billing/portal-sessions`, () => problem(503, 'Payments.Unavailable')),
    );
    renderPage(<AccountPage />);

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Ödeme ve üyelik ayarları' }));

    expect(await within(membership()).findByRole('alert')).toHaveTextContent('Şu an buna ulaşılamıyor.');
    expect(screen.getByRole('button', { name: 'Ödeme ve üyelik ayarları' })).toBeEnabled();
  });

  it.each([
    [{ cancelAtPeriodEnd: true }, '20 Aralık 2026 tarihinde sona erecek'],
    [{ status: 'PastDue' as const }, 'Son ödeme alınamadı.'],
    [{ status: 'Incomplete' as const }, 'İlk ödeme tamamlanmadı.'],
  ])('says what happens next: %o', async (changes, text) => {
    billing({ current: () => subscription(changes) });
    renderPage(<AccountPage />);
    await screen.findByRole('region', { name: 'Üyelik' });

    expect(await within(membership()).findByText(text, { exact: false })).toBeInTheDocument();
    expect(membership()).not.toHaveTextContent('Sonraki ödeme');
    expect(within(membership()).queryByRole('link')).not.toBeInTheDocument();
  });

  it('offers a new subscription once it has ended', async () => {
    billing({
      current: () =>
        subscription({ status: 'Canceled', canceledAt: '2026-12-01T12:00:00Z', currentPeriodEnd: null }),
    });
    renderPage(<AccountPage />);
    await screen.findByRole('region', { name: 'Üyelik' });

    expect(await within(membership()).findByText('1 Aralık 2026 tarihinde sona erdi')).toBeInTheDocument();
    expect(membership()).toHaveTextContent('DurumSona erdi');
    expect(within(membership()).getByRole('link', { name: 'Yeniden abone ol' })).toHaveAttribute(
      'href',
      '/tr/plans',
    );
    expect(
      within(membership()).getByRole('button', { name: 'Ödeme ve üyelik ayarları' }),
    ).toBeInTheDocument();
  });

  it('lists the invoices, ten at a time', async () => {
    const invoices = [
      invoice(1, { status: 'PaymentFailed', paidAt: null, cardBrand: null, cardLast4: null }),
      ...Array.from({ length: 10 }, (_, index) => invoice(index + 2)),
    ];
    const asked = billing({ current: () => subscription(), invoices });
    renderPage(<AccountPage />);
    await screen.findByRole('region', { name: 'Üyelik' });

    const table = await within(invoiceList()).findByRole('table');
    const rows = () => within(table).getAllByRole('row').slice(1);
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Tarih', 'Tutar', 'Durum', 'Kart']);
    expect(rows()).toHaveLength(10);
    expect(
      within(table)
        .getAllByRole('cell')
        .slice(0, 4)
        .map((cell) => cell.textContent),
    ).toEqual(['20 Kasım 2026', '₺199,99', 'Ödenemedi', '—']);
    expect(rows()[1]).toHaveTextContent('Ödendi');
    expect(rows()[1]).toHaveTextContent('Visa •••• 4242');

    await userEvent.setup().click(within(invoiceList()).getByRole('button', { name: 'Daha fazla göster' }));

    await waitFor(() => {
      expect(rows()).toHaveLength(11);
    });
    expect(within(invoiceList()).queryByRole('button')).not.toBeInTheDocument();
    expect(asked.invoices).toEqual(['page=1&pageSize=10', 'page=2&pageSize=10']);
  });

  it('says when it cannot read the membership', async () => {
    signInAs();
    server.use(
      http.get(`${gatewayUrl}/billing/subscription`, () => problem(400, 'Error.Validation')),
      http.get(`${gatewayUrl}/billing/invoices`, () => problem(400, 'Error.Validation')),
    );
    renderPage(<AccountPage />);
    await screen.findByRole('region', { name: 'Üyelik' });

    expect(await within(membership()).findByRole('alert')).toHaveTextContent('Bir şeyler ters gitti.');
    expect(await within(invoiceList()).findByRole('alert')).toHaveTextContent('Bir şeyler ters gitti.');
  });

  it('notices the return from a checkout', async () => {
    navigation.search = new URLSearchParams({ checkout: 'success' });
    billing({ current: () => null });
    renderPage(<AccountPage />);

    expect(await screen.findByRole('status')).toHaveTextContent('Ödemen alındı, üyeliğin etkinleştiriliyor…');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText('Henüz bir üyeliğin yok.')).not.toBeInTheDocument();
  });
});

describe('Membership after a checkout', () => {
  it('asks until the subscription is active, then shows it with its first invoice', async () => {
    let asked = 0;
    const calls = billing({
      current: () => (++asked < 3 ? null : subscription()),
      invoices: [invoice(1)],
    });
    signInAs();
    renderPage(<Membership checkoutReturned pollMs={20} waitMs={5_000} />);

    expect(await screen.findByRole('status')).toHaveTextContent('etkinleştiriliyor');
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Üyeliğin başladı. İyi seyirler!');
    });
    expect(membership()).toHaveTextContent('DurumAktif');
    await waitFor(() => {
      expect(calls.invoices.length).toBeGreaterThanOrEqual(2);
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(calls.subscription).toBe(3);
  });

  it('stops asking after a while and says it will show up soon', async () => {
    const calls = billing({ current: () => null });
    renderPage(<Membership checkoutReturned pollMs={20} waitMs={150} />);

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Ödemen işleniyor.');
    });
    const stopped = calls.subscription;
    expect(stopped).toBeGreaterThan(1);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(calls.subscription).toBe(stopped);
    expect(screen.queryByRole('link', { name: 'Planları gör' })).not.toBeInTheDocument();
  });

  it('asks once without a checkout', async () => {
    const calls = billing({ current: () => null });
    renderPage(<Membership checkoutReturned={false} pollMs={20} />);

    expect(await screen.findByText('Henüz bir üyeliğin yok.')).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(calls.subscription).toBe(1);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('cardLabel', () => {
  it('names the card as people do', () => {
    expect(cardLabel({ cardBrand: 'mastercard', cardLast4: '4444' })).toBe('Mastercard •••• 4444');
    expect(cardLabel({ cardBrand: 'AMEX', cardLast4: '0005' })).toBe('American Express •••• 0005');
    expect(cardLabel({ cardBrand: 'cartes_bancaires', cardLast4: '1001' })).toBe(
      'Cartes_bancaires •••• 1001',
    );
    expect(cardLabel({ cardBrand: 'visa', cardLast4: null })).toBeUndefined();
    expect(cardLabel({ cardBrand: null, cardLast4: '4242' })).toBeUndefined();
  });
});

describe('formatDate', () => {
  it('writes the day in the language', () => {
    expect(formatDate('2026-11-20T12:00:00Z', 'tr')).toBe('20 Kasım 2026');
    expect(formatDate('2026-11-20T12:00:00Z', 'en')).toBe('November 20, 2026');
  });
});
