import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GenreRoute, { generateMetadata } from '../../app/[lang]/genres/[id]/page';
import SearchRoute from '../../app/[lang]/search/page';
import { loadGenres, loadSearch, loadTitles, viewerAgeLimit } from '../../server/catalog';
import { comedy, drama, title, titlePage } from '../../test/catalog';
import { renderPage, serverRendered } from '../../test/render';

vi.mock('../../server/catalog', () => ({
  loadGenres: vi.fn(),
  loadSearch: vi.fn(),
  loadTitles: vi.fn(),
  viewerAgeLimit: vi.fn(),
}));

const params = (lang: string, id: string, search: Record<string, string> = {}) => ({
  params: Promise.resolve({ lang, id }),
  searchParams: Promise.resolve(search),
});

beforeEach(() => {
  vi.mocked(viewerAgeLimit).mockResolvedValue('Age13');
  vi.mocked(loadGenres).mockResolvedValue([drama, comedy]);
  vi.mocked(loadTitles).mockResolvedValue(titlePage([title(1), title(2, { kind: 'Series' })]));
  vi.mocked(loadSearch).mockResolvedValue(titlePage([title(3)], 1, 1));
});

describe('GenreRoute', () => {
  it("lists the genre's movies and series together, sorted as asked, within the profile's limit", async () => {
    renderPage(
      await serverRendered(GenreRoute(params('tr', drama.id.toUpperCase(), { sort: 'Newest', page: '2' }))),
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Dram' })).toBeInTheDocument();
    expect(loadTitles).toHaveBeenCalledWith(
      { lang: 'tr', genreId: drama.id, sort: 'Newest', maxAgeRating: 'Age13' },
      2,
    );
    expect(screen.getByRole('link', { name: 'Yeni' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Popüler' })).toHaveAttribute('href', `/tr/genres/${drama.id}`);
    expect(screen.queryByRole('navigation', { name: 'Türler' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Title 2/ })).toHaveAttribute(
      'href',
      `/tr/series/${title(2).id}`,
    );
  });

  it('is a 404 for a genre without published content or a malformed id', async () => {
    await expect(GenreRoute(params('tr', '0195f0e0-0000-7000-8000-00000000dfff'))).rejects.toThrow();
    await expect(GenreRoute(params('tr', 'drama'))).rejects.toThrow();
  });

  it('describes the genre', async () => {
    expect(await generateMetadata(params('en', comedy.id))).toMatchObject({
      title: 'Komedi',
      description: 'Movies and series in Komedi.',
      alternates: { canonical: `/en/genres/${comedy.id}` },
    });
    expect(await generateMetadata(params('en', 'nope'))).toEqual({});
  });
});

describe('SearchRoute', () => {
  it("searches the address's text on the server, within the profile's limit", async () => {
    renderPage(
      await serverRendered(
        SearchRoute({
          params: Promise.resolve({ lang: 'tr' }),
          searchParams: Promise.resolve({ q: ' kuzey ', page: '2' }),
        }),
      ),
    );

    expect(loadSearch).toHaveBeenCalledWith({ q: 'kuzey', lang: 'tr', maxAgeRating: 'Age13' }, 2);
    expect(screen.getByRole('searchbox')).toHaveValue('kuzey');
    expect(screen.getByRole('link', { name: /Title 3/ })).toBeInTheDocument();
  });

  it('does not search for nothing, and says when search is down', async () => {
    renderPage(
      await serverRendered(
        SearchRoute({ params: Promise.resolve({ lang: 'tr' }), searchParams: Promise.resolve({}) }),
      ),
    );
    expect(loadSearch).not.toHaveBeenCalled();

    vi.mocked(loadSearch).mockResolvedValue('unavailable');
    renderPage(
      await serverRendered(
        SearchRoute({
          params: Promise.resolve({ lang: 'tr' }),
          searchParams: Promise.resolve({ q: 'gece' }),
        }),
      ),
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Arama şu an kullanılamıyor.');
  });
});
