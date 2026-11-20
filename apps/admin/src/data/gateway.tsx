import { createAdminClients, type AdminClients } from '@netboxplus/api';
import { createContext, use, type ReactNode } from 'react';
import { putBlob, type BlobUpload } from './images';

/**
 * The admin panel's gateway: typed clients for every service's admin routes and the admin session
 * (`/admin/session/...`, its own cookie), with the session's CSRF token on every changing request.
 */
export interface AdminGateway {
  readonly clients: AdminClients;
  readonly setCsrfToken: (token: string | undefined) => void;
  /** Sends a file to a signed storage address (images, later videos). */
  readonly upload: BlobUpload;
}

export function createAdminGateway(
  baseUrl: string,
  options: { send?: (request: Request) => Promise<Response>; upload?: BlobUpload } = {},
): AdminGateway {
  let csrfToken: string | undefined;
  const clients = createAdminClients({
    baseUrl,
    csrfToken: () => csrfToken,
    ...(options.send ? { fetch: options.send } : {}),
  });
  return {
    clients,
    setCsrfToken: (token) => {
      csrfToken = token;
    },
    upload: options.upload ?? putBlob,
  };
}

const AdminGatewayContext = createContext<AdminGateway | null>(null);

export function AdminGatewayProvider({
  gateway,
  children,
}: Readonly<{ gateway: AdminGateway; children: ReactNode }>) {
  return <AdminGatewayContext value={gateway}>{children}</AdminGatewayContext>;
}

export function useAdminGateway(): AdminGateway {
  const gateway = use(AdminGatewayContext);
  if (!gateway) {
    throw new Error('useAdminGateway needs an AdminGatewayProvider above it.');
  }
  return gateway;
}
