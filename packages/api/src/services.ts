/**
 * The backend's OpenAPI documents and where each one's paths live behind the gateway. A service's public
 * paths are served under `/<prefix>`, its `/admin/...` paths under `/admin/<prefix>/...`; the gateway's own
 * document (browser sessions) has no prefix.
 */
export interface ServiceDocument {
  /** File name in the backend's docs/openapi and in this package's openapi folder, without `.json`. */
  readonly name: ServiceName;
  /** The gateway path the service is mounted at, `''` for the gateway's own endpoints. */
  readonly prefix: string;
  /**
   * Public paths the gateway proxies to a browser; `undefined` means all of them. Auth keeps its
   * token-returning endpoints to the gateway, so only these reach the browser.
   */
  readonly browserPaths?: readonly string[];
}

export type ServiceName = 'gateway' | 'auth' | 'catalog' | 'billing' | 'streaming' | 'notification';

export const services: readonly ServiceDocument[] = [
  { name: 'gateway', prefix: '' },
  { name: 'auth', prefix: '/auth', browserPaths: ['/profiles', '/email-verification', '/email-change'] },
  { name: 'catalog', prefix: '/catalog' },
  { name: 'billing', prefix: '/billing' },
  { name: 'streaming', prefix: '/streaming' },
  { name: 'notification', prefix: '/notification' },
];

export function servicePrefix(name: ServiceName): string {
  const service = services.find((candidate) => candidate.name === name);
  if (!service) {
    throw new Error(`Unknown service "${name}".`);
  }
  return service.prefix;
}
