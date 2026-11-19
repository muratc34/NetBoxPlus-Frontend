import { createPublicClients, type PublicClients } from '@netboxplus/api';
import { createContext, use, type ReactNode } from 'react';

/**
 * The customer application's gateway: typed clients that send the session cookie, and the session's
 * CSRF token, which the session hooks keep current and every changing request carries.
 */
export interface BrowserGateway {
  readonly clients: PublicClients;
  readonly setCsrfToken: (token: string | undefined) => void;
}

export function createBrowserGateway(
  baseUrl: string,
  send?: (request: Request) => Promise<Response>,
): BrowserGateway {
  let csrfToken: string | undefined;
  const clients = createPublicClients({
    baseUrl,
    csrfToken: () => csrfToken,
    ...(send ? { fetch: send } : {}),
  });
  return {
    clients,
    setCsrfToken: (token) => {
      csrfToken = token;
    },
  };
}

const GatewayContext = createContext<BrowserGateway | null>(null);

export function GatewayProvider({
  gateway,
  children,
}: Readonly<{ gateway: BrowserGateway; children: ReactNode }>) {
  return <GatewayContext value={gateway}>{children}</GatewayContext>;
}

export function useGateway(): BrowserGateway {
  const gateway = use(GatewayContext);
  if (!gateway) {
    throw new Error('useGateway needs a GatewayProvider above it.');
  }
  return gateway;
}
