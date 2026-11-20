'use client';

import type { PublishedSeason } from '@netboxplus/core';
import { useId, useState } from 'react';
import { useLocale } from '../../i18n/translator';
import { formatRuntime } from './format';
import { EpisodeProgress, useProgressById } from './title-progress';

/**
 * A series' episodes, one season at a time: a season picker (a plain select, left out with one season)
 * and the chosen season's episodes in order, each with the watching profile's progress.
 */
export function EpisodeList({
  seriesId,
  seasons,
}: Readonly<{ seriesId: string; seasons: readonly PublishedSeason[] }>) {
  const { t } = useLocale();
  const progress = useProgressById(seriesId);
  const pickerId = useId();
  const ordered = [...seasons].sort((a, b) => a.number - b.number);
  const [chosenId, setChosenId] = useState(ordered[0]?.id);
  const season = ordered.find((candidate) => candidate.id === chosenId) ?? ordered[0];

  if (!season) {
    return null;
  }

  const seasonName = (candidate: PublishedSeason) =>
    candidate.title ?? t('title.seasonNumber').replace('{number}', String(candidate.number));

  return (
    <section aria-labelledby="episodes-title" className="flex flex-col gap-4 px-4 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="episodes-title" className="font-display text-xl font-bold text-ink-strong">
          {t('title.episodes')}
        </h2>
        {ordered.length > 1 ? (
          <div className="flex items-center gap-2">
            <label htmlFor={pickerId} className="text-sm text-ink-muted">
              {t('title.season')}
            </label>
            <select
              id={pickerId}
              value={season.id}
              onChange={(event) => {
                setChosenId(event.target.value);
              }}
              className="h-10 rounded-md border border-line bg-surface px-3 text-ink focus-visible:outline-3 focus-visible:outline-focus"
            >
              {ordered.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {seasonName(candidate)}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="text-sm text-ink-muted">{seasonName(season)}</p>
        )}
      </div>
      <ol className="flex flex-col divide-y divide-line rounded-md bg-surface">
        {[...season.episodes]
          .sort((a, b) => a.number - b.number)
          .map((episode) => (
            <li key={episode.id} className="flex gap-4 p-4">
              <span
                aria-hidden="true"
                className="w-8 shrink-0 font-display text-2xl font-bold text-ink-muted"
              >
                {episode.number}
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <h3 className="font-semibold text-ink-strong">
                  <span className="sr-only">{episode.number}. </span>
                  {episode.title}
                </h3>
                <p className="text-sm text-ink-muted">{formatRuntime(episode.runtimeMinutes, t)}</p>
                <EpisodeProgress view={progress.get(episode.id)} />
                <p className="text-sm text-ink">{episode.synopsis}</p>
              </div>
            </li>
          ))}
      </ol>
    </section>
  );
}
