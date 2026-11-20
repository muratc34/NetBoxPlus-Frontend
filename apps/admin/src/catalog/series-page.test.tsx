import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { EpisodeResponse, SeasonDetails, SeriesDetails } from '../data/series';
import { catalogUrl, locationOf, problem, renderApp, server, signInWith } from '../test/render';

const everything = [
  'catalog:series:read',
  'catalog:series:write',
  'catalog:series:publish',
  'catalog:series:delete',
  'catalog:images:upload',
];

const drama = {
  id: '0195f0e0-0000-7000-8000-00000000d001',
  name: 'Dram',
  translations: { tr: 'Dram' },
  usageCount: 2,
};
const elif = { id: '0195f0e0-0000-7000-8000-0000000000b1', name: 'Elif Karadağ' };

function episode(number: number, overrides: Partial<EpisodeResponse> = {}): EpisodeResponse {
  return {
    id: `0195f0e0-0000-7000-8000-0000000e${String(number).padStart(4, '0')}`,
    number,
    title: `Bölüm ${String(number)}`,
    translations: { tr: { title: `Bölüm ${String(number)}`, synopsis: 'Özet.' } },
    runtimeMinutes: 45,
    status: 'Draft',
    publishedAt: null,
    videoStatus: 'Ready',
    hasPlayableVideo: true,
    ...overrides,
  };
}

const first: SeasonDetails = {
  id: '0195f0e0-0000-7000-8000-0000000005a1',
  number: 1,
  title: 'Başlangıç',
  translations: { tr: 'Başlangıç' },
  episodes: [episode(2), episode(1, { status: 'Published', publishedAt: '2026-11-10T09:00:00Z' })],
};

const ruzgar: SeriesDetails = {
  id: '0195f0e0-0000-7000-8000-00000000c501',
  title: 'Rüzgarın Kızı',
  originalTitle: null,
  translations: { tr: { title: 'Rüzgarın Kızı', synopsis: 'Bir ailenin hikâyesi.' } },
  releaseYear: 2022,
  ageRating: 'Age13',
  status: 'Draft',
  publishedAt: null,
  version: 10,
  posterUrl: 'https://images.test/poster.jpg',
  backdropUrl: null,
  genres: [{ id: drama.id, name: 'Dram' }],
  credits: [{ personId: elif.id, personName: elif.name, role: 'Creator', characterName: null, order: 0 }],
  seasons: [first],
  createdAt: '2026-11-01T10:00:00Z',
  modifiedAt: null,
};

/** Catalog's copy of the series; a change the test makes is seen on the next read. */
function answerSeries(series: SeriesDetails = ruzgar) {
  let current = series;
  server.use(
    http.get(`${catalogUrl}/series/${series.id}`, () => HttpResponse.json(current)),
    http.get(`${catalogUrl}/series`, () =>
      HttpResponse.json({ items: [], pageNumber: 1, pageSize: 20, totalCount: 0 }),
    ),
    http.get(`${catalogUrl}/genres`, () => HttpResponse.json([drama])),
    http.get(`${catalogUrl}/people`, () =>
      HttpResponse.json({ items: [], pageNumber: 1, pageSize: 20, totalCount: 0 }),
    ),
  );
  return (next: Partial<SeriesDetails>) => {
    current = { ...current, ...next };
  };
}

/** Answers a request and keeps what was sent: the body, or else the query string. */
function record(
  method: 'post' | 'put' | 'delete',
  path: string,
  answer: () => Response = () => new HttpResponse(null, { status: 204 }),
) {
  const sent: unknown[] = [];
  server.use(
    http[method](`${catalogUrl}${path}`, async ({ request }) => {
      const text = await request.text();
      sent.push(text ? JSON.parse(text) : new URL(request.url).search);
      return answer();
    }),
  );
  return sent;
}

const seasons = () => screen.getByRole('region', { name: 'Sezonlar ve bölümler' });
const season = (name: string) => within(seasons()).getByRole('region', { name });
const form = () => screen.getByRole('form', { name: 'Dizi bilgileri' });

describe('SeriesPage', () => {
  it('shows the series with a creator among the roles and saves it without a runtime', async () => {
    signInWith(everything);
    answerSeries();
    const bodies = record('put', `/series/${ruzgar.id}`);
    renderApp(`/series/${ruzgar.id}`);

    await screen.findByRole('heading', { level: 1, name: 'Rüzgarın Kızı' });
    expect(document.title).toBe('Rüzgarın Kızı');
    expect(screen.queryByLabelText('Süre (dakika)', { selector: 'form input' })).not.toBeInTheDocument();
    const role = screen.getByLabelText('Elif Karadağ: rol');
    expect(role).toHaveValue('Creator');
    expect(
      within(role)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Yaratıcı', 'Yönetmen', 'Senarist', 'Oyuncu']);

    await userEvent.type(screen.getByLabelText('Orijinal başlık'), 'Daughter of the Wind');
    await userEvent.click(within(form()).getByRole('button', { name: 'Kaydet' }));

    expect(await within(form()).findByRole('status')).toHaveTextContent('Kaydedildi.');
    expect(bodies).toEqual([
      {
        translations: { tr: { title: 'Rüzgarın Kızı', synopsis: 'Bir ailenin hikâyesi.' } },
        originalTitle: 'Daughter of the Wind',
        releaseYear: 2022,
        ageRating: 'Age13',
        genreIds: [drama.id],
        credits: [{ personId: elif.id, role: 'Creator', characterName: null, order: 0 }],
        version: 10,
      },
    ]);

    await userEvent.click(within(form()).getByRole('button', { name: 'Kaydet' }));
    await waitFor(() => {
      expect(bodies).toHaveLength(2);
    });
    expect(bodies[1]).toMatchObject({ version: 11 });
  });

  it('makes a series and goes on to its page', async () => {
    signInWith(everything);
    answerSeries({ ...ruzgar, seasons: [] });
    let sent: unknown;
    server.use(
      http.post(`${catalogUrl}/series`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ id: ruzgar.id }, { status: 201 });
      }),
    );
    const { router } = renderApp('/series/new');

    await screen.findByRole('heading', { level: 1, name: 'Yeni dizi' });
    expect(document.title).toBe('Yeni dizi');
    expect(screen.queryByRole('region', { name: 'Sezonlar ve bölümler' })).not.toBeInTheDocument();
    const turkish = screen.getByRole('group', { name: 'Türkçe' });
    await userEvent.type(within(turkish).getByLabelText('Başlık'), 'Rüzgarın Kızı');
    await userEvent.type(within(turkish).getByLabelText('Özet'), 'Bir ailenin hikâyesi.');
    await userEvent.type(screen.getByLabelText('Yapım yılı'), '2022');
    await userEvent.click(within(form()).getByRole('button', { name: 'Kaydet' }));

    await screen.findByRole('heading', { level: 1, name: 'Rüzgarın Kızı' });
    expect(locationOf(router)).toBe(`/series/${ruzgar.id}`);
    expect(sent).toEqual({
      translations: { tr: { title: 'Rüzgarın Kızı', synopsis: 'Bir ailenin hikâyesi.' } },
      originalTitle: null,
      releaseYear: 2022,
      ageRating: 'All',
      genreIds: [],
      credits: [],
      version: 0,
    });
    expect(within(seasons()).getByText('Henüz sezon yok.')).toBeInTheDocument();
  });

  it('puts Catalog’s refusals on the series fields and a conflict above them', async () => {
    signInWith(everything);
    answerSeries();
    let answer = () =>
      problem(400, 'Validation.Failed', {
        errorCodes: { 'translations.tr.synopsis': ['Content.SynopsisTooLong'] },
      });
    record('put', `/series/${ruzgar.id}`, () => answer());
    renderApp(`/series/${ruzgar.id}`);

    await userEvent.click(
      await within(await screen.findByRole('form', { name: 'Dizi bilgileri' })).findByRole('button', {
        name: 'Kaydet',
      }),
    );
    expect(await screen.findByText('Özet en fazla 2000 karakter olabilir.')).toBeInTheDocument();

    answer = () => problem(409, 'Content.GenreRequired');
    await userEvent.click(within(form()).getByRole('button', { name: 'Kaydet' }));
    expect(await screen.findByText('Yayındaki içeriğin en az bir türü olmalı.')).toBeInTheDocument();

    answer = () => problem(409, 'Content.VersionConflict');
    await userEvent.click(within(form()).getByRole('button', { name: 'Kaydet' }));
    expect(
      await screen.findByText(
        'Sen düzenlerken bu kaydı başka biri değiştirdi; değişikliklerin kaydedilmedi.',
      ),
    ).toBeInTheDocument();
    expect(within(form()).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('lists the seasons in order with their episodes in order', async () => {
    signInWith(everything);
    const second: SeasonDetails = {
      id: '0195f0e0-0000-7000-8000-0000000005a2',
      number: 2,
      title: null,
      translations: {},
      episodes: [],
    };
    answerSeries({ ...ruzgar, seasons: [second, first] });
    renderApp(`/series/${ruzgar.id}`);

    await screen.findByRole('region', { name: 'Sezonlar ve bölümler' });
    expect(
      within(seasons())
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(['1. Sezon: Başlangıç', '2. Sezon']);
    const rows = within(season('1. Sezon: Başlangıç')).getAllByRole('row').slice(1);
    expect(
      rows.map((row) =>
        within(row)
          .getAllByRole('cell')
          .slice(0, 5)
          .map((cell) => cell.textContent),
      ),
    ).toEqual([
      ['1', 'Bölüm 1', '45', 'Yayında', 'Video hazır'],
      ['2', 'Bölüm 2', '45', 'Taslak', 'Video hazır'],
    ]);
    expect(within(season('2. Sezon')).getByText('Bu sezonda bölüm yok.')).toBeInTheDocument();
    expect(
      within(seasons()).getByText('Dizi taslakta: yayınlanan bölümler dizi yayınlanınca görünür.'),
    ).toBeInTheDocument();
  });

  it('adds a season with the next number and moves the version on', async () => {
    signInWith(everything);
    const change = answerSeries();
    const added = record('post', `/series/${ruzgar.id}/seasons`, () => {
      change({
        seasons: [
          first,
          {
            id: '0195f0e0-0000-7000-8000-0000000005a2',
            number: 2,
            title: 'Fırtına',
            translations: { tr: 'Fırtına', en: 'Storm' },
            episodes: [],
          },
        ],
      });
      return HttpResponse.json({ id: '0195f0e0-0000-7000-8000-0000000005a2' }, { status: 201 });
    });
    const saves = record('put', `/series/${ruzgar.id}`);
    renderApp(`/series/${ruzgar.id}`);

    await userEvent.click(
      await within(await screen.findByRole('region', { name: 'Sezonlar ve bölümler' })).findByRole('button', {
        name: 'Sezon ekle',
      }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Sezon ekle' });
    expect(within(dialog).getByLabelText('Sezon numarası')).toHaveValue('2');
    await userEvent.type(within(dialog).getByLabelText('Sezon adı (Türkçe)'), ' Fırtına ');
    await userEvent.type(within(dialog).getByLabelText('Sezon adı (İngilizce)'), 'Storm');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Kaydet' }));

    expect(await within(seasons()).findByRole('heading', { name: '2. Sezon: Fırtına' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(added).toEqual([{ number: 2, translations: { tr: 'Fırtına', en: 'Storm' }, version: 10 }]);

    await userEvent.click(within(form()).getByRole('button', { name: 'Kaydet' }));
    await waitFor(() => {
      expect(saves).toHaveLength(1);
    });
    expect(saves[0]).toMatchObject({ version: 11 });
  });

  it('edits a season, leaving out an empty name, and shows a taken number on its field', async () => {
    signInWith(everything);
    answerSeries();
    let answer = () => problem(409, 'Series.SeasonNumberTaken');
    const sent = record('put', `/series/${ruzgar.id}/seasons/${first.id}`, () => answer());
    renderApp(`/series/${ruzgar.id}`);

    await userEvent.click(await screen.findByRole('button', { name: '1. Sezon: Başlangıç: düzenle' }));
    const dialog = screen.getByRole('dialog', { name: 'Sezonu düzenle' });
    expect(within(dialog).getByLabelText('Sezon numarası')).toHaveValue('1');
    expect(within(dialog).getByLabelText('Sezon adı (Türkçe)')).toHaveValue('Başlangıç');
    await userEvent.clear(within(dialog).getByLabelText('Sezon numarası'));
    await userEvent.type(within(dialog).getByLabelText('Sezon numarası'), '3');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Kaydet' }));

    expect(await within(dialog).findByText('Bu numarada bir sezon zaten var.')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Sezon numarası')).toHaveAttribute('aria-invalid', 'true');

    await userEvent.clear(within(dialog).getByLabelText('Sezon numarası'));
    await userEvent.type(within(dialog).getByLabelText('Sezon numarası'), '1001');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Kaydet' }));
    expect(await within(dialog).findByText('Sezon numarası 1 ile 1000 arasında olmalı.')).toBeInTheDocument();

    answer = () => new HttpResponse(null, { status: 204 });
    await userEvent.clear(within(dialog).getByLabelText('Sezon numarası'));
    await userEvent.type(within(dialog).getByLabelText('Sezon numarası'), '1000');
    await userEvent.clear(within(dialog).getByLabelText('Sezon adı (Türkçe)'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Kaydet' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(sent.at(-1)).toEqual({ number: 1000, translations: {}, version: 10 });
  });

  it('keeps a season with published episodes and deletes one without', async () => {
    signInWith(everything);
    const empty: SeasonDetails = {
      id: '0195f0e0-0000-7000-8000-0000000005a2',
      number: 2,
      title: null,
      translations: {},
      episodes: [episode(1)],
    };
    answerSeries({ ...ruzgar, seasons: [first, empty] });
    const removed = record('delete', `/series/${ruzgar.id}/seasons/${empty.id}`);
    renderApp(`/series/${ruzgar.id}`);

    const kept = await screen.findByRole('button', { name: '1. Sezon: Başlangıç: sil' });
    expect(kept).toBeDisabled();
    expect(kept).toHaveAccessibleDescription(
      'Yayındaki bölümü olan sezon silinemez; önce bölümleri yayından kaldır.',
    );

    await userEvent.click(screen.getByRole('button', { name: '2. Sezon: sil' }));
    const dialog = screen.getByRole('dialog', { name: '“2. Sezon” silinsin mi?' });
    expect(dialog).toHaveTextContent('Sezon, bölümleriyle birlikte kalıcı olarak silinir.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sil' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(removed).toEqual(['?version=10']);
  });

  it('shows a refused season deletion in the question', async () => {
    signInWith(everything);
    const empty: SeasonDetails = {
      id: '0195f0e0-0000-7000-8000-0000000005a2',
      number: 2,
      title: null,
      translations: {},
      episodes: [],
    };
    answerSeries({ ...ruzgar, seasons: [first, empty] });
    record('delete', `/series/${ruzgar.id}/seasons/${empty.id}`, () =>
      problem(409, 'Series.SeasonHasPublishedEpisodes'),
    );
    renderApp(`/series/${ruzgar.id}`);

    await userEvent.click(await screen.findByRole('button', { name: '2. Sezon: sil' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sil' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Yayındaki bölümü olan sezon silinemez; önce bölümleri yayından kaldır.',
    );
  });

  it('adds an episode with the next number and checks its fields', async () => {
    signInWith(everything);
    answerSeries({ ...ruzgar, seasons: [{ ...first, episodes: [episode(1), episode(4)] }] });
    const sent = record('post', `/series/${ruzgar.id}/seasons/${first.id}/episodes`, () =>
      HttpResponse.json({ id: '0195f0e0-0000-7000-8000-0000000e0003' }, { status: 201 }),
    );
    renderApp(`/series/${ruzgar.id}`);

    await userEvent.click(await screen.findByRole('button', { name: '1. Sezon: Başlangıç: bölüm ekle' }));
    const dialog = screen.getByRole('dialog', { name: 'Bölüm ekle' });
    expect(within(dialog).getByLabelText('Bölüm numarası')).toHaveValue('5');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Kaydet' }));
    expect(await within(dialog).findByText('Başlık zorunlu.')).toBeInTheDocument();
    expect(within(dialog).getByText('Süre 1 ile 1000 dakika arasında olmalı.')).toBeInTheDocument();

    const turkish = within(dialog).getByRole('group', { name: 'Türkçe' });
    await userEvent.type(within(turkish).getByLabelText('Başlık'), 'Yeni Bölüm');
    await userEvent.type(within(turkish).getByLabelText('Özet'), 'Olaylar.');
    await userEvent.type(within(dialog).getByLabelText('Süre (dakika)'), '50');
    await userEvent.clear(within(dialog).getByLabelText('Bölüm numarası'));
    await userEvent.type(within(dialog).getByLabelText('Bölüm numarası'), '10001');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Kaydet' }));
    expect(
      await within(dialog).findByText('Bölüm numarası 1 ile 10000 arasında olmalı.'),
    ).toBeInTheDocument();

    await userEvent.clear(within(dialog).getByLabelText('Bölüm numarası'));
    await userEvent.type(within(dialog).getByLabelText('Bölüm numarası'), '10000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Kaydet' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(sent).toEqual([
      {
        number: 10000,
        translations: { tr: { title: 'Yeni Bölüm', synopsis: 'Olaylar.' } },
        runtimeMinutes: 50,
        version: 10,
      },
    ]);
  });

  it('edits an episode and shows a taken number on its field', async () => {
    signInWith(everything);
    answerSeries();
    let answer = () => problem(409, 'Series.EpisodeNumberTaken');
    const sent = record('put', `/series/${ruzgar.id}/episodes/${episode(2).id}`, () => answer());
    renderApp(`/series/${ruzgar.id}`);

    await userEvent.click(await screen.findByRole('button', { name: '2. Bölüm 2: düzenle' }));
    const dialog = screen.getByRole('dialog', { name: 'Bölümü düzenle' });
    expect(within(dialog).getByLabelText('Bölüm numarası')).toHaveValue('2');
    expect(within(dialog).getByLabelText('Süre (dakika)')).toHaveValue('45');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Kaydet' }));
    expect(
      await within(dialog).findByText('Bu sezonda bu numarada bir bölüm zaten var.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Bölüm numarası')).toHaveAttribute('aria-invalid', 'true');

    answer = () => new HttpResponse(null, { status: 204 });
    const english = within(dialog).getByRole('group', { name: 'İngilizce' });
    await userEvent.type(within(english).getByLabelText('Başlık'), 'Episode 2');
    await userEvent.type(within(english).getByLabelText('Özet'), 'Things happen.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Kaydet' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(sent.at(-1)).toEqual({
      number: 2,
      translations: {
        tr: { title: 'Bölüm 2', synopsis: 'Özet.' },
        en: { title: 'Episode 2', synopsis: 'Things happen.' },
      },
      runtimeMinutes: 45,
      version: 10,
    });
  });

  it('publishes an episode with a video at the version and keeps one without closed', async () => {
    signInWith(everything);
    const change = answerSeries({
      ...ruzgar,
      seasons: [
        {
          ...first,
          episodes: [episode(1), episode(2, { videoStatus: 'Processing', hasPlayableVideo: false })],
        },
      ],
    });
    const published = record('post', `/series/${ruzgar.id}/episodes/${episode(1).id}/publish`, () => {
      change({
        seasons: [
          {
            ...first,
            episodes: [
              episode(1, { status: 'Published' }),
              episode(2, { videoStatus: 'Processing', hasPlayableVideo: false }),
            ],
          },
        ],
      });
      return new HttpResponse(null, { status: 204 });
    });
    const saves = record('put', `/series/${ruzgar.id}`);
    renderApp(`/series/${ruzgar.id}`);

    const blocked = await screen.findByRole('button', { name: '2. Bölüm 2: yayınla' });
    expect(blocked).toBeDisabled();
    expect(blocked).toHaveAccessibleDescription('Yayınlamak için oynatılabilir video gerekli.');
    expect(within(season('1. Sezon: Başlangıç')).getByText('Video işleniyor')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '1. Bölüm 1: yayınla' }));
    expect(await screen.findByRole('button', { name: '1. Bölüm 1: yayından kaldır' })).toBeEnabled();
    expect(published).toEqual(['?version=10']);
    expect(screen.getByRole('button', { name: '1. Bölüm 1: sil' })).toBeDisabled();

    await userEvent.click(within(form()).getByRole('button', { name: 'Kaydet' }));
    await waitFor(() => {
      expect(saves).toHaveLength(1);
    });
    expect(saves[0]).toMatchObject({ version: 11 });
  });

  it('keeps the last published episode of a published series and shows a refused change', async () => {
    signInWith(everything);
    answerSeries({ ...ruzgar, status: 'Published', publishedAt: '2026-11-10T09:00:00Z' });
    record('post', `/series/${ruzgar.id}/episodes/${episode(2).id}/publish`, () =>
      problem(409, 'Content.VideoRequired'),
    );
    renderApp(`/series/${ruzgar.id}`);

    const kept = await screen.findByRole('button', { name: '1. Bölüm 1: yayından kaldır' });
    expect(kept).toBeDisabled();
    expect(kept).toHaveAccessibleDescription(
      'Yayındaki dizinin son yayındaki bölümü yayından kaldırılamaz; önce diziyi yayından kaldır.',
    );
    expect(within(seasons()).queryByText(/Dizi taslakta/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '2. Bölüm 2: yayınla' }));
    expect(await within(season('1. Sezon: Başlangıç')).findByRole('alert')).toHaveTextContent(
      'Yayınlamak için oynatılabilir bir video gerekli.',
    );
  });

  it('unpublishes an episode while another stays published', async () => {
    signInWith(everything);
    answerSeries({
      ...ruzgar,
      status: 'Published',
      seasons: [
        { ...first, episodes: [episode(1, { status: 'Published' }), episode(2, { status: 'Published' })] },
      ],
    });
    const sent = record('post', `/series/${ruzgar.id}/episodes/${episode(2).id}/unpublish`);
    renderApp(`/series/${ruzgar.id}`);

    await userEvent.click(await screen.findByRole('button', { name: '2. Bölüm 2: yayından kaldır' }));
    await waitFor(() => {
      expect(sent).toEqual(['?version=10']);
    });
  });

  it('deletes an episode after asking and shows a conflict from it', async () => {
    signInWith(everything);
    const change = answerSeries();
    let answer = () => problem(409, 'Content.VersionConflict');
    const removed = record('delete', `/series/${ruzgar.id}/episodes/${episode(2).id}`, () => answer());
    renderApp(`/series/${ruzgar.id}`);

    await userEvent.click(await screen.findByRole('button', { name: '2. Bölüm 2: sil' }));
    let dialog = screen.getByRole('dialog', { name: '“2. Bölüm 2” silinsin mi?' });
    expect(dialog).toHaveTextContent('Bu bölüm kalıcı olarak silinir.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sil' }));
    expect(await screen.findByText(/Sen düzenlerken bu kaydı başka biri değiştirdi/)).toBeInTheDocument();
    expect(within(dialog).getByRole('alert')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Vazgeç' }));

    answer = () => {
      change({ seasons: [{ ...first, episodes: [episode(1, { status: 'Published' })] }] });
      return new HttpResponse(null, { status: 204 });
    };
    await userEvent.click(screen.getByRole('button', { name: '2. Bölüm 2: sil' }));
    dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sil' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '2. Bölüm 2: sil' })).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(removed).toEqual(['?version=10', '?version=10']);
  });

  it('only shows the seasons without the write permission, and episode publishing needs its own', async () => {
    signInWith(['catalog:series:read', 'catalog:series:publish']);
    answerSeries();
    renderApp(`/series/${ruzgar.id}`);

    await screen.findByRole('region', { name: 'Sezonlar ve bölümler' });
    expect(screen.queryByRole('button', { name: 'Sezon ekle' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /bölüm ekle|düzenle|: sil/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2. Bölüm 2: yayınla' })).toBeEnabled();
    expect(within(season('1. Sezon: Başlangıç')).getAllByRole('columnheader')).toHaveLength(6);
    expect(screen.queryByText(/Yayındaki bölümü olan sezon silinemez/)).not.toBeInTheDocument();
  });

  it('shows no episode actions without write or publish', async () => {
    signInWith(['catalog:series:read']);
    answerSeries();
    renderApp(`/series/${ruzgar.id}`);

    const block = await screen.findByRole('region', { name: '1. Sezon: Başlangıç' });
    expect(within(block).queryByRole('button')).not.toBeInTheDocument();
    expect(within(block).getAllByRole('columnheader')).toHaveLength(5);
  });

  it('needs a published episode to publish', async () => {
    signInWith(everything);
    answerSeries({ ...ruzgar, seasons: [{ ...first, episodes: [episode(1)] }] });
    renderApp(`/series/${ruzgar.id}`);

    const publication = await screen.findByRole('region', { name: 'Yayın' });
    expect(
      within(publication)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['✓ En az bir tür: tamam', '✓ Afiş: tamam', '✗ En az bir yayındaki bölüm: eksik']);
    expect(within(publication).getByRole('button', { name: 'Yayınla' })).toBeDisabled();
  });

  it('names the series in what a published one keeps and asks', async () => {
    signInWith(everything);
    answerSeries({ ...ruzgar, status: 'Published', publishedAt: '2026-11-10T09:00:00Z' });
    renderApp(`/series/${ruzgar.id}`);

    const images = await screen.findByRole('region', { name: 'Görseller' });
    expect(
      within(images).getByText('Yayındaki dizinin afişi kaldırılamaz; önce yayından kaldır.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rüzgarın Kızı: sil' })).toHaveAccessibleDescription(
      'Yayındaki dizi silinemez; önce yayından kaldır.',
    );
    await userEvent.click(
      within(screen.getByRole('region', { name: 'Yayın' })).getByRole('button', { name: 'Yayından kaldır' }),
    );
    expect(
      screen.getByRole('dialog', { name: '“Rüzgarın Kızı” yayından kaldırılsın mı?' }),
    ).toHaveTextContent('Müşteriler bu diziyi artık göremez ve izleyemez.');
  });

  it('deletes a draft series and goes back to the list', async () => {
    signInWith(everything);
    answerSeries();
    const removed = record('delete', `/series/${ruzgar.id}`);
    const { router } = renderApp(`/series/${ruzgar.id}`);

    await userEvent.click(await screen.findByRole('button', { name: 'Rüzgarın Kızı: sil' }));
    const dialog = screen.getByRole('dialog', { name: '“Rüzgarın Kızı” silinsin mi?' });
    expect(dialog).toHaveTextContent('Bu dizi sezonları ve bölümleriyle kalıcı olarak silinir.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sil' }));

    await screen.findByRole('heading', { level: 1, name: 'Diziler' });
    expect(locationOf(router)).toBe('/series');
    expect(removed).toHaveLength(1);
  });

  it('says when the series cannot be found', async () => {
    signInWith(everything);
    server.use(http.get(`${catalogUrl}/series/${ruzgar.id}`, () => problem(404, 'Series.NotFound')));
    renderApp(`/series/${ruzgar.id}`);

    expect(await screen.findByRole('alert')).toHaveTextContent('Bu dizi artık yok.');
  });
});
