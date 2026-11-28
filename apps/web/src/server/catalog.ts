import { isApiError } from '@netboxplus/api';
import {
  nextTitlePage,
  readGenres,
  readMovie,
  readPerson,
  readSearch,
  readSeries,
  readSimilar,
  readTitles,
  type CatalogAgeRating,
  type Genre,
  type PublicPerson,
  type PublishedMovie,
  type PublishedSeries,
  type SearchFilter,
  type SearchPage,
  type TitleFilter,
  type TitlePage,
  type TitleSummary,
} from '@netboxplus/core/reads';
import type { Locale } from '@netboxplus/i18n';
import { revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { after } from 'next/server';
import { parseSelectedProfile, profileCookie } from '../profiles/selected-profile';
import { boundedCache } from './bounded-cache';
import { gatewayForServer, gatewayForVisitor } from './gateway';

/**
 * Catalog reads while rendering a page, shared between visitors for a minute. The key names only what
 * the answer depends on (path and query): Next's own fetch cache would also key on the visitor's
 * address, which every request carries, and keep one copy per visitor. A miss still counts against the
 * visitor at the gateway.
 */
export const catalogRevalidateSeconds = 60;

/** The oldest a catalog read is shown, in seconds: a page opened after a long quiet spell reads again. */
export const catalogMaxAgeSeconds = 300;

/** Every catalog read carries it, so they can be dropped together. */
export const catalogTag = 'catalog';

function cached<T>(key: readonly unknown[], load: () => Promise<T>): Promise<T> {
  return boundedCache(load, ['catalog', JSON.stringify(key)], {
    revalidate: catalogRevalidateSeconds,
    maxAge: catalogMaxAgeSeconds,
    tags: [catalogTag],
  });
}

/** At most one drop in this many milliseconds, so requests for unknown ids cannot keep the cache empty. */
export const catalogForgetGapMs = 30_000;
let forgottenAt = Number.NEGATIVE_INFINITY;

/**
 * Drops every cached catalog read once this response is out (not while rendering, which Next refuses). A
 * title that answers 404 was most likely taken down after the lists that link to it were cached: without
 * this, the lists keep it for up to `catalogMaxAgeSeconds`, since an expired entry still answers while it
 * is refreshed. `expire: 0` makes the next visitor wait for fresh lists instead of getting the old ones.
 */
function forgetCatalog(): void {
  const now = Date.now();
  if (now - forgottenAt < catalogForgetGapMs) {
    return;
  }
  forgottenAt = now;
  after(() => {
    revalidateTag(catalogTag, { expire: 0 });
  });
}

/** A title's details, or `null` (and the cached lists dropped) when Catalog has no such published title. */
async function title<T>(details: Promise<T | null>): Promise<T | null> {
  const found = await details;
  if (found === null) {
    forgetCatalog();
  }
  return found;
}

export async function loadTitles(filter: TitleFilter, page = 1): Promise<TitlePage> {
  const gateway = await gatewayForVisitor();
  return cached(['titles', filter, page], () => readTitles(gateway.catalog, filter, page));
}

export async function loadGenres(lang: Locale): Promise<Genre[]> {
  const gateway = await gatewayForVisitor();
  return cached(['genres', lang], () => readGenres(gateway.catalog, lang));
}

/** A detail read that is `null` when Catalog has no such published item (404), so the page can 404 too. */
async function orNotFound<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function loadMovie(id: string, lang: Locale): Promise<PublishedMovie | null> {
  const gateway = await gatewayForVisitor();
  return title(cached(['movie', id, lang], () => orNotFound(() => readMovie(gateway.catalog, id, lang))));
}

export async function loadSeries(id: string, lang: Locale): Promise<PublishedSeries | null> {
  const gateway = await gatewayForVisitor();
  return title(cached(['series', id, lang], () => orNotFound(() => readSeries(gateway.catalog, id, lang))));
}

export async function loadPerson(id: string, lang: Locale): Promise<PublicPerson | null> {
  const gateway = await gatewayForVisitor();
  return cached(['person', id, lang], () => orNotFound(() => readPerson(gateway.catalog, id, lang)));
}

/**
 * One page of search results, or `unavailable` when Catalog's search is down (503 `Search.Unavailable`): the
 * page says so and everything else on it still works.
 */
export async function loadSearch(filter: SearchFilter, page = 1): Promise<SearchPage | 'unavailable'> {
  const gateway = await gatewayForVisitor();
  try {
    return await cached(['search', filter, page], () => readSearch(gateway.catalog, filter, page));
  } catch (error) {
    if (isApiError(error) && error.status === 503) {
      return 'unavailable';
    }
    throw error;
  }
}

/**
 * Titles like this one, closest first, within an age limit. Empty when Catalog's search is down (503): the
 * row is left out and the rest of the page still works.
 */
export async function loadSimilar(
  id: string,
  lang: Locale,
  pageSize: number,
  maxAgeRating?: CatalogAgeRating,
): Promise<SearchPage['items']> {
  const gateway = await gatewayForVisitor();
  const query = { lang, pageSize, ...(maxAgeRating ? { maxAgeRating } : {}) };
  try {
    return (await cached(['similar', id, query], () => readSimilar(gateway.catalog, id, query))).items;
  } catch (error) {
    if (isApiError(error) && error.status === 503) {
      return [];
    }
    throw error;
  }
}

/** At most this many titles go into the sitemap (one file holds 50,000 addresses; two languages each). */
export const sitemapTitleLimit = 10_000;

export interface PublishedTitle {
  readonly id: string;
  readonly kind: TitleSummary['kind'];
}

/**
 * Every published title, newest first, for the sitemap: asked by this server for no visitor, at most once
 * an hour.
 */
export function loadPublishedTitles(): Promise<PublishedTitle[]> {
  return boundedCache(
    async () => {
      const gateway = gatewayForServer();
      const titles: PublishedTitle[] = [];
      for (let page = 1; titles.length < sitemapTitleLimit; page++) {
        const found = await readTitles(gateway.catalog, { lang: 'tr', pageSize: 100 }, page);
        titles.push(...found.items.map(({ id, kind }) => ({ id, kind })));
        if (nextTitlePage(found) === undefined) {
          break;
        }
      }
      return titles.slice(0, sitemapTitleLimit);
    },
    ['catalog', 'sitemap'],
    { revalidate: 3600, maxAge: 2 * 3600, tags: [catalogTag] },
  );
}

/**
 * The chosen profile's age limit, from the cookie the browser keeps for this host. Lists for a child's
 * profile are filtered by Catalog; without a choice (signed out) everything published is listed.
 */
export async function viewerAgeLimit(): Promise<TitleFilter['maxAgeRating']> {
  return parseSelectedProfile((await cookies()).get(profileCookie)?.value)?.maxAgeRating;
}
