// @vitest-environment node
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
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
