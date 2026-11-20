import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { catalogUrl, locationOf, problem, renderApp, server, signInWith } from '../test/render';

const drama = {
  id: '0195f0e0-0000-7000-8000-00000000d001',
  name: 'Dram',
  translations: { tr: 'Dram', en: 'Drama' },
  usageCount: 2,
};
const comedy = {
  id: '0195f0e0-0000-7000-8000-00000000d002',
  name: 'Komedi',
  translations: { tr: 'Komedi' },
  usageCount: 1,
};

function movie(index: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `0195f0e0-0000-7000-8000-${String(index).padStart(12, '0')}`,
    title: `Film ${String(index)}`,
    releaseYear: 2020 + index,
    ageRating: 'Age13',
    runtimeMinutes: 100,
    status: 'Draft',
    publishedAt: null,
    posterUrl: null,
    genres: [{ id: drama.id, name: 'Dram' }],
    ...overrides,
  };
}

/** Answers the list and keeps each query string asked. */
function answerMovies(totalCount = 2) {
  const asked: string[] = [];
  server.use(
    http.get(`${catalogUrl}/genres`, () => HttpResponse.json([drama, comedy])),
    http.get(`${catalogUrl}/movies`, ({ request }) => {
      asked.push(new URL(request.url).search);
      return HttpResponse.json({
        items: [
          movie(1, { posterUrl: 'https://images.test/1.jpg', status: 'Published' }),
          movie(2, {
            ageRating: 'All',
            genres: [
              { id: drama.id, name: 'Dram' },
              { id: comedy.id, name: 'Komedi' },
            ],
          }),
        ],
        pageNumber: 1,
        pageSize: 20,
        totalCount,
      });
    }),
  );
  return asked;
}

async function table() {
  return within(await screen.findByRole('main')).findByRole('table');
}

describe('MoviesPage', () => {
  it('lists the movies with their poster, year, age, genres and status', async () => {
    signInWith(['catalog:movies:read', 'catalog:movies:write']);
    const asked = answerMovies();
    renderApp('/movies');

    const list = await table();
    expect(document.title).toBe('Filmler');
    const rows = within(list).getAllByRole('row').slice(1);
    expect(
      rows.map((row) =>
        within(row)
          .getAllByRole('cell')
          .map((cell) => cell.textContent),
      ),
    ).toEqual([
      ['Film 1', '2021', '13+', 'Dram', 'Yayında'],
      ['Film 2', '2022', 'Genel izleyici', 'Dram, Komedi', 'Taslak'],
    ]);
    const first = within(list).getByRole('link', { name: 'Film 1' });
    expect(first).toHaveAttribute('href', `/movies/${movie(1).id}`);
    expect(first.querySelector('img')).toHaveAttribute('src', 'https://images.test/1.jpg');
    expect(within(list).getByRole('link', { name: 'Film 2' }).querySelector('img')).toBeNull();
    expect(asked).toEqual(['?page=1&pageSize=20']);
    expect(screen.getByRole('link', { name: 'Yeni film' })).toHaveAttribute('href', '/movies/new');
    const menu = screen.getByRole('navigation', { name: 'Yönetim menüsü' });
    expect(
      within(menu)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Filmler']);
  });

  it('offers no new movie without the write permission', async () => {
    signInWith(['catalog:movies:read']);
    answerMovies();
    renderApp('/movies');

    await table();
    expect(screen.queryByRole('link', { name: 'Yeni film' })).not.toBeInTheDocument();
  });

  it('filters by status and genre from the first page, keeping the search', async () => {
    signInWith(['catalog:movies:read']);
    const asked = answerMovies(45);
    const { router } = renderApp('/movies?search=Gece&page=2');

    await table();
    expect(asked).toEqual(['?search=Gece&page=2&pageSize=20']);
    const genre = screen.getByLabelText('Tür');
    expect(
      within(genre)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Hepsi', 'Dram', 'Komedi']);

    await userEvent.selectOptions(screen.getByLabelText('Durum'), 'Taslak');
    await waitFor(() => {
      expect(locationOf(router)).toBe('/movies?search=Gece&status=Draft');
    });
    await userEvent.selectOptions(genre, 'Komedi');
    await waitFor(() => {
      expect(locationOf(router)).toBe(`/movies?search=Gece&status=Draft&genreId=${comedy.id}`);
    });
    await waitFor(() => {
      expect(asked.at(-1)).toBe(`?search=Gece&status=Draft&genreId=${comedy.id}&page=1&pageSize=20`);
    });
    expect(screen.getByLabelText('Durum')).toHaveValue('Draft');
    expect(genre).toHaveValue(comedy.id);

    await userEvent.selectOptions(screen.getByLabelText('Durum'), 'Hepsi');
    await waitFor(() => {
      expect(locationOf(router)).toBe(`/movies?search=Gece&genreId=${comedy.id}`);
    });
    await waitFor(() => {
      expect(asked.at(-1)).toBe(`?search=Gece&genreId=${comedy.id}&page=1&pageSize=20`);
    });
  });

  it('names the genres in the panel language', async () => {
    signInWith(['catalog:movies:read']);
    answerMovies();
    window.localStorage.setItem('nbp-admin-lang', 'en');
    renderApp('/movies');

    await table();
    expect(
      within(screen.getByLabelText('Genre'))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['All', 'Drama', 'Komedi']);
  });

  it('ignores an unknown status in the address', async () => {
    signInWith(['catalog:movies:read']);
    const asked = answerMovies();
    renderApp('/movies?status=Gone');

    await table();
    expect(asked).toEqual(['?page=1&pageSize=20']);
    expect(screen.getByLabelText('Durum')).toHaveValue('');
  });

  it('searches and pages, keeping the filters', async () => {
    signInWith(['catalog:movies:read']);
    const asked = answerMovies(45);
    const { router } = renderApp('/movies?status=Published&page=2');

    await table();
    await userEvent.click(screen.getByRole('button', { name: 'Sonraki' }));
    await waitFor(() => {
      expect(locationOf(router)).toBe('/movies?status=Published&page=3');
    });

    await userEvent.type(screen.getByLabelText('Başlığa göre ara'), 'Gece');
    await waitFor(() => {
      expect(locationOf(router)).toBe('/movies?status=Published&search=Gece');
    });
    await waitFor(() => {
      expect(asked.at(-1)).toBe('?search=Gece&status=Published&page=1&pageSize=20');
    });
  });

  it('says when nothing matches and when the list cannot be read', async () => {
    signInWith(['catalog:movies:read']);
    server.use(
      http.get(`${catalogUrl}/genres`, () => HttpResponse.json([])),
      http.get(`${catalogUrl}/movies`, () =>
        HttpResponse.json({ items: [], pageNumber: 1, pageSize: 20, totalCount: 0 }),
      ),
    );
    const first = renderApp('/movies');
    expect(await screen.findByText('Film bulunamadı.')).toBeInTheDocument();
    first.unmount();

    server.use(http.get(`${catalogUrl}/movies`, () => problem(403, 'Auth.Forbidden')));
    renderApp('/movies');
    expect(await screen.findByRole('alert', {}, { timeout: 5000 })).toBeInTheDocument();
  });
});
