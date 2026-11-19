import { unwrap, type PublicClients } from '@netboxplus/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useGateway } from './gateway';

const readSession = (session: PublicClients['session']) => session.GET('/session');

/** The signed-in account as the gateway describes it, typed from the generated client. */
export type Session = NonNullable<Awaited<ReturnType<typeof readSession>>['data']>;

export interface Credentials {
  readonly email: string;
  readonly password: string;
}

export const queryKeys = {
  session: ['session'] as const,
  emailVerification: ['email-verification'] as const,
};

/**
 * The signed-in account, or `null` when there is none (the gateway answers 401). Every page that
 * changes something waits for this first: its CSRF token goes with the change.
 */
export function useSession() {
  const { clients, setCsrfToken } = useGateway();
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: async (): Promise<Session | null> => {
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

function useStartSession(send: (credentials: Credentials) => Promise<Session>) {
  const { setCsrfToken } = useGateway();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSuccess: (session) => {
      setCsrfToken(session.csrfToken);
      queryClient.setQueryData(queryKeys.session, session);
      void queryClient.invalidateQueries({ queryKey: queryKeys.emailVerification });
    },
  });
}

export function useSignIn() {
  const { clients } = useGateway();
  return useStartSession((body) => unwrap(clients.session.POST('/session/sign-in', { body })));
}

/** Creates the account and signs it in; the gateway answers with the new session. */
export function useRegister() {
  const { clients } = useGateway();
  return useStartSession((body) => unwrap(clients.session.POST('/session/register', { body })));
}

/** Ends the session; whatever the gateway answers, nothing of it stays in this tab. */
export function useSignOut() {
  const { clients, setCsrfToken } = useGateway();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(clients.session.POST('/session/sign-out')),
    onSettled: () => {
      setCsrfToken(undefined);
      queryClient.clear();
      queryClient.setQueryData(queryKeys.session, null);
    },
  });
}

/** Always succeeds for a well-formed address, whether or not it has an account. */
export function useRequestPasswordReset() {
  const { clients } = useGateway();
  return useMutation({
    mutationFn: (email: string) =>
      unwrap(clients.session.POST('/session/password-reset', { body: { email } })),
  });
}

export function useResetPassword() {
  const { clients } = useGateway();
  return useMutation({
    mutationFn: (body: { token: string; newPassword: string }) =>
      unwrap(clients.session.POST('/session/password-reset/confirm', { body })),
  });
}

/** Whether the signed-in account's address is confirmed; only asked while there is a session. */
export function useEmailVerification(enabled: boolean) {
  const { clients } = useGateway();
  return useQuery({
    queryKey: queryKeys.emailVerification,
    queryFn: () => unwrap(clients.auth.GET('/email-verification')),
    enabled,
    staleTime: 60_000,
  });
}

/** Sends a new confirmation link; the backend allows one a minute. */
export function useResendVerification() {
  const { clients } = useGateway();
  return useMutation({ mutationFn: () => unwrap(clients.auth.POST('/email-verification')) });
}

function useConfirmToken(send: (token: string) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.emailVerification });
      void queryClient.invalidateQueries({ queryKey: queryKeys.session });
    },
  });
}

export function useConfirmEmail() {
  const { clients } = useGateway();
  return useConfirmToken((token) =>
    unwrap(clients.auth.POST('/email-verification/confirm', { body: { token } })),
  );
}

export function useConfirmEmailChange() {
  const { clients } = useGateway();
  return useConfirmToken((token) => unwrap(clients.auth.POST('/email-change/confirm', { body: { token } })));
}
