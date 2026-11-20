import { unwrap, type AdminClients } from '@netboxplus/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminGateway } from './gateway';

const readSession = (session: AdminClients['session']) => session.GET('/session');

/** The signed-in administrator: the address, roles and the permissions the panel shows itself by. */
export type AdminSession = NonNullable<Awaited<ReturnType<typeof readSession>>['data']>;

export const sessionKey = ['admin', 'session'] as const;

/** Whether the session holds `permission` (`catalog:genres:write`); nothing without a session. */
export function can(session: AdminSession | null | undefined, permission: string): boolean {
  return session?.permissions.includes(permission) ?? false;
}

/** The admin session, or `null` without one (401). Its CSRF token goes with every change after. */
export function useAdminSession() {
  const { clients, setCsrfToken } = useAdminGateway();
  return useQuery({
    queryKey: sessionKey,
    queryFn: async (): Promise<AdminSession | null> => {
      const result = await readSession(clients.session);
      if (result.response.status === 401) {
        setCsrfToken(undefined);
        return null;
      }
      const session = await unwrap(Promise.resolve(result));
      setCsrfToken(session.csrfToken);
      return session;
    },
    staleTime: 5 * 60_000,
  });
}

/** Signs in through Auth's administrator sign-in; any refusal is the same `User.InvalidCredentials`. */
export function useAdminSignIn() {
  const { clients, setCsrfToken } = useAdminGateway();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      unwrap(clients.session.POST('/session/sign-in', { body })),
    onSuccess: (session) => {
      setCsrfToken(session.csrfToken);
      queryClient.setQueryData(sessionKey, session);
    },
  });
}

/** Ends the session; whatever the gateway answers, nothing of it stays in this tab. */
export function useAdminSignOut() {
  const { clients, setCsrfToken } = useAdminGateway();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(clients.session.POST('/session/sign-out')),
    onSettled: () => {
      setCsrfToken(undefined);
      queryClient.clear();
      queryClient.setQueryData(sessionKey, null);
    },
  });
}
