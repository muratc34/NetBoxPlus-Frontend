import type { Genre, PublishedMovie, PublishedSeries, TitlePage, TitleSummary } from '@netboxplus/core';

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
    logoUrl: null,
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

export const movie: PublishedMovie = {
  id: '0195f0e0-0000-7000-8000-00000000f001',
  title: 'Kuzey Işığı',
  language: 'tr',
  originalTitle: 'Northern Light',
  synopsis: 'Bir fener bekçisi fırtınalı bir gecede geçmişiyle yüzleşir.',
  releaseYear: 2023,
  ageRating: 'Age13',
  runtimeMinutes: 108,
  posterUrl: 'http://storage.test/poster.png',
  backdropUrl: 'http://storage.test/backdrop.png',
  logoUrl: null,
  genres: [drama, comedy],
  credits: [
    { personId: 'p-actor-2', personName: 'Can Erdem', role: 'Actor', characterName: 'Bekçi', order: 3 },
    { personId: 'p-director', personName: 'Kerem Yalçın', role: 'Director', characterName: null, order: 0 },
    { personId: 'p-actor-1', personName: 'Defne Aksoy', role: 'Actor', characterName: 'Nehir', order: 2 },
    { personId: 'p-writer', personName: 'Elif Karadağ', role: 'Writer', characterName: null, order: 1 },
  ],
  audioLanguages: ['tr-TR', 'en-US'],
  subtitleLanguages: ['en-US', 'en-GB'],
};

export const series: PublishedSeries = {
  id: '0195f0e0-0000-7000-8000-00000000f002',
  title: 'Robot Atölyesi',
  language: 'tr',
  originalTitle: null,
  synopsis: 'Robotlar yapan iki kardeş.',
  releaseYear: 2024,
  ageRating: 'All',
  posterUrl: null,
  backdropUrl: null,
  logoUrl: null,
  genres: [],
  credits: [],
  seasons: [
    {
      id: 's2',
      number: 2,
      title: null,
      episodes: [
        {
          id: 'e21',
          number: 1,
          title: 'Yeni Atölye',
          language: 'tr',
          synopsis: 'Taşınırlar.',
          runtimeMinutes: 22,
          audioLanguages: [],
          subtitleLanguages: [],
        },
      ],
    },
    {
      id: 's1',
      number: 1,
      title: 'Başlangıç',
      episodes: [
        {
          id: 'e12',
          number: 2,
          title: 'İlk Robot',
          language: 'tr',
          synopsis: 'Çalışır.',
          runtimeMinutes: 25,
          audioLanguages: [],
          subtitleLanguages: [],
        },
        {
          id: 'e11',
          number: 1,
          title: 'Pilot',
          language: 'tr',
          synopsis: 'Başlar.',
          runtimeMinutes: 61,
          audioLanguages: [],
          subtitleLanguages: [],
        },
      ],
    },
  ],
  audioLanguages: ['tr-TR'],
  subtitleLanguages: [],
};
