import {
  nextTitlePage,
  readGenres,
  readTitles,
  type Genre,
  type TitleFilter,
  type TitlePage,
  type TitleSummary,
} from '@netboxplus/core/reads';
import type { Locale } from '@netboxplus/i18n';
import { unstable_cache } from 'next/cache';
import { cookies } from 'next/headers';
import { parseSelectedProfile, profileCookie } from '../profiles/selected-profile';
import { gatewayForServer, gatewayForVisitor } from './gateway';

/**
 * Catalog reads while rendering a page, shared between visitors for a minute. The key names only what
 * the answer depends on (path and query): Next's own fetch cache would also key on the visitor's
 * address, which every request carries, and keep one copy per visitor. A miss still counts against the
 * visitor at the gateway.
 */
export const catalogRevalidateSeconds = 60;

function cached<T>(key: readonly unknown[], load: () => Promise<T>): Promise<T> {
  return unstable_cache(load, ['catalog', JSON.stringify(key)], { revalidate: catalogRevalidateSeconds })();
}

export async function loadTitles(filter: TitleFilter, page = 1): Promise<TitlePage> {
  const gateway = await gatewayForVisitor();
  return cached(['titles', filter, page], () => readTitles(gateway.catalog, filter, page));
}

export async function loadGenres(lang: Locale): Promise<Genre[]> {
  const gateway = await gatewayForVisitor();
  return cached(['genres', lang], () => readGenres(gateway.catalog, lang));
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
  return unstable_cache(
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
    { revalidate: 3600 },
  )();
}

/**
 * The chosen profile's age limit, from the cookie the browser keeps for this host. Lists for a child's
 * profile are filtered by Catalog; without a choice (signed out) everything published is listed.
 */
export async function viewerAgeLimit(): Promise<TitleFilter['maxAgeRating']> {
  return parseSelectedProfile((await cookies()).get(profileCookie)?.value)?.maxAgeRating;
}
