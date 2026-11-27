import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MoviePage, { generateMetadata as movieMetadata } from '../../app/[lang]/movies/[id]/page';
import SeriesPage from '../../app/[lang]/series/[id]/page';
import { loadMovie, loadSeries, loadSimilar, viewerAgeLimit } from '../../server/catalog';
import { movie, series, title } from '../../test/catalog';
import { renderPage, serverRendered, server, signedOut } from '../../test/render';
import { loadSimilarTitles, similarCount, titleMetadata } from './title-page';

vi.mock('../../server/catalog', () => ({
  loadMovie: vi.fn(),
  loadSeries: vi.fn(),
  loadSimilar: vi.fn(),
  viewerAgeLimit: vi.fn(),
}));

const params = (lang: string, id: string) => ({
  params: Promise.resolve({ lang, id }),
  searchParams: Promise.resolve({}),
});

beforeEach(() => {
  server.use(signedOut);
  vi.mocked(viewerAgeLimit).mockResolvedValue(undefined);
  vi.mocked(loadMovie).mockResolvedValue(movie);
  vi.mocked(loadSeries).mockResolvedValue(series);
  vi.mocked(loadSimilar).mockResolvedValue([title(1), title(2)]);
});

describe('MoviePage', () => {
  it('shows the movie: name, facts, synopsis and the languages its video offers', async () => {
    renderPage(await serverRendered(MoviePage(params('tr', movie.id))), 'tr', { withProfiles: true });

    expect(screen.getByRole('heading', { level: 1, name: 'Kuzey Işığı' })).toBeInTheDocument();
    expect(screen.getByText('Northern Light')).toBeInTheDocument();
    expect(screen.getByText('1 sa 48 dk')).toBeInTheDocument();
    expect(screen.getByText('Dram, Komedi')).toBeInTheDocument();
    expect(screen.getByText(movie.synopsis)).toBeInTheDocument();
    expect(screen.getByText('Türkçe, İngilizce')).toBeInTheDocument();
    expect(screen.getByText('Amerikan İngilizcesi, İngiliz İngilizcesi')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Oynat' })).toHaveAttribute('href', `/tr/watch/${movie.id}`);
  });

  it("draws the movie's logo for its name, which stays its text", async () => {
    vi.mocked(loadMovie).mockResolvedValue({
      ...movie,
      logoUrl: 'http://127.0.0.1:10000/devstoreaccount1/images/0123456789abcdef0123456789abcdef.png',
    });
    renderPage(await serverRendered(MoviePage(params('tr', movie.id))), 'tr', { withProfiles: true });

    const heading = screen.getByRole('heading', { level: 1, name: 'Kuzey Işığı' });
    expect(within(heading).getByRole('img', { name: 'Kuzey Işığı' })).toBeInTheDocument();
  });

  it('lists the crew by role and the cast in order, each leading to their page', async () => {
    renderPage(await serverRendered(MoviePage(params('en', movie.id))), 'en', { withProfiles: true });

    const credits = screen.getByRole('region', { name: 'Cast and crew' });
    expect(within(credits).getByRole('link', { name: 'Kerem Yalçın' })).toHaveAttribute(
      'href',
      '/en/people/p-director',
    );
    expect(within(credits).getByText('Director')).toBeInTheDocument();
    expect(within(credits).getByText('Writer')).toBeInTheDocument();
    const cast = within(credits).getAllByRole('listitem');
    expect(cast.map((item) => item.textContent)).toEqual(['Defne AksoyNehir', 'Can ErdemBekçi']);
  });

  it('names the original title only when it differs', async () => {
    vi.mocked(loadMovie).mockResolvedValue({ ...movie, originalTitle: movie.title });

    renderPage(await serverRendered(MoviePage(params('tr', movie.id))), 'tr', { withProfiles: true });

    expect(screen.queryByText(/Orijinal adı/)).not.toBeInTheDocument();
  });

  it('shows similar titles', async () => {
    renderPage(await serverRendered(MoviePage(params('tr', movie.id))), 'tr', { withProfiles: true });
    expect(screen.getByRole('region', { name: 'Benzer içerikler' })).toHaveTextContent('Title 1');
  });

  it('leaves the similar row out when there is nothing like it', async () => {
    vi.mocked(loadSimilar).mockResolvedValue([]);
    renderPage(await serverRendered(MoviePage(params('tr', movie.id))), 'tr', { withProfiles: true });
    expect(screen.queryByRole('region', { name: 'Benzer içerikler' })).not.toBeInTheDocument();
  });

  it('is a 404 for an unknown, unpublished or malformed id', async () => {
    vi.mocked(loadMovie).mockResolvedValue(null);
    await expect(MoviePage(params('tr', movie.id))).rejects.toThrow();

    vi.mocked(loadMovie).mockClear();
    await expect(MoviePage(params('tr', 'not-an-id'))).rejects.toThrow();
    expect(loadMovie).not.toHaveBeenCalled();
  });

  it('describes itself to search engines and link previews', async () => {
    expect(await movieMetadata(params('en', movie.id))).toMatchObject({
      title: 'Kuzey Işığı',
      description: movie.synopsis,
      alternates: {
        canonical: `/en/movies/${movie.id}`,
        languages: { tr: `/tr/movies/${movie.id}`, en: `/en/movies/${movie.id}` },
      },
      openGraph: {
        type: 'video.movie',
        locale: 'en_US',
        alternateLocale: ['tr_TR'],
        images: [{ url: 'http://storage.test/backdrop.png' }],
      },
    });
    vi.mocked(loadMovie).mockResolvedValue(null);
    expect(await movieMetadata(params('en', movie.id))).toEqual({});
  });
});

describe('SeriesPage', () => {
  it('shows the first season, and another one when it is chosen', async () => {
    renderPage(await serverRendered(SeriesPage(params('tr', series.id))), 'tr', { withProfiles: true });

    expect(screen.getByText('2 sezon')).toBeInTheDocument();
    // Its play button starts at the first episode of the first season.
    expect(screen.getByRole('link', { name: 'Oynat' })).toHaveAttribute(
      'href',
      `/tr/watch/${series.id}?episode=e11`,
    );
    const episodes = screen.getByRole('region', { name: 'Bölümler' });
    expect(
      within(episodes)
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(['1. Pilot', '2. İlk Robot']);
    expect(within(episodes).getByText('1 sa 1 dk')).toBeInTheDocument();

    const picker = within(episodes).getByRole('combobox', { name: 'Sezon' });
    expect(
      within(picker)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Başlangıç', '2. Sezon']);
    await userEvent.setup().selectOptions(picker, 's2');

    expect(
      within(episodes)
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(['1. Yeni Atölye']);
  });

  it('names its only season without a picker, and leaves out what it does not have', async () => {
    vi.mocked(loadSeries).mockResolvedValue({ ...series, seasons: series.seasons.slice(1) });

    renderPage(await serverRendered(SeriesPage(params('en', series.id))), 'en', { withProfiles: true });

    expect(screen.getByText('1 season')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByText('Başlangıç')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Cast and crew' })).not.toBeInTheDocument();
    expect(screen.queryByText('Subtitles')).not.toBeInTheDocument();
  });
});

describe('loadSimilarTitles', () => {
  it("asks Catalog for titles like this one, within the chosen profile's limit", async () => {
    vi.mocked(viewerAgeLimit).mockResolvedValue('Age7');

    const similar = await loadSimilarTitles('en', { kind: 'Movie', item: movie });

    expect(loadSimilar).toHaveBeenCalledWith(movie.id, 'en', similarCount, 'Age7');
    expect(similar.map((item) => item.id)).toEqual([title(1).id, title(2).id]);
  });
});

describe('titleMetadata', () => {
  it('describes a series as a show, without an image when it has none', () => {
    const metadata = titleMetadata('tr', { kind: 'Series', item: series });

    expect(metadata.openGraph).toMatchObject({ type: 'video.tv_show', locale: 'tr_TR' });
    expect(metadata.openGraph).not.toHaveProperty('images');
  });
});
