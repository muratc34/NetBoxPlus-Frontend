'use client';

import {
  useContinueWatching,
  useMyList,
  useRecommendedTitles,
  useSimilarTitles,
  useTaste,
  useTitlesByIds,
  type CatalogAgeRating,
  type Taste,
  type ContinueWatchingItem,
  type TitleSummary,
} from '@netboxplus/core';
import type { MessageKey } from '@netboxplus/i18n';
import { formatRuntime } from '../../features/titles/format';
import { useLocale } from '../../i18n/translator';
import { useProfileSelection, useWatchingProfile } from '../../profiles/profile-selection';
import { routes } from '../../routes';
import type { CardProgress } from './title-card';
import { TitleRow, TitleRowSkeleton } from './title-row';

/** At most this many titles of the list on the home page; the rest are on the My List page. */
export const myListRowLength = 20;

/** Titles in a recommendation row. */
export const recommendationRowLength = 20;

/** How many of the most liked titles get a "more like" row of their own. */
export const moreLikeRowCount = 2;

/** "23 min left", or "Next episode" for a series that goes on with an episode not started yet. */
export function progressOf(item: ContinueWatchingItem, t: (key: MessageKey) => string): CardProgress {
  const fraction = item.durationSeconds > 0 ? item.positionSeconds / item.durationSeconds : 0;
  if (item.kind === 'Series' && item.positionSeconds <= 0) {
    return { fraction: 0, label: t('progress.nextEpisode') };
  }
  const minutesLeft = Math.max(1, Math.ceil((item.durationSeconds - item.positionSeconds) / 60));
  return { fraction, label: t('progress.left').replace('{time}', formatRuntime(minutesLeft, t)) };
}

/**
 * The profile's rows on the home page: what it was watching, titles for it, its list, and titles like the ones
 * it likes most. Asked in the browser (they belong to the signed-in profile); without one, or when empty, they
 * are not there. Recommendations come from Catalog, which never sees the profile: the profile's taste (title
 * ids, from Streaming) is passed to it.
 */
export function PersonalRows() {
  const profileId = useWatchingProfile();
  const { selected } = useProfileSelection();
  const taste = useTaste(profileId);
  if (!profileId) {
    return null;
  }
  const maxAgeRating = selected?.maxAgeRating;
  return (
    <>
      <ContinueWatchingRow profileId={profileId} />
      {taste.data && <ForYouRow taste={taste.data} maxAgeRating={maxAgeRating} />}
      <MyListRow profileId={profileId} />
      {taste.data && <MoreLikeRows taste={taste.data} maxAgeRating={maxAgeRating} />}
    </>
  );
}

function ContinueWatchingRow({ profileId }: Readonly<{ profileId: string }>) {
  const { locale, t } = useLocale();
  const items = useContinueWatching(profileId);
  const ids = items.data?.map((item) => item.titleId) ?? [];
  const titles = useTitlesByIds(ids, locale);
  const heading = t('progress.continueWatching');

  if (items.isPending || (ids.length > 0 && titles.isPending)) {
    return <TitleRowSkeleton heading={heading} />;
  }
  const byId = new Map((titles.data ?? []).map((title) => [title.id, title]));
  const cards = (items.data ?? []).flatMap((item) => {
    const title = byId.get(item.titleId);
    const href = routes.watch(
      locale,
      item.titleId,
      item.kind === 'Series' ? { episode: item.contentId } : {},
    );
    return title ? [{ title, progress: { ...progressOf(item, t), href } }] : [];
  });
  return cards.length > 0 ? (
    <TitleRow
      heading={heading}
      titles={cards.map((card) => card.title)}
      progress={cards.map((card) => card.progress)}
    />
  ) : null;
}

function MyListRow({ profileId }: Readonly<{ profileId: string }>) {
  const { locale, t } = useLocale();
  const list = useMyList(profileId);
  const ids = (list.data ?? []).slice(0, myListRowLength).map((item) => item.titleId);
  const titles = useTitlesByIds(ids, locale);
  const heading = t('myList.title');

  if (list.isPending || (ids.length > 0 && titles.isPending)) {
    return <TitleRowSkeleton heading={heading} />;
  }
  const shown: TitleSummary[] = titles.data ?? [];
  return ids.length > 0 && shown.length > 0 ? <TitleRow heading={heading} titles={shown} /> : null;
}

/** Titles like the ones the profile loves, likes and watched, unlike the ones not for it, none it has seen. */
function ForYouRow({ taste, maxAgeRating }: Readonly<{ taste: Taste; maxAgeRating?: CatalogAgeRating }>) {
  const { locale, t } = useLocale();
  const recommended = useRecommendedTitles(
    {
      like: taste.like,
      unlike: taste.unlike,
      exclude: taste.seen,
      lang: locale,
      pageSize: recommendationRowLength,
      ...(maxAgeRating ? { maxAgeRating } : {}),
    },
    true,
  );
  const heading = t('recommend.forYou');

  if (taste.like.length === 0 || recommended.isError) {
    return null;
  }
  if (recommended.isPending) {
    return <TitleRowSkeleton heading={heading} />;
  }
  return recommended.data.items.length > 0 ? (
    <TitleRow heading={heading} titles={recommended.data.items} />
  ) : null;
}

/**
 * A row for each of the titles the profile likes most: "More like <title>". Not while it likes only one: "For you"
 * would be the same row.
 */
function MoreLikeRows({ taste, maxAgeRating }: Readonly<{ taste: Taste; maxAgeRating?: CatalogAgeRating }>) {
  const { locale } = useLocale();
  const seeds = taste.like.length > 1 ? taste.like.slice(0, moreLikeRowCount) : [];
  const titles = useTitlesByIds(seeds, locale);
  return (titles.data ?? []).map((seed) => (
    <MoreLikeRow key={seed.id} seed={seed} maxAgeRating={maxAgeRating} />
  ));
}

function MoreLikeRow({
  seed,
  maxAgeRating,
}: Readonly<{ seed: TitleSummary; maxAgeRating?: CatalogAgeRating }>) {
  const { locale, t } = useLocale();
  const similar = useSimilarTitles(seed.id, locale, maxAgeRating, recommendationRowLength, true);
  const heading = t('recommend.moreLike').replace('{title}', seed.title);

  if (similar.isError) {
    return null;
  }
  if (similar.isPending) {
    return <TitleRowSkeleton heading={heading} />;
  }
  return similar.data.items.length > 0 ? <TitleRow heading={heading} titles={similar.data.items} /> : null;
}
