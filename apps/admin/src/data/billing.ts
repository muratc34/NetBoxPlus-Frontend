import { unwrap, type BillingAdminSchemas } from '@netboxplus/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminGateway } from './gateway';

export type PlanSummary = BillingAdminSchemas['PlanSummary'];
export type PlanDetails = BillingAdminSchemas['PlanDetails'];
export type PlanRequest = BillingAdminSchemas['PlanRequest'];
export type VideoQuality = BillingAdminSchemas['VideoQuality'];
export type SubscriptionStatus = BillingAdminSchemas['SubscriptionStatus'];
export type SubscriptionSummary = BillingAdminSchemas['SubscriptionSummary'];
export type SubscriptionDetails = BillingAdminSchemas['SubscriptionDetails'];
export type InvoiceStatus = BillingAdminSchemas['InvoiceStatus'];

export const qualities: readonly VideoQuality[] = ['Sd', 'Hd', 'Uhd'];
export const subscriptionStatuses: readonly SubscriptionStatus[] = [
  'Active',
  'PastDue',
  'Incomplete',
  'Canceled',
];

/** The only currency Billing sells in. */
export const planCurrency = 'TRY';

export const billingKeys = {
  plans: ['admin', 'billing', 'plans'] as const,
  planList: (active: boolean | undefined, page: number) =>
    ['admin', 'billing', 'plans', { active, page }] as const,
  plan: (id: string) => ['admin', 'billing', 'plan', id] as const,
  subscriptions: ['admin', 'billing', 'subscriptions'] as const,
  subscriptionList: (filter: SubscriptionFilter) => ['admin', 'billing', 'subscriptions', filter] as const,
  subscription: (id: string) => ['admin', 'billing', 'subscription', id] as const,
};

/** How many rows a page of a Billing list shows. */
export const billingPageSize = 20;

/** A page of plans, on sale or not (`active`), or both. */
export function usePlans(active: boolean | undefined, page: number) {
  const { clients } = useAdminGateway();
  return useQuery({
    queryKey: billingKeys.planList(active, page),
    queryFn: () =>
      unwrap(
        clients.billing.GET('/plans', {
          params: { query: { ...(active === undefined ? {} : { active }), page, pageSize: billingPageSize } },
        }),
      ),
    placeholderData: (previous) => previous,
  });
}

export function usePlan(id: string | undefined) {
  const { clients } = useAdminGateway();
  return useQuery({
    queryKey: billingKeys.plan(id ?? ''),
    queryFn: () => unwrap(clients.billing.GET('/plans/{id}', { params: { path: { id: id ?? '' } } })),
    enabled: id !== undefined,
  });
}

/** Creates a plan, off sale (resolves to the new id), or changes one at the version it was loaded at. */
export function useSavePlan() {
  const { clients } = useAdminGateway();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id?: string; body: PlanRequest }): Promise<string> => {
      if (id) {
        await unwrap(clients.billing.PUT('/plans/{id}', { params: { path: { id } }, body }));
        return id;
      }
      const created = await unwrap(clients.billing.POST('/plans', { body }));
      return created.id;
    },
    onSuccess: (id) => {
      void queryClient.invalidateQueries({ queryKey: billingKeys.plan(id) });
      void queryClient.invalidateQueries({ queryKey: billingKeys.plans });
    },
  });
}

/** Puts the plan on sale or takes it off; its subscribers keep their subscriptions either way. */
export function useSetPlanOnSale(planId: string) {
  const { clients } = useAdminGateway();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (onSale: boolean) => {
      const request = { params: { path: { id: planId } } };
      return unwrap(
        onSale
          ? clients.billing.POST('/plans/{id}/activate', request)
          : clients.billing.POST('/plans/{id}/deactivate', request),
      );
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: billingKeys.plan(planId) }),
        queryClient.invalidateQueries({ queryKey: billingKeys.plans }),
      ]),
  });
}

export interface SubscriptionFilter {
  readonly status?: SubscriptionStatus | undefined;
  readonly userId?: string | undefined;
  readonly page: number;
  readonly pageSize?: number;
}

/** A page of subscriptions, newest first, by status and user. */
export function useSubscriptions(filter: SubscriptionFilter, enabled = true) {
  const { clients } = useAdminGateway();
  return useQuery({
    queryKey: billingKeys.subscriptionList(filter),
    queryFn: () =>
      unwrap(
        clients.billing.GET('/subscriptions', {
          params: {
            query: {
              ...(filter.status ? { status: filter.status } : {}),
              ...(filter.userId ? { userId: filter.userId } : {}),
              page: filter.page,
              pageSize: filter.pageSize ?? billingPageSize,
            },
          },
        }),
      ),
    placeholderData: (previous) => previous,
    enabled,
  });
}

/** One subscription with its invoices; Stripe is where it changes, this only reads its mirror. */
export function useSubscription(id: string) {
  const { clients } = useAdminGateway();
  return useQuery({
    queryKey: billingKeys.subscription(id),
    queryFn: () => unwrap(clients.billing.GET('/subscriptions/{id}', { params: { path: { id } } })),
  });
}
