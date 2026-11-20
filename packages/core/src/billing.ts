import { isApiError, unwrap, type BillingSchemas } from '@netboxplus/api';
import type { Locale } from '@netboxplus/i18n';
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { nextTitlePage } from './catalog-reads';
import { useGateway } from './gateway';

export type MySubscription = BillingSchemas['MySubscription'];
export type SubscriptionStatus = BillingSchemas['SubscriptionStatus'];
export type InvoiceSummary = BillingSchemas['InvoiceSummary'];
export type InvoiceStatus = BillingSchemas['InvoiceStatus'];
export type InvoicePage = BillingSchemas['PageOfInvoiceSummary'];

/** The account's billing, cleared with the rest of the cache when it signs out. */
export const billingKeys = {
  all: ['billing'] as const,
  subscription: (lang: Locale) => ['billing', 'subscription', lang] as const,
  invoices: ['billing', 'invoices'] as const,
};

/** How many invoices a page of the account's list shows. */
export const invoicePageSize = 10;

/** A subscription that is not over: a new one cannot be started while it lasts (Billing's own rule). */
export function isLive(subscription: Pick<MySubscription, 'status'> | null | undefined): boolean {
  return subscription != null && subscription.status !== 'Canceled';
}

/**
 * The account's live subscription, or the latest one that ended; `null` when it never had one (Billing
 * answers 404). Asked only once `enabled` (signed in). `refetchInterval` keeps asking while a payment that
 * just went through is on its way from the payment provider.
 */
export function useSubscription(
  lang: Locale,
  enabled: boolean,
  refetchInterval?: (subscription: MySubscription | null | undefined) => number | false,
) {
  const { clients } = useGateway();
  return useQuery({
    queryKey: billingKeys.subscription(lang),
    queryFn: async (): Promise<MySubscription | null> => {
      try {
        return await unwrap(clients.billing.GET('/subscription', { params: { query: { lang } } }));
      } catch (error) {
        if (isApiError(error) && error.status === 404) {
          return null;
        }
        throw error;
      }
    },
    enabled,
    ...(refetchInterval ? { refetchInterval: (query) => refetchInterval(query.state.data) } : {}),
  });
}

/** The account's invoices, newest first, a page at a time. */
export function useInvoices(enabled: boolean) {
  const { clients } = useGateway();
  return useInfiniteQuery({
    queryKey: billingKeys.invoices,
    queryFn: ({ pageParam }): Promise<InvoicePage> =>
      unwrap(
        clients.billing.GET('/invoices', {
          params: { query: { page: pageParam, pageSize: invoicePageSize } },
        }),
      ),
    initialPageParam: 1,
    getNextPageParam: nextTitlePage,
    enabled,
  });
}

/**
 * Every payment request carries its own `Idempotency-Key`: Billing answers a repeat of the same key with
 * the first answer, so one attempt never opens two checkouts. A new attempt (a second click after an
 * error) gets a new key.
 */
const attemptKey = () => ({ header: { 'Idempotency-Key': crypto.randomUUID() } });

/**
 * Opens the payment provider's checkout for a plan; resolves to the page's address, where the browser
 * goes next. Billing refuses an address that is not verified (403 `Checkout.EmailNotVerified`) and a
 * second subscription (409 `Subscription.AlreadyActive`).
 */
export function useStartCheckout() {
  const { clients } = useGateway();
  return useMutation({
    mutationFn: async (planId: string): Promise<string> => {
      const session = await unwrap(
        clients.billing.POST('/checkout-sessions', { params: attemptKey(), body: { planId } }),
      );
      return session.url;
    },
  });
}

/** Opens the payment provider's page for the card, the plan and cancelling; resolves to its address. */
export function useOpenPortal() {
  const { clients } = useGateway();
  return useMutation({
    mutationFn: async (): Promise<string> => {
      const session = await unwrap(clients.billing.POST('/portal-sessions', { params: attemptKey() }));
      return session.url;
    },
  });
}
