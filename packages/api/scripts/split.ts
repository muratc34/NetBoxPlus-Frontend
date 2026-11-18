import type { ServiceDocument } from '../src/services.ts';

/** The part of an OpenAPI document this package reads; everything else is copied through untouched. */
export interface OpenApiDocument {
  readonly paths?: Readonly<Record<string, unknown>>;
  readonly [key: string]: unknown;
}

export interface SplitDocument {
  /** Paths a browser reaches at `<gateway><prefix>`, as the service names them. */
  readonly public: OpenApiDocument;
  /** `/admin/...` paths with `/admin` removed, reached at `<gateway>/admin<prefix>`. */
  readonly admin: OpenApiDocument;
}

const adminPrefix = '/admin';

function isUnder(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root}/`);
}

/**
 * Splits a service's document into what the public route group and the admin route group expose, so a
 * client generated from the public half cannot even name an admin path, and an Auth endpoint the gateway
 * keeps to itself is not in either.
 */
export function splitDocument(document: OpenApiDocument, service: ServiceDocument): SplitDocument {
  const publicPaths: Record<string, unknown> = {};
  const adminPaths: Record<string, unknown> = {};

  for (const [path, item] of Object.entries(document.paths ?? {})) {
    if (isUnder(path, adminPrefix)) {
      adminPaths[path.slice(adminPrefix.length)] = item;
    } else if (
      service.browserPaths === undefined ||
      service.browserPaths.some((root) => isUnder(path, root))
    ) {
      publicPaths[path] = item;
    }
  }

  return { public: { ...document, paths: publicPaths }, admin: { ...document, paths: adminPaths } };
}
