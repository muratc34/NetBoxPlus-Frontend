import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { catalogUrl, locationOf, problem, renderApp, server, signInWith } from '../test/render';

const drama = {
  id: '0195f0e0-0000-7000-8000-00000000d001',
  name: 'Dram',
  translations: { tr: 'Dram' },
  usageCount: 2,
};

function series(index: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `0195f0e0-0000-7000-8000-${String(index).padStart(12, '0')}`,
    title: `Dizi ${String(index)}`,
    releaseYear: 2020 + index,
    ageRating: 'Age13',
    status: 'Published',
    publishedAt: '2026-11-10T09:00:00Z',
    seasonCount: index,
    episodeCount: index * 3,
    posterUrl: null,
    genres: [{ id: drama.id, name: 'Dram' }],
    ...overrides,
  };
}

function answerSeries(totalCount = 2) {
  const asked: string[] = [];
  server.use(
    http.get(`${catalogUrl}/genres`, () => HttpResponse.json([drama])),
    http.get(`${catalogUrl}/series`, ({ request }) => {
      asked.push(new URL(request.url).search);
      return HttpResponse.json({
        items: [series(1), series(2, { status: 'Draft', publishedAt: null })],
        pageNumber: 1,
        pageSize: 20,
        totalCount,
      });
    }),
  );
  return asked;
}

describe('SeriesListPage', () => {
  it('lists the series with their seasons and episodes', async () => {
    signInWith(['catalog:series:read', 'catalog:series:write']);
    const asked = answerSeries();
    renderApp('/series');

    const table = await within(await screen.findByRole('main')).findByRole('table');
    expect(document.title).toBe('Diziler');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Başlık', 'Yapım yılı', 'Yaş sınırı', 'Türler', 'Sezon', 'Bölüm', 'Durum']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(
      rows.map((row) =>
        within(row)
          .getAllByRole('cell')
          .map((cell) => cell.textContent),
      ),
    ).toEqual([
      ['Dizi 1', '2021', '13+', 'Dram', '1', '3', 'Yayında'],
      ['Dizi 2', '2022', '13+', 'Dram', '2', '6', 'Taslak'],
    ]);
    expect(within(table).getByRole('link', { name: 'Dizi 1' })).toHaveAttribute(
      'href',
      `/series/${series(1).id}`,
    );
    expect(screen.getByRole('link', { name: 'Yeni dizi' })).toHaveAttribute('href', '/series/new');
    expect(asked).toEqual(['?page=1&pageSize=20']);
    const menu = screen.getByRole('navigation', { name: 'Yönetim menüsü' });
    expect(
      within(menu)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Diziler']);
  });

  it('filters, searches and pages in the address', async () => {
    signInWith(['catalog:series:read']);
    const asked = answerSeries(45);
    const { router } = renderApp('/series?page=2');

    await within(await screen.findByRole('main')).findByRole('table');
    expect(screen.queryByRole('link', { name: 'Yeni dizi' })).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Durum'), 'Taslak');
    await waitFor(() => {
      expect(locationOf(router)).toBe('/series?status=Draft');
    });
    await userEvent.type(screen.getByLabelText('Başlığa göre ara'), 'Rüzgar');
    await waitFor(() => {
      expect(asked.at(-1)).toBe('?search=R%C3%BCzgar&status=Draft&page=1&pageSize=20');
    });
    await userEvent.click(screen.getByRole('button', { name: 'Sonraki' }));
    await waitFor(() => {
      expect(locationOf(router)).toBe('/series?status=Draft&search=R%C3%BCzgar&page=2');
    });
  });

  it('says when nothing matches and when the list cannot be read', async () => {
    signInWith(['catalog:series:read']);
    server.use(
      http.get(`${catalogUrl}/genres`, () => HttpResponse.json([])),
      http.get(`${catalogUrl}/series`, () =>
        HttpResponse.json({ items: [], pageNumber: 1, pageSize: 20, totalCount: 0 }),
      ),
    );
    const first = renderApp('/series');
    expect(await screen.findByText('Dizi bulunamadı.')).toBeInTheDocument();
    first.unmount();

    server.use(http.get(`${catalogUrl}/series`, () => problem(403, 'Auth.Forbidden')));
    renderApp('/series');
    expect(await screen.findByRole('alert', {}, { timeout: 5000 })).toBeInTheDocument();
  });
});
