// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, newNonce, parseOrigins } from './content-security-policy';

describe('contentSecurityPolicy', () => {
  const settings = {
    nonce: 'abc',
    gatewayOrigin: 'http://localhost:5100',
    storageOrigins: [],
    development: false,
  };

  it('runs only scripts with the nonce and what they load', () => {
    expect(contentSecurityPolicy(settings)).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic';");
  });

  it('lets the development server evaluate code, and only it', () => {
    expect(contentSecurityPolicy({ ...settings, development: true })).toContain(
      "script-src 'self' 'nonce-abc' 'strict-dynamic' 'unsafe-eval';",
    );
  });

  it('has no empty source lists without storage', () => {
    expect(contentSecurityPolicy(settings)).toContain("img-src 'self' data: blob:;");
    expect(contentSecurityPolicy(settings)).not.toMatch(/ ;| {2}/);
  });
});

describe('parseOrigins', () => {
  it('keeps the origin of each address', () => {
    expect(parseOrigins(' http://127.0.0.1:10000/devstoreaccount1  https://media.test ')).toEqual([
      'http://127.0.0.1:10000',
      'https://media.test',
    ]);
    expect(parseOrigins(undefined)).toEqual([]);
  });

  it('refuses something that is not an address', () => {
    expect(() => parseOrigins('media.test')).toThrow(/STORAGE_ORIGINS/);
  });
});

describe('newNonce', () => {
  it('is 128 random bits, new each time', () => {
    const nonces = new Set(Array.from({ length: 50 }, newNonce));
    expect(nonces.size).toBe(50);
    for (const nonce of nonces) {
      expect(atob(nonce)).toHaveLength(16);
    }
  });
});
