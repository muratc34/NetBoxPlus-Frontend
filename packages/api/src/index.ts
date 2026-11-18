import type { components as AuthAdmin } from './generated/auth.admin';
import type { components as AuthPublic } from './generated/auth.public';
import type { components as BillingAdmin } from './generated/billing.admin';
import type { components as BillingPublic } from './generated/billing.public';
import type { components as CatalogAdmin } from './generated/catalog.admin';
import type { components as CatalogPublic } from './generated/catalog.public';
import type { components as GatewayPublic } from './generated/gateway.public';
import type { components as NotificationAdmin } from './generated/notification.admin';
import type { components as StreamingAdmin } from './generated/streaming.admin';
import type { components as StreamingPublic } from './generated/streaming.public';

export {
  createAdminClients,
  createPublicClients,
  csrfHeader,
  type AdminClients,
  type GatewayClientOptions,
  type PublicClients,
} from './client';
export { ApiError, isApiError, readProblem, unwrap, type ClientResult, type Problem } from './errors';

/** Request and response shapes, by service and route group: `CatalogSchemas['PublishedMovie']`. */
export type SessionSchemas = GatewayPublic['schemas'];
export type AuthSchemas = AuthPublic['schemas'];
export type AuthAdminSchemas = AuthAdmin['schemas'];
export type CatalogSchemas = CatalogPublic['schemas'];
export type CatalogAdminSchemas = CatalogAdmin['schemas'];
export type BillingSchemas = BillingPublic['schemas'];
export type BillingAdminSchemas = BillingAdmin['schemas'];
export type StreamingSchemas = StreamingPublic['schemas'];
export type StreamingAdminSchemas = StreamingAdmin['schemas'];
export type NotificationAdminSchemas = NotificationAdmin['schemas'];
