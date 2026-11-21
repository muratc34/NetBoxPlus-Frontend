import { unwrap, type NotificationAdminSchemas } from '@netboxplus/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminGateway } from './gateway';

export type EmailSummary = NotificationAdminSchemas['EmailSummary'];
export type EmailDetails = NotificationAdminSchemas['EmailDetails'];
export type EmailKind = NotificationAdminSchemas['EmailKind'];
export type EmailStatus = NotificationAdminSchemas['EmailStatus'];

export const emailStatuses: readonly EmailStatus[] = ['Pending', 'Sent', 'Failed'];
export const emailKinds: readonly EmailKind[] = [
  'Welcome',
  'EmailVerification',
  'PasswordReset',
  'PasswordChanged',
  'EmailChangeVerification',
  'EmailChanged',
  'SubscriptionStarted',
  'SubscriptionResumed',
  'PaymentFailed',
  'SubscriptionEnded',
  'AccountDeleted',
];

/** How often a list or an e-mail still waiting to go is asked again. */
export const emailPollMs = 5000;

/** How many e-mails a page of the list shows. */
export const emailsPageSize = 20;

export interface EmailFilter {
  readonly status?: EmailStatus | undefined;
  readonly kind?: EmailKind | undefined;
  readonly userId?: string | undefined;
  readonly page: number;
  readonly pageSize?: number;
}

export const emailKeys = {
  emails: ['admin', 'notification', 'emails'] as const,
  list: (filter: EmailFilter) => ['admin', 'notification', 'emails', filter] as const,
  email: (id: string) => ['admin', 'notification', 'email', id] as const,
};

/** A page of e-mails, newest first, by status, kind and user; asked again while one is still waiting to go. */
export function useEmails(filter: EmailFilter, enabled = true) {
  const { clients } = useAdminGateway();
  return useQuery({
    queryKey: emailKeys.list(filter),
    queryFn: () =>
      unwrap(
        clients.notification.GET('/emails', {
          params: {
            query: {
              ...(filter.status ? { status: filter.status } : {}),
              ...(filter.kind ? { kind: filter.kind } : {}),
              ...(filter.userId ? { userId: filter.userId } : {}),
              page: filter.page,
              pageSize: filter.pageSize ?? emailsPageSize,
            },
          },
        }),
      ),
    placeholderData: (previous) => previous,
    enabled,
    refetchInterval: (query) =>
      query.state.data?.items.some((email) => email.status === 'Pending') ? emailPollMs : false,
  });
}

/** One e-mail with its attempts and last error; asked again while it is still waiting to go. */
export function useEmail(id: string) {
  const { clients } = useAdminGateway();
  return useQuery({
    queryKey: emailKeys.email(id),
    queryFn: () => unwrap(clients.notification.GET('/emails/{id}', { params: { path: { id } } })),
    refetchInterval: (query) => (query.state.data?.status === 'Pending' ? emailPollMs : false),
  });
}

/** Sends a failed e-mail again from the first attempt, while its content is kept. */
export function useRetryEmail(id: string) {
  const { clients } = useAdminGateway();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(clients.notification.POST('/emails/{id}/retry', { params: { path: { id } } })),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: emailKeys.email(id) }),
        queryClient.invalidateQueries({ queryKey: emailKeys.emails }),
      ]),
  });
}
