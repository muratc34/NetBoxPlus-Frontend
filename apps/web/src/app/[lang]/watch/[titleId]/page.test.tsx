import { describe, expect, it, vi } from 'vitest';
import { loadMovie, loadSeries } from '../../../../server/catalog';
import { movie, series } from '../../../../test/catalog';
import { serverRendered } from '../../../../test/render';
import WatchRoute, { generateMetadata } from './page';

vi.mock('../../../../server/catalog', () => ({ loadMovie: vi.fn(), loadSeries: vi.fn() }));
vi.mock('next/navigation', async (original) => ({
  ...(await original<typeof import('next/navigation')>()),
  notFound: () => {
    throw new Error('not found');
  },
}));

const props = (lang: string, titleId: string, searchParams: Record<string, string | string[]> = {}) => ({
  params: Promise.resolve({ lang, titleId }),
  searchParams: Promise.resolve(searchParams),
});

/** The props the route hands the player's page. */
async function watchProps(...args: Parameters<typeof props>) {
  const suspense = await serverRendered(WatchRoute(props(...args)));
  return (suspense.props as { children: { props: unknown } }).children.props;
}

describe('WatchRoute', () => {
  it('hands a movie to the player', async () => {
    vi.mocked(loadMovie).mockResolvedValue(movie);
    vi.mocked(loadSeries).mockResolvedValue(null);

    await expect(watchProps('tr', movie.id)).resolves.toEqual({
      title: { id: movie.id, kind: 'Movie', title: movie.title, episodes: [] },
      episodeId: undefined,
      fromStart: false,
    });
    expect(loadMovie).toHaveBeenCalledWith(movie.id, 'tr');
  });

  it('hands a series with its episodes in order, asking for the series first when an episode is named', async () => {
    vi.mocked(loadMovie).mockClear().mockResolvedValue(null);
    vi.mocked(loadSeries).mockResolvedValue(series);

    const handed = (await watchProps('en', series.id, { episode: ['e12', 'e11'], from: 'start' })) as {
      title: { kind: string; episodes: { id: string }[] };
      episodeId: string;
      fromStart: boolean;
    };

    expect(handed.title.kind).toBe('Series');
    expect(handed.title.episodes.map((episode) => episode.id)).toEqual(['e11', 'e12', 'e21']);
    expect(handed.episodeId).toBe('e12');
    expect(handed.fromStart).toBe(true);
    expect(loadMovie).not.toHaveBeenCalled();
  });

  it('starts over only when asked with "start"', async () => {
    vi.mocked(loadMovie).mockResolvedValue(movie);

    await expect(watchProps('tr', movie.id, { from: 'beginning' })).resolves.toMatchObject({
      fromStart: false,
    });
  });

  it('finds a series without an episode in the address too', async () => {
    vi.mocked(loadMovie).mockResolvedValue(null);
    vi.mocked(loadSeries).mockResolvedValue(series);

    await expect(watchProps('tr', series.id)).resolves.toMatchObject({ title: { kind: 'Series' } });
  });

  it('is a 404 for another language, a malformed id, an unknown title or a series with nothing to play', async () => {
    vi.mocked(loadMovie).mockResolvedValue(null);
    vi.mocked(loadSeries).mockResolvedValue(null);
    await expect(watchProps('de', movie.id)).rejects.toThrow('not found');
    await expect(watchProps('tr', 'not-an-id')).rejects.toThrow('not found');
    await expect(watchProps('tr', movie.id)).rejects.toThrow('not found');

    vi.mocked(loadSeries).mockResolvedValue({
      ...series,
      seasons: series.seasons.map((season) => ({ ...season, episodes: [] })),
    });
    await expect(watchProps('tr', series.id)).rejects.toThrow('not found');
  });

  it('is named after the title and kept out of search engines', async () => {
    vi.mocked(loadMovie).mockResolvedValue(movie);

    await expect(generateMetadata(props('tr', movie.id))).resolves.toEqual({
      title: movie.title,
      robots: { index: false },
    });
  });
});
