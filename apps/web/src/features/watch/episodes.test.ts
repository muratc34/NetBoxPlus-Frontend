import type { ProgressView, PublishedSeason } from '@netboxplus/core';
import { describe, expect, it } from 'vitest';
import { chooseEpisode, nextEpisode, orderEpisodes } from './episodes';

function season(number: number, episodes: number[]): PublishedSeason {
  return {
    id: `s${String(number)}`,
    number,
    title: null,
    episodes: episodes.map((episode) => ({
      id: `s${String(number)}e${String(episode)}`,
      number: episode,
      title: `Episode ${String(episode)}`,
      language: 'tr',
      synopsis: '',
      runtimeMinutes: 30,
      audioLanguages: [],
      subtitleLanguages: [],
    })),
  };
}

const episodes = orderEpisodes([season(2, [2, 1]), season(1, [2, 1, 3])]);

function view(contentId: string, changes: Partial<ProgressView> = {}): ProgressView {
  return {
    contentId,
    positionSeconds: 300,
    durationSeconds: 1800,
    completed: false,
    updatedAt: '2026-11-20T10:00:00Z',
    ...changes,
  };
}

describe('orderEpisodes', () => {
  it('orders seasons, then episodes, by number', () => {
    expect(episodes.map((episode) => episode.id)).toEqual(['s1e1', 's1e2', 's1e3', 's2e1', 's2e2']);
    expect(episodes[3]).toEqual({ id: 's2e1', seasonNumber: 2, number: 1, title: 'Episode 1' });
  });
});

describe('nextEpisode', () => {
  it('is the episode after, across seasons, and none after the last or for an unknown one', () => {
    expect(nextEpisode(episodes, 's1e2')?.id).toBe('s1e3');
    expect(nextEpisode(episodes, 's1e3')?.id).toBe('s2e1');
    expect(nextEpisode(episodes, 's2e2')).toBeUndefined();
    expect(nextEpisode(episodes, 'gone')).toBeUndefined();
  });
});

describe('chooseEpisode', () => {
  it('starts at the first episode without progress', () => {
    expect(chooseEpisode(episodes, [])).toEqual({ episode: episodes[0], started: false });
    expect(chooseEpisode([], [])).toBeUndefined();
  });

  it('goes on with the episode watched last', () => {
    const choice = chooseEpisode(episodes, [
      view('s1e1', { completed: true, updatedAt: '2026-11-19T10:00:00Z' }),
      view('s1e3', { updatedAt: '2026-11-20T11:00:00Z' }),
      view('s1e2', { updatedAt: '2026-11-20T09:00:00Z' }),
    ]);

    expect(choice).toEqual({ episode: episodes[2], started: true });
  });

  it('takes the next episode after a finished one, across seasons', () => {
    expect(chooseEpisode(episodes, [view('s1e3', { completed: true })])).toEqual({
      episode: episodes[3],
      started: false,
    });
  });

  it('starts again after the last episode, and ignores what is no longer published', () => {
    expect(chooseEpisode(episodes, [view('s2e2', { completed: true })])?.episode).toBe(episodes[0]);
    expect(
      chooseEpisode(episodes, [view('gone', { updatedAt: '2027-01-01T00:00:00Z' }), view('s1e2')]),
    ).toEqual({
      episode: episodes[1],
      started: true,
    });
  });

  it('does not call an episode at zero started', () => {
    expect(chooseEpisode(episodes, [view('s1e2', { positionSeconds: 0 })])).toEqual({
      episode: episodes[1],
      started: false,
    });
  });
});
