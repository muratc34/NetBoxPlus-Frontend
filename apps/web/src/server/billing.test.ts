// @vitest-environment node
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../test/render';
import { loadPlans, plansRevalidateSeconds } from './billing';

const cacheCalls: { key: string[]; revalidate: number | false | undefined }[] = [];

vi.mock('next/cache', () => ({
  unstable_cache:
    <T>(load: () => Promise<T>, key: string[], options: { revalidate?: number | false }) =>
    () => {
      cacheCalls.push({ key, revalidate: options.revalidate });
      return load();
    },
}));

vi.mock('next/headers', () => ({ headers: () => Promise.resolve(new Headers()) }));

const gateway = 'http://gateway.internal';

beforeEach(() => {
  cacheCalls.length = 0;
  vi.stubEnv('GATEWAY_INTERNAL_URL', gateway);
  vi.stubEnv('GATEWAY_SERVER_KEY', 'k'.repeat(32));
  vi.stubEnv('TRUSTED_PROXY_HOPS', '0');
});

describe('loadPlans', () => {
  it("is the language's plans, shared between visitors for a minute", async () => {
    const asked: string[] = [];
    server.use(
      http.get(`${gateway}/billing/plans`, ({ request }) => {
        asked.push(new URL(request.url).search);
        return HttpResponse.json([]);
      }),
    );

    await expect(loadPlans('en')).resolves.toEqual([]);

    expect(asked).toEqual(['?lang=en']);
    expect(cacheCalls).toEqual([{ key: ['billing', 'plans', 'en'], revalidate: 60 }]);
    expect(plansRevalidateSeconds).toBe(60);
  });
});
