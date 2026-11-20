import { locales, type Locale } from '@netboxplus/i18n';
import type { MetadataRoute } from 'next';
import { routes } from '../routes';
import { loadPublishedTitles } from '../server/catalog';
import { siteUrl } from '../server/site';

// Built when asked, not at build time: the catalog is not there while the image is built.
export const dynamic = 'force-dynamic';

/** The catalog pages and the plans in both languages, each naming its other-language twin. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const entry = (path: (locale: Locale) => string): MetadataRoute.Sitemap =>
    locales.map((locale) => ({
      url: new URL(path(locale), base).toString(),
      alternates: {
        languages: Object.fromEntries(locales.map((other) => [other, new URL(path(other), base).toString()])),
      },
    }));

  const titles = await loadPublishedTitles();
  return [
    ...entry(routes.home),
    ...entry(routes.movies),
    ...entry(routes.series),
    ...entry(routes.plans),
    ...titles.flatMap((title) => entry((locale) => routes.title(locale, title.kind, title.id))),
  ];
}
