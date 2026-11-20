import { isLocale } from '@netboxplus/i18n';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { isTitleId } from '../../../../features/titles/title-page';
import { orderEpisodes } from '../../../../features/watch/episodes';
import { WatchPage, type WatchTitle } from '../../../../features/watch/watch-page';
import { loadMovie, loadSeries } from '../../../../server/catalog';

type Query = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * The title the address names, as the player needs it: a movie, or a series with its episodes. An address
 * with an episode is a series', so that one is asked first.
 */
async function loadWatchTitle(lang: string, titleId: string, query: Query): Promise<WatchTitle> {
  if (!isLocale(lang) || !isTitleId(titleId)) {
    notFound();
  }
  const series = () => loadSeries(titleId, lang);
  const movie = () => loadMovie(titleId, lang);
  const [found, other] = first(query.episode) ? [series, movie] : [movie, series];
  const item = (await found()) ?? (await other());
  if (!item) {
    notFound();
  }
  if (!('seasons' in item)) {
    return { id: item.id, kind: 'Movie', title: item.title, episodes: [] };
  }
  const episodes = orderEpisodes(item.seasons);
  if (episodes.length === 0) {
    // Nothing of it can be played yet.
    notFound();
  }
  return { id: item.id, kind: 'Series', title: item.title, episodes };
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<'/[lang]/watch/[titleId]'>): Promise<Metadata> {
  const { lang, titleId } = await params;
  const title = await loadWatchTitle(lang, titleId, await searchParams);
  return { title: title.title, robots: { index: false } };
}

export default async function WatchRoute({ params, searchParams }: PageProps<'/[lang]/watch/[titleId]'>) {
  const { lang, titleId } = await params;
  const query = await searchParams;
  const title = await loadWatchTitle(lang, titleId, query);
  return (
    // The player reads the address's query in the browser.
    <Suspense>
      <WatchPage title={title} episodeId={first(query.episode)} fromStart={first(query.from) === 'start'} />
    </Suspense>
  );
}
