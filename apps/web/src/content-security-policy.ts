/**
 * The pages' Content-Security-Policy. Scripts run only with the nonce the proxy makes for each response
 * (Next puts it on its own scripts) and what those load (`'strict-dynamic'`); data comes from this site,
 * the gateway and the storage that serves images and video.
 */
export interface PolicySettings {
  readonly nonce: string;
  /** The gateway's public address (`NEXT_PUBLIC_GATEWAY_URL`): the browser's API calls. */
  readonly gatewayOrigin: string;
  /** `STORAGE_ORIGINS`: where Catalog's images and Streaming's playlists and segments are served from. */
  readonly storageOrigins: readonly string[];
  /** The development server evaluates code for fast refresh. */
  readonly development: boolean;
}

export function contentSecurityPolicy(settings: PolicySettings): string {
  const storage = settings.storageOrigins.join(' ');
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${settings.nonce}' 'strict-dynamic'${settings.development ? " 'unsafe-eval'" : ''}`,
    // React's style attributes and the framework's inline styles.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${storage}`,
    `media-src 'self' blob: ${storage}`,
    `connect-src 'self' ${settings.gatewayOrigin} ${storage}`,
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  return directives.map((directive) => directive.trim().replace(/\s+/g, ' ')).join('; ');
}

/** Origins from a space-separated list, such as `STORAGE_ORIGINS=http://127.0.0.1:10000`. */
export function parseOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(/\s+/)
    .filter((entry) => entry !== '')
    .map((entry) => {
      try {
        return new URL(entry).origin;
      } catch {
        throw new Error(`STORAGE_ORIGINS must list absolute addresses, not "${entry}".`);
      }
    });
}

export function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
