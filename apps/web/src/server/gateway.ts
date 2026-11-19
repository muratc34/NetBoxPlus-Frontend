import { isIP } from 'node:net';
import { createPublicClients, type PublicClients } from '@netboxplus/api';
import { headers } from 'next/headers';

/**
 * The gateway as this server calls it while rendering catalog pages. Next refuses `next/headers`
 * in client components and never puts a variable without the `NEXT_PUBLIC_` prefix into a browser
 * bundle, so neither this module nor the key can reach the browser.
 */

/** The gateway checks it and counts the request against the visitor named in `X-Forwarded-For`. */
export const serverKeyHeader = 'X-NetBoxPlus-Server-Key';

export interface ServerGatewaySettings {
  /** The gateway's internal address, such as `http://gateway:8080` (`GATEWAY_INTERNAL_URL`). */
  readonly baseUrl: string;
  /** `GATEWAY_SERVER_KEY`. Without it every request counts against this server's own address. */
  readonly key: string | undefined;
  /**
   * `TRUSTED_PROXY_HOPS`: how many proxies in front of this server append to `X-Forwarded-For`.
   * With none (0, the default) the header can only come from the browser, which may write anything,
   * so no visitor is named and the requests count against this server.
   */
  readonly trustedProxyHops: number;
}

export function readServerGatewaySettings(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ServerGatewaySettings {
  const baseUrl = env.GATEWAY_INTERNAL_URL;
  if (!baseUrl) {
    throw new Error(
      'GATEWAY_INTERNAL_URL is not set: the web server needs the gateway address to render pages.',
    );
  }

  const hops = env.TRUSTED_PROXY_HOPS ?? '0';
  if (!/^\d+$/.test(hops)) {
    throw new Error(`TRUSTED_PROXY_HOPS must be a whole number of proxies, not "${hops}".`);
  }

  // An empty value (a variable left blank in an env file) means no key.
  const key = env.GATEWAY_SERVER_KEY;
  return { baseUrl, key: key?.length ? key : undefined, trustedProxyHops: Number(hops) };
}

/**
 * The visitor's address in the `X-Forwarded-For` this server received: the entry the farthest trusted
 * proxy appended, counting from the right. Entries further left came with the request and prove nothing.
 */
export function visitorAddress(forwardedFor: string | null, trustedProxyHops: number): string | undefined {
  if (trustedProxyHops < 1 || !forwardedFor) {
    return undefined;
  }

  const entries = forwardedFor.split(',').map((entry) => entry.trim());
  const entry = entries[entries.length - trustedProxyHops];
  return entry !== undefined && isIP(entry) !== 0 ? entry : undefined;
}

/** Anonymous clients that send the server key and name the visitor, if there is one. */
export function createServerGateway(
  settings: ServerGatewaySettings,
  visitor: string | undefined,
  send: typeof fetch = fetch,
): PublicClients {
  return createPublicClients({
    baseUrl: settings.baseUrl,
    credentials: 'omit',
    fetch: (request) => {
      const outgoing = new Request(request);
      outgoing.headers.delete('X-Forwarded-For');
      if (settings.key) {
        outgoing.headers.set(serverKeyHeader, settings.key);
        if (visitor) {
          outgoing.headers.set('X-Forwarded-For', visitor);
        }
      }

      return send(outgoing);
    },
  });
}

/** For rendering a page a visitor asked for: their requests count against them at the gateway. */
export async function gatewayForVisitor(): Promise<PublicClients> {
  const settings = readServerGatewaySettings();
  const visitor = visitorAddress((await headers()).get('x-forwarded-for'), settings.trustedProxyHops);
  return createServerGateway(settings, visitor);
}

/** For work no visitor asked for, such as pages rendered ahead of time: counts against this server. */
export function gatewayForServer(): PublicClients {
  return createServerGateway(readServerGatewaySettings(), undefined);
}
