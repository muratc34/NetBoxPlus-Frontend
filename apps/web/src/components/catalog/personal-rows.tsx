'use client';

import {
  useContinueWatching,
  useMyList,
  useTitlesByIds,
  type ContinueWatchingItem,
  type TitleSummary,
} from '@netboxplus/core';
import type { MessageKey } from '@netboxplus/i18n';
import { formatRuntime } from '../../features/titles/format';
import { useLocale } from '../../i18n/translator';
import { useWatchingProfile } from '../../profiles/profile-selection';
import { routes } from '../../routes';
import type { CardProgress } from './title-card';
import { TitleRow, TitleRowSkeleton } from './title-row';

/** At most this many titles of the list on the home page; the rest are on the My List page. */
export const myListRowLength = 20;

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
 * The profile's rows on the home page: what it was watching, then its list. Asked in the browser (they
 * belong to the signed-in profile); without one, or when empty, they are not there.
 */
export function PersonalRows() {
  const profileId = useWatchingProfile();
  if (!profileId) {
    return null;
  }
  return (
    <>
      <ContinueWatchingRow profileId={profileId} />
      <MyListRow profileId={profileId} />
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
