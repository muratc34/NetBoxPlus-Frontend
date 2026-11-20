// @vitest-environment node
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { title, titlePage } from '../test/catalog';
import { server } from '../test/render';
import {
  catalogRevalidateSeconds,
  loadGenres,
  loadPublishedTitles,
  loadTitles,
  sitemapTitleLimit,
  viewerAgeLimit,
} from './catalog';

const cacheCalls: { key: string[]; revalidate: number | false | undefined }[] = [];
const requestCookies = new Map<string, string>();
const requestHeaders = new Headers();

vi.mock('next/cache', () => ({
  unstable_cache:
    <T>(load: () => Promise<T>, key: string[], options: { revalidate?: number | false }) =>
    () => {
      cacheCalls.push({ key, revalidate: options.revalidate });
      return load();
    },
}));

vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) =>
        requestCookies.has(name) ? { name, value: requestCookies.get(name) } : undefined,
    }),
  headers: () => Promise.resolve(requestHeaders),
}));

const gateway = 'http://gateway.internal';

beforeEach(() => {
  cacheCalls.length = 0;
  requestCookies.clear();
  requestHeaders.delete('x-forwarded-for');
  vi.stubEnv('GATEWAY_INTERNAL_URL', gateway);
  vi.stubEnv('GATEWAY_SERVER_KEY', 'k'.repeat(32));
  vi.stubEnv('TRUSTED_PROXY_HOPS', '1');
});

describe('loadTitles', () => {
  it('is cached for a minute under the filter and page alone, and a miss counts against the visitor', async () => {
    requestHeaders.set('x-forwarded-for', '203.0.113.9');
    const sent: Request[] = [];
    server.use(
      http.get(`${gateway}/catalog/titles`, ({ request }) => {
        sent.push(request);
        return HttpResponse.json(titlePage([title(1)]));
      }),
    );

    const page = await loadTitles({ lang: 'en', genreId: 'g', maxAgeRating: 'Age7' }, 3);

    expect(page.items[0]?.id).toBe(title(1).id);
    expect(cacheCalls).toEqual([
      {
        key: ['catalog', JSON.stringify(['titles', { lang: 'en', genreId: 'g', maxAgeRating: 'Age7' }, 3])],
        revalidate: catalogRevalidateSeconds,
      },
    ]);
    expect(new URL(sent[0]?.url ?? '').search).toBe('?lang=en&genreId=g&maxAgeRating=Age7&page=3');
    expect(sent[0]?.headers.get('x-forwarded-for')).toBe('203.0.113.9');
  });
});

describe('loadGenres', () => {
  it('is cached per language', async () => {
    server.use(http.get(`${gateway}/catalog/genres`, () => HttpResponse.json([{ id: 'g', name: 'Drama' }])));

    expect(await loadGenres('en')).toEqual([{ id: 'g', name: 'Drama' }]);
    expect(cacheCalls[0]?.key).toEqual(['catalog', JSON.stringify(['genres', 'en'])]);
  });
});

describe('loadPublishedTitles', () => {
  it('pages through every published title for no visitor, cached for an hour', async () => {
    requestHeaders.set('x-forwarded-for', '203.0.113.9');
    const pages: string[] = [];
    server.use(
      http.get(`${gateway}/catalog/titles`, ({ request }) => {
        const query = new URL(request.url).searchParams;
        pages.push(query.get('page') ?? '');
        expect(request.headers.get('x-forwarded-for')).toBeNull();
        return query.get('page') === '1'
          ? HttpResponse.json(titlePage([title(1), title(2, { kind: 'Series' })], 1, 3, 2))
          : HttpResponse.json(titlePage([title(3)], 2, 3, 2));
      }),
    );

    expect(await loadPublishedTitles()).toEqual([
      { id: title(1).id, kind: 'Movie' },
      { id: title(2).id, kind: 'Series' },
      { id: title(3).id, kind: 'Movie' },
    ]);
    expect(pages).toEqual(['1', '2']);
    expect(cacheCalls).toEqual([{ key: ['catalog', 'sitemap'], revalidate: 3600 }]);
  });

  it('stops at the limit', async () => {
    let asked = 0;
    server.use(
      http.get(`${gateway}/catalog/titles`, ({ request }) => {
        asked++;
        const number = Number(new URL(request.url).searchParams.get('page'));
        const items = Array.from({ length: 100 }, (_, index) => title(number * 100 + index));
        return HttpResponse.json(titlePage(items, number, 1_000_000, 100));
      }),
    );

    expect(await loadPublishedTitles()).toHaveLength(sitemapTitleLimit);
    expect(asked).toBe(sitemapTitleLimit / 100);
  });
});

describe('viewerAgeLimit', () => {
  it("is the chosen profile's limit, and none without a valid choice", async () => {
    expect(await viewerAgeLimit()).toBeUndefined();

    requestCookies.set('nbp-profile', '0195f0e0-0000-7000-8000-0000000000a2.Age13');
    expect(await viewerAgeLimit()).toBe('Age13');

    requestCookies.set('nbp-profile', 'not-a-profile.Age13');
    expect(await viewerAgeLimit()).toBeUndefined();
  });
});
