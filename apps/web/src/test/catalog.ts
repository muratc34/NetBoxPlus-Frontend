import type { Genre, TitlePage, TitleSummary } from '@netboxplus/core';

export const drama: Genre = { id: '0195f0e0-0000-7000-8000-00000000d001', name: 'Dram' };
export const comedy: Genre = { id: '0195f0e0-0000-7000-8000-00000000d002', name: 'Komedi' };
export const science: Genre = { id: '0195f0e0-0000-7000-8000-00000000d003', name: 'Bilim kurgu' };

/** A published title as Catalog lists it; the id ends with `n`. */
export function title(n: number, overrides: Partial<TitleSummary> = {}): TitleSummary {
  return {
    id: `0195f0e0-0000-7000-8000-${String(n).padStart(12, '0')}`,
    kind: 'Movie',
    title: `Title ${String(n)}`,
    language: 'tr',
    releaseYear: 2024,
    ageRating: 'Age13',
    posterUrl: null,
    backdropUrl: `http://storage.test/images/${String(n)}.png`,
    genres: [drama],
    ...overrides,
  };
}

export function titlePage(
  items: TitleSummary[],
  pageNumber = 1,
  totalCount = items.length,
  pageSize = 20,
): TitlePage {
  return { items, pageNumber, pageSize, totalCount };
}
