import { isApiError } from '@netboxplus/api';
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

/** The gateway's answers when the session cookie no longer stands for a session. */
const endedSessionCodes = new Set(['Session.Expired', 'Session.Required']);

export function isSessionEnded(error: unknown): boolean {
  return (
    isApiError(error) && error.status === 401 && error.code !== undefined && endedSessionCodes.has(error.code)
  );
}

/**
 * The application's query client. When any request finds the session gone, `onSessionEnded` runs once
 * per failure, so the application can forget the account and send the visitor to sign in. Answers that
 * will not change on a second try (4xx) are not retried.
 */
export function createAppQueryClient(options: { onSessionEnded: () => void }): QueryClient {
  const watch = (error: unknown) => {
    if (isSessionEnded(error)) {
      options.onSessionEnded();
    }
  };

  return new QueryClient({
    queryCache: new QueryCache({ onError: watch }),
    mutationCache: new MutationCache({ onError: watch }),
    defaultOptions: {
      queries: { retry: (failures, error) => !(isApiError(error) && error.status < 500) && failures < 2 },
      mutations: { retry: false },
    },
  });
}
