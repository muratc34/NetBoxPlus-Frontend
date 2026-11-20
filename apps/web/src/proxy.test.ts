// @vitest-environment node
import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import { config, proxy } from './proxy';

function request(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(new URL(path, 'http://web.test'), { headers });
}

describe('proxy', () => {
  it("sends an e-mail link to the same page in the visitor's language, with its token", () => {
    const response = proxy(request('/verify-email?token=abc%2B1', { 'accept-language': 'en-US,en;q=0.9' }));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://web.test/en/verify-email?token=abc%2B1');
  });

  it('prefers the chosen language and defaults to Turkish', () => {
    expect(
      proxy(request('/sign-in', { cookie: 'nbp-lang=en', 'accept-language': 'tr' })).headers.get('location'),
    ).toBe('http://web.test/en/sign-in');
    expect(proxy(request('/')).headers.get('location')).toBe('http://web.test/tr');
  });

  it('leaves addresses that already have a language alone', () => {
    const response = proxy(request('/en/sign-in'));

    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it("does not run for the framework's files, the health endpoint or files", () => {
    const matcher = new RegExp(`^${config.matcher[0] ?? ''}$`);

    expect(matcher.test('/sign-in')).toBe(true);
    expect(matcher.test('/_next/static/chunk.js')).toBe(false);
    expect(matcher.test('/health/live')).toBe(false);
    expect(matcher.test('/favicon.ico')).toBe(false);
  });
});

describe('proxy: Content-Security-Policy', () => {
  function policyOf(response: Response): Map<string, string> {
    const header = response.headers.get('content-security-policy') ?? '';
    return new Map(
      header.split('; ').map((directive) => {
        const [name = '', ...values] = directive.split(' ');
        return [name, values.join(' ')];
      }),
    );
  }

  it('gives a page a policy with a new nonce, and passes it on to Next with the request', () => {
    const first = proxy(request('/tr/movies'));
    const second = proxy(request('/tr/movies'));

    const nonce = /'nonce-([^']+)'/.exec(policyOf(first).get('script-src') ?? '')?.[1];
    expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(policyOf(second).get('script-src')).not.toContain(nonce);
    expect(first.headers.get('x-middleware-request-content-security-policy')).toBe(
      first.headers.get('content-security-policy'),
    );
  });

  it('allows data only from the site, the gateway and the storage', () => {
    vi.stubEnv('NEXT_PUBLIC_GATEWAY_URL', 'https://api.netboxplus.test/');
    vi.stubEnv('STORAGE_ORIGINS', 'https://media.netboxplus.test/images http://127.0.0.1:10000');

    const policy = policyOf(proxy(request('/en')));

    expect(policy.get('connect-src')).toBe(
      "'self' https://api.netboxplus.test https://media.netboxplus.test http://127.0.0.1:10000",
    );
    expect(policy.get('img-src')).toBe(
      "'self' data: blob: https://media.netboxplus.test http://127.0.0.1:10000",
    );
    expect(policy.get('frame-ancestors')).toBe("'none'");
    expect(policy.get('object-src')).toBe("'none'");
    vi.unstubAllEnvs();
  });

  it('sends no policy with a redirect', () => {
    expect(proxy(request('/movies')).headers.get('content-security-policy')).toBeNull();
  });
});
