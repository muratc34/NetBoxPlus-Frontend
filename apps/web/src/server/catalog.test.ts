// @vitest-environment node
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { title, titlePage } from '../test/catalog';
import { server } from '../test/render';
import {
  catalogForgetGapMs,
  catalogRevalidateSeconds,
  catalogTag,
  loadSeries,
  loadGenres,
  loadMovie,
  loadPerson,
  loadSearch,
  loadPublishedTitles,
  loadTitles,
  sitemapTitleLimit,
  viewerAgeLimit,
} from './catalog';

const cacheCalls: { key: string[]; revalidate: number | false | undefined; tags: string[] | undefined }[] =
  [];
const dropped: unknown[][] = [];
const afterResponse: (() => void)[] = [];
const requestCookies = new Map<string, string>();
const requestHeaders = new Headers();

vi.mock('next/cache', () => ({
  unstable_cache:
    <T>(load: () => Promise<T>, key: string[], options: { revalidate?: number | false; tags?: string[] }) =>
    () => {
      cacheCalls.push({ key, revalidate: options.revalidate, tags: options.tags });
      return load();
    },
  revalidateTag: (...args: unknown[]) => {
    dropped.push(args);
  },
}));

// Runs what the response would run once it is out, when the test says so.
vi.mock('next/server', () => ({
  after: (task: () => void) => {
    afterResponse.push(task);
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
  dropped.length = 0;
  afterResponse.length = 0;
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
        tags: [catalogTag],
      },
    ]);
    expect(new URL(sent[0]?.url ?? '').search).toBe('?lang=en&genreId=g&maxAgeRating=Age7&page=3');
    expect(sent[0]?.headers.get('x-forwarded-for')).toBe('203.0.113.9');
  });
});

describe('loadMovie and loadPerson', () => {
  it('are the published item, cached by id and language', async () => {
    server.use(
      http.get(`${gateway}/catalog/movies/m1`, ({ request }) =>
        HttpResponse.json({ id: 'm1', lang: new URL(request.url).searchParams.get('lang') }),
      ),
    );

    expect(await loadMovie('m1', 'en')).toEqual({ id: 'm1', lang: 'en' });
    expect(cacheCalls[0]?.key).toEqual(['catalog', JSON.stringify(['movie', 'm1', 'en'])]);
  });

  it('are null when Catalog has no such item, and fail when it cannot answer', async () => {
    server.use(
      http.get(`${gateway}/catalog/people/gone`, () =>
        HttpResponse.json({ status: 404, code: 'Person.NotFound' }, { status: 404 }),
      ),
      http.get(`${gateway}/catalog/people/broken`, () =>
        HttpResponse.json({ status: 503, code: 'Data.Unavailable' }, { status: 503 }),
      ),
    );

    expect(await loadPerson('gone', 'tr')).toBeNull();
    await expect(loadPerson('broken', 'tr')).rejects.toMatchObject({ status: 503 });
  });
});

describe('a title that answers 404', () => {
  // The drop is rate-limited per process: each test starts well past the previous one.
  let clock = Date.parse('2026-11-26T12:00:00Z');
  beforeEach(() => {
    clock += 10 * catalogForgetGapMs;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(clock);
    server.use(
      http.get(`${gateway}/catalog/movies/:id`, ({ params }) =>
        params.id === 'm1'
          ? HttpResponse.json({ id: 'm1' })
          : HttpResponse.json({ status: 404, code: 'Content.NotFound' }, { status: 404 }),
      ),
      http.get(`${gateway}/catalog/series/gone`, () =>
        HttpResponse.json({ status: 404, code: 'Content.NotFound' }, { status: 404 }),
      ),
    );
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('drops every cached catalog read once the response is out, so lists no longer link to it', async () => {
    expect(await loadMovie('gone', 'tr')).toBeNull();

    expect(dropped).toEqual([]);
    for (const task of afterResponse) task();
    expect(dropped).toEqual([[catalogTag, { expire: 0 }]]);
  });

  it('drops them for a series too', async () => {
    expect(await loadSeries('gone', 'tr')).toBeNull();

    for (const task of afterResponse) task();
    expect(dropped).toEqual([[catalogTag, { expire: 0 }]]);
  });

  it('drops them at most once in the gap, so unknown ids cannot keep the cache empty', async () => {
    await loadMovie('gone', 'tr');
    vi.setSystemTime(clock + catalogForgetGapMs - 1);
    await loadMovie('other', 'tr');
    expect(afterResponse).toHaveLength(1);

    vi.setSystemTime(clock + catalogForgetGapMs);
    await loadMovie('other', 'tr');
    expect(afterResponse).toHaveLength(2);
  });

  it('keeps them for a title that is there', async () => {
    expect(await loadMovie('m1', 'tr')).toEqual({ id: 'm1' });
    expect(afterResponse).toHaveLength(0);
  });
});

describe('loadSearch', () => {
  it('is a page of results, cached by text, filter and page', async () => {
    server.use(
      http.get(`${gateway}/catalog/search`, () =>
        HttpResponse.json({ items: [], pageNumber: 2, pageSize: 20, totalCount: 0 }),
      ),
    );

    expect(await loadSearch({ q: 'kuzey', lang: 'tr' }, 2)).toMatchObject({ pageNumber: 2 });
    expect(cacheCalls[0]?.key).toEqual([
      'catalog',
      JSON.stringify(['search', { q: 'kuzey', lang: 'tr' }, 2]),
    ]);
  });

  it('is unavailable when search is down, and fails otherwise', async () => {
    server.use(
      http.get(`${gateway}/catalog/search`, ({ request }) =>
        new URL(request.url).searchParams.get('q') === 'down'
          ? HttpResponse.json({ status: 503, code: 'Search.Unavailable' }, { status: 503 })
          : HttpResponse.json({ status: 400, code: 'Search.QueryInvalid' }, { status: 400 }),
      ),
    );

    expect(await loadSearch({ q: 'down', lang: 'tr' })).toBe('unavailable');
    await expect(loadSearch({ q: 'bad', lang: 'tr' })).rejects.toMatchObject({ status: 400 });
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
    expect(cacheCalls).toEqual([{ key: ['catalog', 'sitemap'], revalidate: 3600, tags: [catalogTag] }]);
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
