// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { siteUrl } from './site';

describe('siteUrl', () => {
  it('is SITE_URL, or the development server when it is not set', () => {
    expect(siteUrl({ SITE_URL: 'https://app.netboxplus.test' }).origin).toBe('https://app.netboxplus.test');
    expect(siteUrl({ SITE_URL: '' }).origin).toBe('http://localhost:5173');
    expect(siteUrl({}).origin).toBe('http://localhost:5173');
  });

  it('must be an absolute address', () => {
    expect(() => siteUrl({ SITE_URL: 'app.netboxplus.test' })).toThrow(/SITE_URL/);
  });
});
