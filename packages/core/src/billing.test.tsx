import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  invoicePageSize,
  isLive,
  useInvoices,
  useOpenPortal,
  useStartCheckout,
  useSubscription,
  type InvoiceSummary,
  type MySubscription,
} from './billing';
import { formatPrice, readPlans } from './billing-reads';
import { createBrowserGateway, GatewayProvider } from './gateway';
import { createAppQueryClient } from './query-client';

const gatewayUrl = 'http://gateway.test';
const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

function setup() {
  const queryClient = createAppQueryClient({ onSessionEnded: vi.fn() });
  const gateway = createBrowserGateway(gatewayUrl);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <GatewayProvider gateway={gateway}>{children}</GatewayProvider>
    </QueryClientProvider>
  );
  return { queryClient, gateway, wrapper };
}

const subscription: MySubscription = {
  id: 's',
  status: 'Active',
  plan: { id: 'p', name: 'Premium', language: 'tr', quality: 'Hd', maxScreens: 4 },
  currentPeriodEnd: '2026-12-20T00:00:00Z',
  cancelAtPeriodEnd: false,
  canceledAt: null,
  startedAt: '2026-11-20T00:00:00Z',
};

function invoice(index: number): InvoiceSummary {
  return {
    id: `i${String(index)}`,
    amountMinor: 14999,
    currency: 'TRY',
    status: 'Paid',
    issuedAt: '2026-11-20T00:00:00Z',
    paidAt: '2026-11-20T00:00:00Z',
    cardBrand: 'visa',
    cardLast4: '4242',
  };
}

describe('formatPrice', () => {
  it('reads minor units by the currency’s own decimals', () => {
    expect(formatPrice(14999, 'TRY', 'tr')).toBe('₺149,99');
    expect(formatPrice(999, 'USD', 'en')).toBe('$9.99');
    expect(formatPrice(500, 'JPY', 'en')).toBe('¥500');
  });
});

describe('readPlans', () => {
  it('asks for the plans in the language', async () => {
    const asked: string[] = [];
    server.use(
      http.get(`${gatewayUrl}/billing/plans`, ({ request }) => {
        asked.push(new URL(request.url).search);
        return HttpResponse.json([]);
      }),
    );

    await expect(readPlans(setup().gateway.clients.billing, 'en')).resolves.toEqual([]);
    expect(asked).toEqual(['?lang=en']);
  });
});

describe('isLive', () => {
  it('is every subscription that has not ended', () => {
    expect(isLive({ status: 'Active' })).toBe(true);
    expect(isLive({ status: 'PastDue' })).toBe(true);
    expect(isLive({ status: 'Incomplete' })).toBe(true);
    expect(isLive({ status: 'Canceled' })).toBe(false);
    expect(isLive(null)).toBe(false);
    expect(isLive(undefined)).toBe(false);
  });
});

describe('useSubscription', () => {
  it('is the subscription, in the language', async () => {
    const asked: string[] = [];
    server.use(
      http.get(`${gatewayUrl}/billing/subscription`, ({ request }) => {
        asked.push(new URL(request.url).search);
        return HttpResponse.json(subscription);
      }),
    );

    const { result } = renderHook(() => useSubscription('en', true), { wrapper: setup().wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual(subscription);
    });
    expect(asked).toEqual(['?lang=en']);
  });

  it('is null when the account never had one', async () => {
    server.use(
      http.get(`${gatewayUrl}/billing/subscription`, () =>
        HttpResponse.json({ status: 404, code: 'Subscription.None' }, { status: 404 }),
      ),
    );

    const { result } = renderHook(() => useSubscription('tr', true), { wrapper: setup().wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeNull();
    });
  });

  it('fails on anything else, and asks nothing until enabled', async () => {
    let asked = 0;
    server.use(
      http.get(`${gatewayUrl}/billing/subscription`, () => {
        asked++;
        return HttpResponse.json({ status: 400 }, { status: 400 });
      }),
    );
    const { wrapper } = setup();

    renderHook(() => useSubscription('tr', false), { wrapper });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(asked).toBe(0);

    const { result } = renderHook(() => useSubscription('tr', true), { wrapper });
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('asks again as long as the interval says so', async () => {
    let asked = 0;
    server.use(
      http.get(`${gatewayUrl}/billing/subscription`, () => {
        asked++;
        return asked < 3
          ? HttpResponse.json({ status: 404 }, { status: 404 })
          : HttpResponse.json(subscription);
      }),
    );

    const { result } = renderHook(
      () => useSubscription('tr', true, (current) => (isLive(current) ? false : 10)),
      { wrapper: setup().wrapper },
    );

    await waitFor(() => {
      expect(result.current.data?.status).toBe('Active');
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(asked).toBe(3);
  });
});

describe('useInvoices', () => {
  it('pages through the invoices', async () => {
    const asked: string[] = [];
    server.use(
      http.get(`${gatewayUrl}/billing/invoices`, ({ request }) => {
        const query = new URL(request.url).searchParams;
        asked.push(query.toString());
        const page = Number(query.get('page'));
        return HttpResponse.json({
          items: [invoice(page)],
          pageNumber: page,
          pageSize: invoicePageSize,
          totalCount: invoicePageSize + 1,
        });
      }),
    );

    const { result } = renderHook(() => useInvoices(true), { wrapper: setup().wrapper });

    await waitFor(() => {
      expect(result.current.hasNextPage).toBe(true);
    });
    await act(() => result.current.fetchNextPage());

    await waitFor(() => {
      expect(result.current.data?.pages.map((page) => page.items[0]?.id)).toEqual(['i1', 'i2']);
    });
    expect(result.current.hasNextPage).toBe(false);
    expect(asked).toEqual([
      `page=1&pageSize=${String(invoicePageSize)}`,
      `page=2&pageSize=${String(invoicePageSize)}`,
    ]);
  });
});

describe('payment requests', () => {
  it('open checkout for the plan with a new key for every attempt', async () => {
    const sent: { key: string | null; csrf: string | null; body: unknown }[] = [];
    server.use(
      http.post(`${gatewayUrl}/billing/checkout-sessions`, async ({ request }) => {
        sent.push({
          key: request.headers.get('Idempotency-Key'),
          csrf: request.headers.get('X-CSRF-Token'),
          body: await request.json(),
        });
        return HttpResponse.json({ url: 'https://checkout.test/c' });
      }),
    );
    const { wrapper, gateway } = setup();
    gateway.setCsrfToken('csrf');

    const { result } = renderHook(() => useStartCheckout(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync('plan-1')).resolves.toBe('https://checkout.test/c');
      await result.current.mutateAsync('plan-1');
    });

    expect(sent).toHaveLength(2);
    expect(sent[0]).toMatchObject({ csrf: 'csrf', body: { planId: 'plan-1' } });
    expect(sent[0]?.key).toMatch(/^[0-9a-f-]{36}$/);
    expect(sent[1]?.key).not.toBe(sent[0]?.key);
  });

  it("pass on Billing's refusal", async () => {
    server.use(
      http.post(`${gatewayUrl}/billing/checkout-sessions`, () =>
        HttpResponse.json({ status: 403, code: 'Checkout.EmailNotVerified' }, { status: 403 }),
      ),
    );

    const { result } = renderHook(() => useStartCheckout(), { wrapper: setup().wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync('p')).rejects.toMatchObject({
        code: 'Checkout.EmailNotVerified',
      });
    });
  });

  it('open the portal with a key', async () => {
    const keys: (string | null)[] = [];
    server.use(
      http.post(`${gatewayUrl}/billing/portal-sessions`, ({ request }) => {
        keys.push(request.headers.get('Idempotency-Key'));
        return HttpResponse.json({ url: 'https://portal.test/p' });
      }),
    );

    const { result } = renderHook(() => useOpenPortal(), { wrapper: setup().wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync()).resolves.toBe('https://portal.test/p');
    });
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);
  });
});
