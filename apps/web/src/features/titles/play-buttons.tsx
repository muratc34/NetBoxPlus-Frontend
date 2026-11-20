'use client';

import type { TitleKind } from '@netboxplus/core';
import Link from 'next/link';
import { useLocale } from '../../i18n/translator';
import { routes } from '../../routes';
import { chooseEpisode, type PlayableEpisode } from '../watch/episodes';
import { PlayIcon } from '../watch/player-icons';
import { useProgressById } from './title-progress';

const button =
  'inline-flex h-12 items-center justify-center gap-2 rounded-md px-6 font-semibold ' +
  'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus';

/**
 * The title's play button: "Play", or "Resume" where the watching profile stopped (a series names the
 * episode it goes on with), with "Start over" next to it then. Without a profile it plays from the
 * start; the player asks for signing in and a profile.
 */
export function PlayButtons({
  titleId,
  kind,
  episodes,
}: Readonly<{ titleId: string; kind: TitleKind; episodes: readonly PlayableEpisode[] }>) {
  const { locale, t } = useLocale();
  const progress = useProgressById(titleId);

  let started: boolean;
  let episode: PlayableEpisode | undefined;
  if (kind === 'Series') {
    const choice = chooseEpisode(episodes, [...progress.values()]);
    if (!choice) {
      return null;
    }
    started = choice.started;
    episode = choice.episode;
  } else {
    const view = progress.get(titleId);
    started = view !== undefined && !view.completed && view.positionSeconds > 0;
  }

  const options = episode ? { episode: episode.id } : {};
  const short =
    episode && (started || episode.id !== episodes[0]?.id)
      ? t('player.episode')
          .replace('{season}', String(episode.seasonNumber))
          .replace('{number}', String(episode.number))
      : undefined;
  const label = started ? t('player.resume') : t('player.play');

  return (
    <>
      <Link
        href={routes.watch(locale, titleId, options)}
        className={`${button} bg-white text-black hover:bg-white/85`}
      >
        <PlayIcon />
        {short ? `${label} · ${short}` : label}
      </Link>
      {started && (
        <Link
          href={routes.watch(locale, titleId, { ...options, fromStart: true })}
          className={`${button} bg-white/15 text-white hover:bg-white/25`}
        >
          {t('player.fromStart')}
        </Link>
      )}
    </>
  );
}
