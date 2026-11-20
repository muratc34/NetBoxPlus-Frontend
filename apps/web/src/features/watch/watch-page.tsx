'use client';

import { useProgress, useSession, type TitleKind } from '@netboxplus/core';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useLocale } from '../../i18n/translator';
import { useWatchingProfile } from '../../profiles/profile-selection';
import { routes, signInPath } from '../../routes';
import { chooseEpisode, type PlayableEpisode } from './episodes';
import { Player } from './player';

export interface WatchTitle {
  readonly id: string;
  readonly kind: TitleKind;
  readonly title: string;
  /** A series' episodes in watching order; empty for a movie. */
  readonly episodes: readonly PlayableEpisode[];
}

/** "S1:E2 · The Storm". */
export function episodeLabel(episode: PlayableEpisode, t: ReturnType<typeof useLocale>['t']): string {
  const short = t('player.episode')
    .replace('{season}', String(episode.seasonNumber))
    .replace('{number}', String(episode.number));
  return `${short} · ${episode.title}`;
}

/**
 * The player's page. A movie plays itself; a series plays the `episode` asked for, or goes on where the
 * profile stopped. Watching needs a session and a chosen profile: a visitor without a session signs in
 * first (choosing a profile is asked by the provider), both coming back here.
 */
export function WatchPage({
  title,
  episodeId,
  fromStart,
}: Readonly<{ title: WatchTitle; episodeId: string | undefined; fromStart: boolean }>) {
  const { locale, t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const session = useSession();
  const profileId = useWatchingProfile();
  const asked = title.episodes.find((episode) => episode.id === episodeId);
  const series = title.kind === 'Series';
  // Where a series goes on is asked only when no (known) episode is in the address.
  const progress = useProgress(series && !asked ? profileId : undefined, title.id);
  const backHref = routes.title(locale, title.kind, title.id);

  useEffect(() => {
    if (session.data === null) {
      router.replace(signInPath(locale, search ? `${pathname}?${search}` : pathname));
    }
  }, [session.data, router, locale, pathname, search]);

  const episode = series
    ? (asked ?? (progress.data ? chooseEpisode(title.episodes, progress.data)?.episode : undefined))
    : undefined;
  const contentId = series ? episode?.id : title.id;

  if (!profileId || !contentId) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black text-white">
        <p role="status">{t('player.loading')}</p>
      </div>
    );
  }

  return (
    <Player
      key={contentId}
      profileId={profileId}
      contentId={contentId}
      fromStart={fromStart}
      heading={title.title}
      {...(episode ? { subheading: episodeLabel(episode, t) } : {})}
      backHref={backHref}
      onFinished={() => {
        router.push(backHref);
      }}
    />
  );
}
