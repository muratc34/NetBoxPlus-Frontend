import type { MySubscription, PlanOffer } from '@netboxplus/core';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { leaveSiteFor } from '../../leave-site';
import { gatewayUrl, problem, renderPage, server, signInAs } from '../../test/render';
import { PlansPage } from './plans-page';

vi.mock('../../leave-site', () => ({ leaveSiteFor: vi.fn() }));

const basic: PlanOffer = {
  id: '0195f0e0-0000-7000-8000-0000000000b1',
  name: 'Temel',
  description: 'Tek ekranda SD.',
  language: 'tr',
  amountMinor: 9999,
  currency: 'TRY',
  quality: 'Sd',
  maxScreens: 1,
};

const premium: PlanOffer = {
  ...basic,
  id: '0195f0e0-0000-7000-8000-0000000000b2',
  name: 'Premium',
  description: '',
  amountMinor: 19999,
  quality: 'Hd',
  maxScreens: 4,
};

function subscription(status: MySubscription['status'], plan = premium): MySubscription {
  return {
    id: 's',
    status,
    plan: {
      id: plan.id,
      name: plan.name,
      language: 'tr',
      quality: plan.quality,
      maxScreens: plan.maxScreens,
    },
    currentPeriodEnd: '2026-12-20T12:00:00Z',
    cancelAtPeriodEnd: false,
    canceledAt: null,
    startedAt: '2026-11-20T12:00:00Z',
  };
}

/** Signed in, verified or not, with the subscription Billing answers (`null`: never had one). */
function account({
  verified = true,
  current = null,
}: {
  verified?: boolean;
  current?: MySubscription | null;
}) {
  signInAs();
  server.use(
    http.get(`${gatewayUrl}/auth/email-verification`, () =>
      HttpResponse.json({ verified, verifiedAt: null }),
    ),
    http.get(`${gatewayUrl}/billing/subscription`, () =>
      current ? HttpResponse.json(current) : problem(404, 'Subscription.None'),
    ),
  );
}

const plan = (name: string) => screen.getByRole('heading', { name }).closest('li') as HTMLElement;

beforeEach(() => {
  vi.mocked(leaveSiteFor).mockReset();
});

describe('PlansPage', () => {
  it('compares the plans: price a month, video quality and screens', () => {
    renderPage(<PlansPage plans={[basic, premium]} />);

    const first = plan('Temel');
    expect(first).toHaveTextContent('₺99,99/ay');
    expect(first).toHaveTextContent('Tek ekranda SD.');
    expect(first).toHaveTextContent('Görüntü kalitesiSD (480p)');
    expect(first).toHaveTextContent('Ekran sayısıAynı anda 1 ekran');
    const second = plan('Premium');
    expect(second).toHaveTextContent('₺199,99/ay');
    expect(second).toHaveTextContent('HD (1080p)');
    expect(second).toHaveTextContent('Aynı anda 4 ekran');
  });

  it('says so when nothing is on sale', () => {
    renderPage(<PlansPage plans={[]} />, 'en');

    expect(screen.getByText('No plans are on sale right now.')).toBeInTheDocument();
  });

  it('sends a visitor to sign up first, coming back here', () => {
    renderPage(<PlansPage plans={[basic]} />);

    expect(screen.getByRole('link', { name: 'Temel planını seç' })).toHaveAttribute(
      'href',
      '/tr/sign-up?next=%2Ftr%2Fplans',
    );
  });

  it("opens the payment provider's checkout for the chosen plan", async () => {
    account({});
    const sent: unknown[] = [];
    server.use(
      http.post(`${gatewayUrl}/billing/checkout-sessions`, async ({ request }) => {
        sent.push(await request.json());
        return HttpResponse.json({ url: 'https://checkout.test/session' });
      }),
    );
    renderPage(<PlansPage plans={[basic, premium]} />);

    const choose = await screen.findByRole('button', { name: 'Premium planını seç' });
    await waitFor(() => {
      expect(choose).toBeEnabled();
    });
    await userEvent.setup().click(choose);

    await waitFor(() => {
      expect(leaveSiteFor).toHaveBeenCalledWith('https://checkout.test/session');
    });
    expect(sent).toEqual([{ planId: premium.id }]);
    // Nothing else can be chosen while the browser leaves.
    expect(within(plan('Premium')).getByRole('button')).toHaveTextContent('Ödeme sayfası açılıyor…');
    expect(within(plan('Temel')).getByRole('button', { name: 'Temel planını seç' })).toBeDisabled();
  });

  it('asks for a verified address before a subscription', async () => {
    account({ verified: false });
    renderPage(<PlansPage plans={[basic]} />);

    const notice = await screen.findByText(/önce e-posta adresini doğrula/);
    const choose = screen.getByRole('button', { name: 'Temel planını seç' });
    expect(choose).toBeDisabled();
    expect(choose).toHaveAttribute('aria-describedby', notice.id);
  });

  it('marks the plan of a live subscription and sends the account to manage it', async () => {
    account({ current: subscription('PastDue'), verified: false });
    renderPage(<PlansPage plans={[basic, premium]} />);

    expect(await screen.findByRole('link', { name: 'Üyeliğini yönet' })).toHaveAttribute(
      'href',
      '/tr/account',
    );
    expect(plan('Premium')).toHaveAttribute('aria-current', 'true');
    expect(within(plan('Premium')).getByText('Mevcut planın')).toBeInTheDocument();
    expect(plan('Temel')).not.toHaveAttribute('aria-current');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText(/önce e-posta adresini doğrula/)).not.toBeInTheDocument();
  });

  it('waits for the subscription before offering a checkout', async () => {
    account({});
    server.use(
      http.get(`${gatewayUrl}/billing/subscription`, async () => {
        await delay(100);
        return problem(404, 'Subscription.None');
      }),
    );
    renderPage(<PlansPage plans={[basic]} />);

    const choose = await screen.findByRole('button', { name: 'Temel planını seç' });
    expect(choose).toBeDisabled();
    expect(choose).toHaveAttribute('aria-busy', 'true');
    await waitFor(() => {
      expect(choose).toBeEnabled();
    });
    expect(choose).not.toHaveAttribute('aria-busy');
  });

  it('offers the plans again once the subscription has ended', async () => {
    account({ current: subscription('Canceled') });
    renderPage(<PlansPage plans={[basic, premium]} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Premium planını seç' })).toBeEnabled();
    });
    expect(screen.queryByText('Mevcut planın')).not.toBeInTheDocument();
  });

  it('says why Billing refused, and shows the page as it is now', async () => {
    account({});
    let started = false;
    server.use(
      http.get(`${gatewayUrl}/billing/subscription`, () =>
        started ? HttpResponse.json(subscription('Active', basic)) : problem(404, 'Subscription.None'),
      ),
      http.post(`${gatewayUrl}/billing/checkout-sessions`, () => {
        started = true;
        return problem(409, 'Subscription.AlreadyActive');
      }),
    );
    renderPage(<PlansPage plans={[basic, premium]} />);

    const choose = await screen.findByRole('button', { name: 'Premium planını seç' });
    await waitFor(() => {
      expect(choose).toBeEnabled();
    });
    await userEvent.setup().click(choose);

    expect(await screen.findByRole('alert')).toHaveTextContent('Zaten bir üyeliğin var.');
    expect(await screen.findByRole('link', { name: 'Üyeliğini yönet' })).toBeInTheDocument();
    expect(plan('Temel')).toHaveAttribute('aria-current', 'true');
    expect(leaveSiteFor).not.toHaveBeenCalled();
  });
});
