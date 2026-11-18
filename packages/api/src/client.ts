import createClient, { type Client, type Middleware } from 'openapi-fetch';
import type { paths as AuthAdminPaths } from './generated/auth.admin';
import type { paths as AuthPublicPaths } from './generated/auth.public';
import type { paths as BillingAdminPaths } from './generated/billing.admin';
import type { paths as BillingPublicPaths } from './generated/billing.public';
import type { paths as CatalogAdminPaths } from './generated/catalog.admin';
import type { paths as CatalogPublicPaths } from './generated/catalog.public';
import type { paths as GatewayAdminPaths } from './generated/gateway.admin';
import type { paths as GatewayPublicPaths } from './generated/gateway.public';
import type { paths as NotificationAdminPaths } from './generated/notification.admin';
import type { paths as StreamingAdminPaths } from './generated/streaming.admin';
import type { paths as StreamingPublicPaths } from './generated/streaming.public';
import { servicePrefix, type ServiceName } from './services';

export interface GatewayClientOptions {
  /** The gateway's origin, such as `http://localhost:5100`; on the web server, its internal address. */
  readonly baseUrl: string;
  /**
   * The session's CSRF token (from `GET /session`); sent as `X-CSRF-Token` with every changing request.
   * Leave it out for calls that have no session, such as server-side catalog reads.
   */
  readonly csrfToken?: () => string | undefined;
  /**
   * `include` (the default) in browsers: the session cookie belongs to the gateway's host, not the page's.
   * Server-side calls are anonymous and pass `omit`.
   */
  readonly credentials?: RequestCredentials;
  /** Replaces the global `fetch`, for tests or server-side caching options. */
  readonly fetch?: (request: Request) => Promise<Response>;
}

export const csrfHeader = 'X-CSRF-Token';

const unchangingMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

function csrfMiddleware(csrfToken: () => string | undefined): Middleware {
  return {
    onRequest({ request }) {
      if (!unchangingMethods.has(request.method)) {
        const token = csrfToken();
        if (token) {
          request.headers.set(csrfHeader, token);
        }
      }
      return request;
    },
  };
}

function create<Paths extends object>(options: GatewayClientOptions, mount: string): Client<Paths> {
  const client = createClient<Paths>({
    baseUrl: options.baseUrl.replace(/\/+$/, '') + mount,
    credentials: options.credentials ?? 'include',
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  const { csrfToken } = options;
  if (csrfToken) {
    client.use(csrfMiddleware(csrfToken));
  }
  return client;
}

function publicMount(service: ServiceName): string {
  return servicePrefix(service);
}

function adminMount(service: ServiceName): string {
  return `/admin${servicePrefix(service)}`;
}

/**
 * Clients for the customer application: the public route group of every service and the customer
 * session (`/session/...`). Admin paths are not in their types.
 */
export function createPublicClients(options: GatewayClientOptions) {
  return {
    session: create<GatewayPublicPaths>(options, publicMount('gateway')),
    auth: create<AuthPublicPaths>(options, publicMount('auth')),
    catalog: create<CatalogPublicPaths>(options, publicMount('catalog')),
    billing: create<BillingPublicPaths>(options, publicMount('billing')),
    streaming: create<StreamingPublicPaths>(options, publicMount('streaming')),
  };
}

/**
 * Clients for the admin panel: every service's admin route group (`/admin/<service>/...`, named by the
 * service's own paths without `/admin`) and the admin session (`/admin/session/...`).
 */
export function createAdminClients(options: GatewayClientOptions) {
  return {
    session: create<GatewayAdminPaths>(options, adminMount('gateway')),
    auth: create<AuthAdminPaths>(options, adminMount('auth')),
    catalog: create<CatalogAdminPaths>(options, adminMount('catalog')),
    billing: create<BillingAdminPaths>(options, adminMount('billing')),
    streaming: create<StreamingAdminPaths>(options, adminMount('streaming')),
    notification: create<NotificationAdminPaths>(options, adminMount('notification')),
  };
}

export type PublicClients = ReturnType<typeof createPublicClients>;
export type AdminClients = ReturnType<typeof createAdminClients>;
