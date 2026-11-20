import type { ProgressView, PublishedSeason } from '@netboxplus/core';

/** An episode in watching order, with what names it: "S1:E2". */
export interface PlayableEpisode {
  readonly id: string;
  readonly seasonNumber: number;
  readonly number: number;
  readonly title: string;
}

/** A series' episodes in watching order: seasons by number, then episodes by number. */
export function orderEpisodes(seasons: readonly PublishedSeason[]): PlayableEpisode[] {
  return [...seasons]
    .sort((a, b) => a.number - b.number)
    .flatMap((season) =>
      [...season.episodes]
        .sort((a, b) => a.number - b.number)
        .map((episode) => ({
          id: episode.id,
          seasonNumber: season.number,
          number: episode.number,
          title: episode.title,
        })),
    );
}

/**
 * Where a series goes on: the episode the profile watched last, or the one after it when that one is
 * finished; from the start when it has watched nothing (or finished the last episode).
 */
export function chooseEpisode(
  episodes: readonly PlayableEpisode[],
  progress: readonly ProgressView[],
): { episode: PlayableEpisode; started: boolean } | undefined {
  const first = episodes[0];
  if (!first) {
    return undefined;
  }
  const known = new Set(episodes.map((episode) => episode.id));
  const latest = [...progress]
    .filter((view) => known.has(view.contentId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (!latest) {
    return { episode: first, started: false };
  }
  const index = episodes.findIndex((episode) => episode.id === latest.contentId);
  if (!latest.completed) {
    return { episode: episodes[index] ?? first, started: latest.positionSeconds > 0 };
  }
  const next = episodes[index + 1];
  return next ? { episode: next, started: false } : { episode: first, started: false };
}

/** The episode after `episodeId` in watching order, if there is one. */
export function nextEpisode(
  episodes: readonly PlayableEpisode[],
  episodeId: string,
): PlayableEpisode | undefined {
  const index = episodes.findIndex((episode) => episode.id === episodeId);
  return index < 0 ? undefined : episodes[index + 1];
}
