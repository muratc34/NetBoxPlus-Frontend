'use client';

import { useProgress, type ProgressView } from '@netboxplus/core';
import { useLocale } from '../../i18n/translator';
import { useWatchingProfile } from '../../profiles/profile-selection';
import { formatRuntime } from './format';

/** The watching profile's progress on a title's movie or episodes, by their id; empty without a profile. */
export function useProgressById(titleId: string): ReadonlyMap<string, ProgressView> {
  const profileId = useWatchingProfile();
  const progress = useProgress(profileId, titleId);
  return new Map((progress.data ?? []).map((view) => [view.contentId, view]));
}

/** How much of the time a started movie or episode has left; nothing when it is not started or is done. */
export function timeLeft(
  view: ProgressView | undefined,
  t: Parameters<typeof formatRuntime>[1],
): string | undefined {
  if (!view || view.completed || view.positionSeconds <= 0) {
    return undefined;
  }
  const minutes = Math.max(1, Math.ceil((view.durationSeconds - view.positionSeconds) / 60));
  return t('progress.left').replace('{time}', formatRuntime(minutes, t));
}

/** "23 min left" under a movie's facts, when the profile has started it. */
export function MovieProgress({ titleId }: Readonly<{ titleId: string }>) {
  const { t } = useLocale();
  const left = timeLeft(useProgressById(titleId).get(titleId), t);
  return left ? <p className="text-sm font-semibold text-brand">{left}</p> : null;
}

/** A bar under an episode: how much of it the profile has watched. */
export function EpisodeProgress({ view }: Readonly<{ view: ProgressView | undefined }>) {
  const { t } = useLocale();
  if (!view || (view.positionSeconds <= 0 && !view.completed)) {
    return null;
  }
  const fraction = view.completed
    ? 1
    : view.durationSeconds > 0
      ? view.positionSeconds / view.durationSeconds
      : 0;
  const label = view.completed ? t('progress.watched') : timeLeft(view, t);
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden="true" className="h-1 w-32 overflow-hidden rounded-full bg-white/20">
        <span
          className="block h-full bg-brand"
          style={{ width: `${String(Math.round(Math.min(fraction, 1) * 100))}%` }}
        />
      </span>
      {label && <span className="text-xs text-ink-muted">{label}</span>}
    </div>
  );
}
