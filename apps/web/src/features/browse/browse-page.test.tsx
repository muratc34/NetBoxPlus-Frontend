import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadGenres, loadTitles, viewerAgeLimit } from '../../server/catalog';
import { comedy, drama, title, titlePage } from '../../test/catalog';
import { renderPage } from '../../test/render';
import { browseMetadata, BrowsePage, maxBrowsePage, parseBrowseQuery } from './browse-page';

vi.mock('../../server/catalog', () => ({
  loadTitles: vi.fn(),
  loadGenres: vi.fn(),
  viewerAgeLimit: vi.fn(),
}));

describe('parseBrowseQuery', () => {
  it('reads the genre, sort and page of the address', () => {
    expect(parseBrowseQuery({ genre: drama.id.toUpperCase(), sort: 'Newest', page: '3' })).toEqual({
      genreId: drama.id,
      sort: 'Newest',
      page: 3,
    });
  });

  it('falls back to the unfiltered first page for anything it does not recognise', () => {
    expect(parseBrowseQuery({})).toEqual({ genreId: undefined, sort: 'Popular', page: 1 });
    expect(parseBrowseQuery({ genre: 'drama', sort: 'Oldest', page: '0' })).toEqual({
      genreId: undefined,
      sort: 'Popular',
      page: 1,
    });
    expect(parseBrowseQuery({ page: '1.5' }).page).toBe(1);
    expect(parseBrowseQuery({ page: String(maxBrowsePage) }).page).toBe(maxBrowsePage);
    expect(parseBrowseQuery({ page: String(maxBrowsePage + 1) }).page).toBe(1);
    expect(parseBrowseQuery({ genre: [comedy.id, drama.id] }).genreId).toBe(comedy.id);
  });
});

describe('BrowsePage', () => {
  beforeEach(() => {
    vi.mocked(viewerAgeLimit).mockResolvedValue('Age13');
    vi.mocked(loadGenres).mockResolvedValue([drama, comedy]);
    vi.mocked(loadTitles).mockResolvedValue(titlePage([title(1), title(2)], 2, 60));
  });

  it("lists the kind's titles with the address's filters and the profile's age limit", async () => {
    renderPage(
      await BrowsePage({
        lang: 'tr',
        kind: 'Series',
        searchParams: { genre: drama.id, sort: 'Newest', page: '2' },
      }),
    );

    expect(vi.mocked(loadTitles)).toHaveBeenCalledWith(
      { lang: 'tr', kind: 'Series', sort: 'Newest', genreId: drama.id, maxAgeRating: 'Age13' },
      2,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Diziler' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dram' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /Title 2/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Daha fazla göster' })).toHaveAttribute(
      'href',
      `/tr/series?genre=${drama.id}&sort=Newest&page=3`,
    );
  });

  it('lists everything published when no profile is chosen', async () => {
    vi.mocked(viewerAgeLimit).mockResolvedValue(undefined);

    renderPage(await BrowsePage({ lang: 'en', kind: 'Movie', searchParams: {} }), 'en');

    expect(vi.mocked(loadTitles)).toHaveBeenCalledWith({ lang: 'en', kind: 'Movie', sort: 'Popular' }, 1);
    expect(screen.getByRole('heading', { level: 1, name: 'Movies' })).toBeInTheDocument();
  });
});

describe('browseMetadata', () => {
  it('names the page and its twin in the other language', () => {
    expect(browseMetadata('en', 'Movie')).toMatchObject({
      title: 'Movies',
      alternates: { canonical: '/en/movies', languages: { tr: '/tr/movies', en: '/en/movies' } },
    });
  });
});
