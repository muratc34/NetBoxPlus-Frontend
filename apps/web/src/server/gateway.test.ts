// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createServerGateway, readServerGatewaySettings, serverKeyHeader, visitorAddress } from './gateway';

describe('visitorAddress', () => {
  it('names no visitor without trusted proxies, whatever the browser sent', () => {
    expect(visitorAddress('203.0.113.7', 0)).toBeUndefined();
  });

  it('takes the entry the trusted proxy appended, not the ones that came with the request', () => {
    expect(visitorAddress('198.51.100.1, 203.0.113.7', 1)).toBe('203.0.113.7');
    expect(visitorAddress('198.51.100.1, 203.0.113.7, 10.0.0.2', 2)).toBe('203.0.113.7');
    expect(visitorAddress('2001:db8::7', 1)).toBe('2001:db8::7');
  });

  it('names no visitor when the trusted entries are missing or are not addresses', () => {
    expect(visitorAddress(null, 1)).toBeUndefined();
    expect(visitorAddress('203.0.113.7', 2)).toBeUndefined();
    expect(visitorAddress('unknown', 1)).toBeUndefined();
  });
});

describe('readServerGatewaySettings', () => {
  it('needs the gateway address and a whole number of proxies', () => {
    expect(() => readServerGatewaySettings({})).toThrow(/GATEWAY_INTERNAL_URL/);
    expect(() =>
      readServerGatewaySettings({ GATEWAY_INTERNAL_URL: 'http://gateway:8080', TRUSTED_PROXY_HOPS: 'one' }),
    ).toThrow(/TRUSTED_PROXY_HOPS/);
    expect(
      readServerGatewaySettings({ GATEWAY_INTERNAL_URL: 'http://gateway:8080', GATEWAY_SERVER_KEY: '' }),
    ).toEqual({
      baseUrl: 'http://gateway:8080',
      key: undefined,
      trustedProxyHops: 0,
    });
  });
});

describe('createServerGateway', () => {
  async function sent(key: string | undefined, visitor: string | undefined): Promise<Request> {
    const requests: Request[] = [];
    const gateway = createServerGateway(
      { baseUrl: 'http://gateway:8080', key, trustedProxyHops: 1 },
      visitor,
      (input) => {
        requests.push(input as Request);
        return Promise.resolve(Response.json({ items: [], page: 1, pageSize: 20, totalCount: 0 }));
      },
    );

    await gateway.catalog.GET('/titles');
    const [request] = requests;
    if (!request) {
      throw new Error('No request was sent.');
    }

    return request;
  }

  it('sends the key and the visitor to the gateway, without cookies', async () => {
    const request = await sent('server-key', '203.0.113.7');

    expect(request.url).toBe('http://gateway:8080/catalog/titles');
    expect(request.headers.get(serverKeyHeader)).toBe('server-key');
    expect(request.headers.get('X-Forwarded-For')).toBe('203.0.113.7');
    expect(request.credentials).toBe('omit');
  });

  it('names no visitor without the key, since the gateway would not believe it', async () => {
    const request = await sent(undefined, '203.0.113.7');

    expect(request.headers.has(serverKeyHeader)).toBe(false);
    expect(request.headers.has('X-Forwarded-For')).toBe(false);
  });

  it('sends the key alone for work no visitor asked for', async () => {
    const request = await sent('server-key', undefined);

    expect(request.headers.get(serverKeyHeader)).toBe('server-key');
    expect(request.headers.has('X-Forwarded-For')).toBe(false);
  });
});
