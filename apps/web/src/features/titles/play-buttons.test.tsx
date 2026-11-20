import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { movie, series } from '../../test/catalog';
import { gatewayUrl, renderPage, server, signInAs, watchingProfile } from '../../test/render';
import { orderEpisodes } from '../watch/episodes';
import { EpisodeList } from './episode-list';
import { PlayButtons } from './play-buttons';

const episodes = orderEpisodes(series.seasons);

function progress(views: object[]) {
  signInAs();
  server.use(
    http.get(`${gatewayUrl}/streaming/profiles/${watchingProfile.id}/progress`, () =>
      HttpResponse.json(views),
    ),
  );
}

const view = (contentId: string, positionSeconds: number, completed = false) => ({
  contentId,
  positionSeconds,
  durationSeconds: 1500,
  completed,
  updatedAt: '2026-11-20T10:00:00Z',
});

describe('PlayButtons', () => {
  it('plays a movie from the start for a visitor', () => {
    renderPage(<PlayButtons titleId={movie.id} kind="Movie" episodes={[]} />);

    expect(screen.getByRole('link', { name: 'Oynat' })).toHaveAttribute('href', `/tr/watch/${movie.id}`);
    expect(screen.queryByRole('link', { name: 'Baştan izle' })).not.toBeInTheDocument();
  });

  it('resumes a started movie, or starts it over', async () => {
    progress([view(movie.id, 600)]);
    renderPage(<PlayButtons titleId={movie.id} kind="Movie" episodes={[]} />);

    expect(await screen.findByRole('link', { name: 'Devam et' })).toHaveAttribute(
      'href',
      `/tr/watch/${movie.id}`,
    );
    expect(screen.getByRole('link', { name: 'Baştan izle' })).toHaveAttribute(
      'href',
      `/tr/watch/${movie.id}?from=start`,
    );
  });

  it('plays a finished movie again from the start', async () => {
    progress([view(movie.id, 1500, true)]);
    renderPage(<PlayButtons titleId={movie.id} kind="Movie" episodes={[]} />);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByRole('link', { name: 'Oynat' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Baştan izle' })).not.toBeInTheDocument();
  });

  it('starts a series at its first episode without naming it', () => {
    renderPage(<PlayButtons titleId={series.id} kind="Series" episodes={episodes} />);

    expect(screen.getByRole('link', { name: 'Oynat' })).toHaveAttribute(
      'href',
      `/tr/watch/${series.id}?episode=e11`,
    );
  });

  it('names the episode a series goes on with', async () => {
    progress([view('e12', 300)]);
    renderPage(<PlayButtons titleId={series.id} kind="Series" episodes={episodes} />, 'en');

    expect(await screen.findByRole('link', { name: 'Resume · S1:E2' })).toHaveAttribute(
      'href',
      `/en/watch/${series.id}?episode=e12`,
    );
    expect(screen.getByRole('link', { name: 'Start over' })).toHaveAttribute(
      'href',
      `/en/watch/${series.id}?episode=e12&from=start`,
    );
  });

  it('offers the next episode after a finished one', async () => {
    progress([view('e12', 1500, true)]);
    renderPage(<PlayButtons titleId={series.id} kind="Series" episodes={episodes} />);

    expect(await screen.findByRole('link', { name: 'Oynat · S2:B1' })).toHaveAttribute(
      'href',
      `/tr/watch/${series.id}?episode=e21`,
    );
    expect(screen.queryByRole('link', { name: 'Baştan izle' })).not.toBeInTheDocument();
  });

  it('shows nothing for a series without episodes', () => {
    const { container } = renderPage(<PlayButtons titleId={series.id} kind="Series" episodes={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('EpisodeList', () => {
  it('plays each episode', () => {
    renderPage(<EpisodeList seriesId={series.id} seasons={series.seasons} />);

    expect(screen.getByRole('link', { name: '2. bölümü oynat: İlk Robot' })).toHaveAttribute(
      'href',
      `/tr/watch/${series.id}?episode=e12`,
    );
  });
});
