import type { TitleFilter } from '@netboxplus/core';
import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadGenres, loadTitles, viewerAgeLimit } from '../../server/catalog';
import { comedy, drama, science, title, titlePage } from '../../test/catalog';
import { renderPage, server, signedOut } from '../../test/render';
import HomePage from './page';

vi.mock('../../server/catalog', () => ({
  loadTitles: vi.fn(),
  loadGenres: vi.fn(),
  viewerAgeLimit: vi.fn(),
}));

const params = (lang: string) => ({ params: Promise.resolve({ lang }), searchParams: Promise.resolve({}) });

function answer(rows: (filter: TitleFilter) => ReturnType<typeof titlePage>) {
  vi.mocked(loadTitles).mockImplementation((filter) => Promise.resolve(rows(filter)));
}

describe('HomePage', () => {
  beforeEach(() => {
    server.use(signedOut);
    vi.mocked(viewerAgeLimit).mockResolvedValue(undefined);
    vi.mocked(loadGenres).mockResolvedValue([drama, comedy, science]);
  });

  it('shows the most watched title, the Top 10, the newest and the first genres; the rest load later', async () => {
    answer((filter) => {
      if (filter.sort === 'Popular' && filter.pageSize === 10) {
        return titlePage([title(1, { backdropUrl: null }), title(2, { title: 'Kuzey Işığı' })]);
      }
      if (filter.genreId === drama.id) {
        return titlePage([title(10)]);
      }
      if (filter.genreId === comedy.id) {
        return titlePage([]);
      }
      return titlePage([title(3)]);
    });

    renderPage(await HomePage(params('tr')));

    // The billboard takes the first title that has a wide image.
    expect(screen.getByRole('heading', { level: 2, name: 'Kuzey Işığı' })).toBeInTheDocument();
    const top = screen.getByRole('region', { name: 'Bu hafta en çok izlenen 10' });
    expect(within(top).getAllByRole('link')[0]).toHaveTextContent(/^1\. sırada: Title 1/);
    expect(screen.getByRole('region', { name: 'Yeni eklenenler' })).toHaveTextContent('Title 3');
    expect(screen.getByRole('region', { name: 'Dram' })).toHaveTextContent('Title 10');
    // An empty genre has no row; the third waits for the screen to come near.
    expect(screen.queryByRole('region', { name: 'Komedi' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Bilim kurgu' })).toHaveAttribute('aria-busy', 'true');
    expect(
      vi
        .mocked(loadTitles)
        .mock.calls.map(([filter]) => filter.genreId)
        .filter(Boolean),
    ).toEqual([drama.id, comedy.id]);
  });

  it("filters every list by the chosen profile's age limit, in the page's language", async () => {
    vi.mocked(viewerAgeLimit).mockResolvedValue('Age7');
    answer(() => titlePage([title(1)]));

    renderPage(await HomePage(params('en')), 'en');

    const filters = vi.mocked(loadTitles).mock.calls.map(([filter]) => filter);
    expect(filters).not.toHaveLength(0);
    expect(filters.every((filter) => filter.maxAgeRating === 'Age7' && filter.lang === 'en')).toBe(true);
    expect(vi.mocked(loadGenres)).toHaveBeenCalledWith('en');
  });

  it('says so when nothing is published yet', async () => {
    vi.mocked(loadGenres).mockResolvedValue([]);
    answer(() => titlePage([]));

    renderPage(await HomePage(params('tr')));

    expect(screen.getByText('Burada henüz bir şey yok.')).toBeInTheDocument();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('is a 404 in an unknown language', async () => {
    await expect(HomePage(params('de'))).rejects.toThrow();
  });
});
