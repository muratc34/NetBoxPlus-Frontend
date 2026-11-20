import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { MovieDetails } from '../data/movies';
import { catalogUrl, locationOf, problem, renderApp, server, signInWith } from '../test/render';

const everything = [
  'catalog:movies:read',
  'catalog:movies:write',
  'catalog:movies:publish',
  'catalog:movies:delete',
  'catalog:images:upload',
];

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
const kerem = { id: '0195f0e0-0000-7000-8000-0000000000a1', name: 'Kerem Yalçın' };
const defne = { id: '0195f0e0-0000-7000-8000-0000000000a2', name: 'Defne Aksoy' };
const can = { id: '0195f0e0-0000-7000-8000-0000000000a3', name: 'Can Erdem' };

const kuzey: MovieDetails = {
  id: '0195f0e0-0000-7000-8000-00000000c001',
  title: 'Kuzey Işığı',
  originalTitle: null,
  translations: { tr: { title: 'Kuzey Işığı', synopsis: 'Fenerde bir gece.' } },
  releaseYear: 2023,
  ageRating: 'Age13',
  runtimeMinutes: 108,
  status: 'Draft',
  publishedAt: null,
  version: 4,
  posterUrl: null,
  backdropUrl: null,
  genres: [{ id: drama.id, name: 'Dram' }],
  credits: [
    { personId: defne.id, personName: defne.name, role: 'Actor', characterName: 'Nehir', order: 1 },
    { personId: kerem.id, personName: kerem.name, role: 'Director', characterName: null, order: 0 },
  ],
  createdAt: '2026-11-01T10:00:00Z',
  modifiedAt: null,
  videoStatus: 'Ready',
  hasPlayableVideo: true,
};

const ticket = {
  uploadId: '0195f0e0-0000-7000-8000-00000000f001',
  uploadAddress: 'https://storage.test/images/upload-1?sig=x',
  expiresAt: '2026-11-20T12:00:00Z',
  maxBytes: 1000,
};

/** Catalog's copy of the movie; a change the test makes is seen on the next read. */
function answerMovie(movie: MovieDetails = kuzey) {
  let current = movie;
  server.use(
    http.get(`${catalogUrl}/movies/${movie.id}`, () => HttpResponse.json(current)),
    http.get(`${catalogUrl}/movies`, () =>
      HttpResponse.json({ items: [], pageNumber: 1, pageSize: 20, totalCount: 0 }),
    ),
    http.get(`${catalogUrl}/genres`, () => HttpResponse.json([drama, comedy])),
    http.get(`${catalogUrl}/people`, ({ request }) => {
      const search = new URL(request.url).searchParams.get('search') ?? '';
      const items = [kerem, defne, can]
        .filter((person) => person.name.toLowerCase().includes(search.toLowerCase()))
        .map((person) => ({ ...person, biography: null, translations: {}, photoUrl: null }));
      return HttpResponse.json({ items, pageNumber: 1, pageSize: 20, totalCount: items.length });
    }),
  );
  return (next: Partial<MovieDetails>) => {
    current = { ...current, ...next };
  };
}

/** Answers saving and keeps each body sent. */
function recordSaves(answer: () => Response = () => new HttpResponse(null, { status: 204 })) {
  const bodies: unknown[] = [];
  server.use(
    http.put(`${catalogUrl}/movies/${kuzey.id}`, async ({ request }) => {
      bodies.push(await request.json());
      return answer();
    }),
  );
  return bodies;
}

const form = () => screen.getByRole('form', { name: 'Film bilgileri' });
const save = () => userEvent.click(within(form()).getByRole('button', { name: 'Kaydet' }));
const section = (name: string) => screen.getByRole('region', { name });

function image(type = 'image/png', size = 10) {
  return new File(['x'.repeat(size)], 'image.png', { type });
}

describe('MoviePage', () => {
  it('shows the movie and saves it with the version it loaded', async () => {
    signInWith(everything);
    const change = answerMovie();
    const bodies = recordSaves(() => {
      change({ title: 'Kuzey Işığı (kayıtlı)' });
      return new HttpResponse(null, { status: 204 });
    });
    renderApp(`/movies/${kuzey.id}`);

    await screen.findByRole('heading', { level: 1, name: 'Kuzey Işığı' });
    expect(document.title).toBe('Kuzey Işığı');
    const turkish = screen.getByRole('group', { name: 'Türkçe' });
    expect(turkish).toHaveAttribute('lang', 'tr');
    expect(within(turkish).getByLabelText('Başlık')).toHaveValue('Kuzey Işığı');
    expect(within(turkish).getByLabelText('Özet')).toHaveValue('Fenerde bir gece.');
    const english = screen.getByRole('group', { name: 'İngilizce' });
    expect(english).toHaveAttribute('lang', 'en');
    expect(within(english).getByLabelText('Başlık')).toHaveValue('');
    expect(screen.getByLabelText('Yapım yılı')).toHaveValue('2023');
    expect(screen.getByLabelText('Yaş sınırı')).toHaveValue('Age13');
    expect(screen.getByLabelText('Süre (dakika)')).toHaveValue('108');
    expect(await screen.findByRole('checkbox', { name: 'Dram' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Komedi' })).not.toBeChecked();
    // In their order, the character only for the actor.
    const credits = within(section('Ekip')).getAllByRole('listitem');
    expect(credits.map((row) => row.querySelector('span')?.textContent)).toEqual([
      'Kerem Yalçın',
      'Defne Aksoy',
    ]);
    expect(screen.queryByLabelText('Kerem Yalçın: karakter')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Defne Aksoy: karakter')).toHaveValue('Nehir');

    await userEvent.type(within(english).getByLabelText('Başlık'), 'Northern Light');
    await userEvent.type(within(english).getByLabelText('Özet'), 'One night.');
    await userEvent.type(screen.getByLabelText('Orijinal başlık'), ' Kuzey ');
    await userEvent.selectOptions(screen.getByLabelText('Yaş sınırı'), '16+');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Komedi' }));
    await save();

    expect(await within(form()).findByRole('status')).toHaveTextContent('Kaydedildi.');
    // What Catalog holds now, read again.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Kuzey Işığı (kayıtlı)' }),
    ).toBeInTheDocument();
    expect(bodies).toEqual([
      {
        translations: {
          tr: { title: 'Kuzey Işığı', synopsis: 'Fenerde bir gece.' },
          en: { title: 'Northern Light', synopsis: 'One night.' },
        },
        originalTitle: 'Kuzey',
        releaseYear: 2023,
        ageRating: 'Age16',
        runtimeMinutes: 108,
        genreIds: [drama.id, comedy.id],
        credits: [
          { personId: kerem.id, role: 'Director', characterName: null, order: 0 },
          { personId: defne.id, role: 'Actor', characterName: 'Nehir', order: 1 },
        ],
        version: 4,
      },
    ]);

    // Its own save moved the movie on one version.
    await userEvent.clear(screen.getByLabelText('Orijinal başlık'));
    await save();
    await waitFor(() => {
      expect(bodies).toHaveLength(2);
    });
    expect(bodies[1]).toMatchObject({ originalTitle: null, version: 5 });
  });

  it('makes a movie, checking the fields first, and goes on to its page', async () => {
    signInWith(everything);
    answerMovie();
    let sent: unknown;
    server.use(
      http.post(`${catalogUrl}/movies`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ id: kuzey.id }, { status: 201 });
      }),
    );
    const { router } = renderApp('/movies/new');

    await screen.findByRole('heading', { level: 1, name: 'Yeni film' });
    expect(document.title).toBe('Yeni film');
    expect(screen.queryByRole('region', { name: 'Görseller' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Yayın' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Sil' })).not.toBeInTheDocument();
    await save();

    expect(await screen.findByText('Başlık zorunlu.')).toBeInTheDocument();
    expect(screen.getByText('Özet zorunlu.')).toBeInTheDocument();
    expect(screen.getByText('Yapım yılı 1888 ile 2100 arasında olmalı.')).toBeInTheDocument();
    expect(screen.getByText('Süre 1 ile 1000 dakika arasında olmalı.')).toBeInTheDocument();

    const turkish = screen.getByRole('group', { name: 'Türkçe' });
    const english = screen.getByRole('group', { name: 'İngilizce' });
    await userEvent.type(within(turkish).getByLabelText('Başlık'), 'Kuzey Işığı');
    await userEvent.type(within(turkish).getByLabelText('Özet'), 'Fenerde bir gece.');
    await userEvent.type(within(english).getByLabelText('Özet'), 'Only a synopsis.');
    await userEvent.type(screen.getByLabelText('Yapım yılı'), '1887');
    await userEvent.type(screen.getByLabelText('Süre (dakika)'), '1001');
    await save();
    expect(
      await within(english).findByText('İngilizce için başlık ve özet birlikte gerekli.'),
    ).toBeInTheDocument();
    expect(within(english).getByLabelText('Başlık')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Yapım yılı 1888 ile 2100 arasında olmalı.')).toBeInTheDocument();
    expect(screen.getByText('Süre 1 ile 1000 dakika arasında olmalı.')).toBeInTheDocument();

    await userEvent.clear(within(english).getByLabelText('Özet'));
    await userEvent.type(within(english).getByLabelText('Başlık'), 'Only a title');
    await save();
    expect(
      await within(english).findByText('İngilizce için başlık ve özet birlikte gerekli.'),
    ).toBeInTheDocument();
    expect(within(english).getByLabelText('Özet')).toHaveAttribute('aria-invalid', 'true');

    await userEvent.clear(within(english).getByLabelText('Başlık'));
    await userEvent.clear(screen.getByLabelText('Yapım yılı'));
    await userEvent.type(screen.getByLabelText('Yapım yılı'), '2100');
    await userEvent.clear(screen.getByLabelText('Süre (dakika)'));
    await userEvent.type(screen.getByLabelText('Süre (dakika)'), '1');
    await save();

    await screen.findByRole('heading', { level: 1, name: 'Kuzey Işığı' });
    expect(locationOf(router)).toBe(`/movies/${kuzey.id}`);
    expect(sent).toEqual({
      translations: { tr: { title: 'Kuzey Işığı', synopsis: 'Fenerde bir gece.' } },
      originalTitle: null,
      releaseYear: 2100,
      ageRating: 'All',
      runtimeMinutes: 1,
      genreIds: [],
      credits: [],
      version: 0,
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('takes the lowest year and longest runtime, and refuses what is not a whole number', async () => {
    signInWith(everything);
    answerMovie();
    const bodies = recordSaves();
    renderApp(`/movies/${kuzey.id}`);

    const year = await screen.findByLabelText('Yapım yılı');
    await userEvent.clear(year);
    await userEvent.type(year, '2020.5');
    await save();
    expect(await screen.findByText('Yapım yılı 1888 ile 2100 arasında olmalı.')).toBeInTheDocument();

    await userEvent.clear(year);
    await userEvent.type(year, '1888');
    await userEvent.clear(screen.getByLabelText('Süre (dakika)'));
    await userEvent.type(screen.getByLabelText('Süre (dakika)'), '1000');
    await save();
    await waitFor(() => {
      expect(bodies).toHaveLength(1);
    });
    expect(bodies[0]).toMatchObject({ releaseYear: 1888, runtimeMinutes: 1000 });
  });

  it('puts Catalog’s refusals on their fields', async () => {
    signInWith(everything);
    answerMovie();
    let answer = () =>
      problem(400, 'Validation.Failed', {
        errorCodes: {
          'translations.tr.title': ['Content.TitleTooLong'],
          ReleaseYear: ['Content.ReleaseYearOutOfRange'],
        },
      });
    recordSaves(() => answer());
    renderApp(`/movies/${kuzey.id}`);

    await screen.findByLabelText('Yapım yılı');
    await save();
    const turkish = screen.getByRole('group', { name: 'Türkçe' });
    expect(await within(turkish).findByText('Başlık en fazla 200 karakter olabilir.')).toBeInTheDocument();
    expect(screen.getByLabelText('Yapım yılı')).toHaveAttribute('aria-invalid', 'true');

    answer = () => problem(409, 'Content.GenreRequired');
    await save();
    expect(await screen.findByText('Yayındaki içeriğin en az bir türü olmalı.')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Türler' })).toHaveAccessibleDescription(
      'Yayındaki içeriğin en az bir türü olmalı.',
    );

    answer = () => problem(400, 'Content.CreditDuplicate');
    await save();
    expect(await within(form()).findByRole('alert')).toHaveTextContent(
      'Aynı kişi aynı rolde iki kez yer alamaz.',
    );
  });

  it('keeps the changes when someone else saved first and loads the current version on asking', async () => {
    signInWith(everything);
    const change = answerMovie();
    const bodies = recordSaves(() => problem(409, 'Content.VersionConflict'));
    renderApp(`/movies/${kuzey.id}`);

    const runtime = await screen.findByLabelText('Süre (dakika)');
    await userEvent.clear(runtime);
    await userEvent.type(runtime, '110');
    await save();

    const alert = await screen.findByText(
      'Sen düzenlerken bu kaydı başka biri değiştirdi; değişikliklerin kaydedilmedi.',
    );
    expect(screen.getByLabelText('Süre (dakika)')).toHaveValue('110');
    expect(within(form()).queryByRole('alert')).not.toBeInTheDocument();

    change({ runtimeMinutes: 120, version: 6, title: 'Kuzey Işığı (yeni)' });
    await userEvent.click(
      within(alert.parentElement ?? document.body).getByRole('button', { name: 'Güncel hâli yükle' }),
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Süre (dakika)')).toHaveValue('120');
    });
    expect(screen.queryByText(/başka biri değiştirdi/)).not.toBeInTheDocument();
    server.use(
      http.put(`${catalogUrl}/movies/${kuzey.id}`, async ({ request }) => {
        bodies.push(await request.json());
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await save();
    await waitFor(() => {
      expect(bodies).toHaveLength(2);
    });
    expect(bodies[1]).toMatchObject({ runtimeMinutes: 120, version: 6 });
  });

  it('adds people from a search, in a role, and refuses one already in it', async () => {
    signInWith(everything);
    answerMovie();
    const bodies = recordSaves();
    renderApp(`/movies/${kuzey.id}`);

    await userEvent.click(
      await within(await screen.findByRole('region', { name: 'Ekip' })).findByRole('button', {
        name: 'Kişi ekle',
      }),
    );
    let picker = screen.getByRole('dialog', { name: 'Kişi ekle' });
    expect(within(picker).getByLabelText('Rol')).toHaveValue('Actor');
    expect(
      within(picker)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Yönetmen', 'Senarist', 'Oyuncu']);
    await userEvent.type(within(picker).getByLabelText('Ada göre ara'), 'Defne');
    await waitFor(() => {
      expect(within(picker).getAllByRole('button', { name: /Aksoy|Yalçın|Erdem/ })).toHaveLength(1);
    });
    await userEvent.click(within(picker).getByRole('button', { name: 'Defne Aksoy' }));
    expect(within(picker).getByRole('alert')).toHaveTextContent('Bu kişi bu rolde zaten var.');

    await userEvent.selectOptions(within(picker).getByLabelText('Rol'), 'Senarist');
    expect(within(picker).queryByRole('alert')).not.toBeInTheDocument();
    await userEvent.click(within(picker).getByRole('button', { name: 'Defne Aksoy' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await userEvent.click(within(section('Ekip')).getByRole('button', { name: 'Kişi ekle' }));
    picker = screen.getByRole('dialog', { name: 'Kişi ekle' });
    await userEvent.type(within(picker).getByLabelText('Ada göre ara'), 'nobody');
    expect(await within(picker).findByText('Bu adla kimse yok.')).toBeInTheDocument();
    await userEvent.clear(within(picker).getByLabelText('Ada göre ara'));
    await userEvent.type(within(picker).getByLabelText('Ada göre ara'), ' Can ');
    await userEvent.click(await within(picker).findByRole('button', { name: 'Can Erdem' }));
    await userEvent.type(screen.getByLabelText('Can Erdem: karakter'), ' Bekçi ');

    await save();
    await waitFor(() => {
      expect(bodies).toHaveLength(1);
    });
    expect(bodies[0]).toMatchObject({
      credits: [
        { personId: kerem.id, role: 'Director', characterName: null, order: 0 },
        { personId: defne.id, role: 'Actor', characterName: 'Nehir', order: 1 },
        { personId: defne.id, role: 'Writer', characterName: null, order: 2 },
        { personId: can.id, role: 'Actor', characterName: 'Bekçi', order: 3 },
      ],
    });
  });

  it('reorders, changes and removes the credits', async () => {
    signInWith(everything);
    answerMovie();
    const bodies = recordSaves();
    renderApp(`/movies/${kuzey.id}`);

    const up = await screen.findByRole('button', { name: 'Kerem Yalçın: yukarı taşı' });
    expect(up).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Defne Aksoy: aşağı taşı' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Kerem Yalçın: aşağı taşı' }));
    expect(
      within(section('Ekip'))
        .getAllByRole('listitem')
        .map((row) => row.querySelector('span')?.textContent),
    ).toEqual(['Defne Aksoy', 'Kerem Yalçın']);
    await userEvent.click(screen.getByRole('button', { name: 'Kerem Yalçın: yukarı taşı' }));
    expect(
      within(section('Ekip'))
        .getAllByRole('listitem')
        .map((row) => row.querySelector('span')?.textContent),
    ).toEqual(['Kerem Yalçın', 'Defne Aksoy']);
    await userEvent.click(screen.getByRole('button', { name: 'Kerem Yalçın: aşağı taşı' }));

    // An actor who becomes the writer leaves the character behind.
    await userEvent.selectOptions(screen.getByLabelText('Defne Aksoy: rol'), 'Senarist');
    expect(screen.queryByLabelText('Defne Aksoy: karakter')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Kerem Yalçın: çıkar' }));
    await save();

    await waitFor(() => {
      expect(bodies).toHaveLength(1);
    });
    expect(bodies[0]).toMatchObject({
      credits: [{ personId: defne.id, role: 'Writer', characterName: null, order: 0 }],
    });

    for (const button of within(section('Ekip')).getAllByRole('button', { name: /çıkar/ })) {
      await userEvent.click(button);
    }
    expect(within(section('Ekip')).getByText('Henüz kimse eklenmedi.')).toBeInTheDocument();
  });

  it('keeps a role the movie does not offer choosable', async () => {
    signInWith(everything);
    answerMovie({
      ...kuzey,
      credits: [
        { personId: kerem.id, personName: kerem.name, role: 'Creator', characterName: null, order: 0 },
      ],
    });
    renderApp(`/movies/${kuzey.id}`);

    const role = await screen.findByLabelText('Kerem Yalçın: rol');
    expect(role).toHaveValue('Creator');
    expect(
      within(role)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Yönetmen', 'Senarist', 'Oyuncu', 'Yaratıcı']);
  });

  it('names the genres in the panel language', async () => {
    signInWith(everything);
    answerMovie();
    window.localStorage.setItem('nbp-admin-lang', 'en');
    renderApp(`/movies/${kuzey.id}`);

    expect(await screen.findByRole('checkbox', { name: 'Drama' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Komedi' })).not.toBeChecked();
  });

  it('only shows the movie without the write permission', async () => {
    signInWith(['catalog:movies:read', 'catalog:images:upload']);
    answerMovie({ ...kuzey, posterUrl: 'https://images.test/poster.jpg' });
    renderApp(`/movies/${kuzey.id}`);

    await screen.findByRole('heading', { level: 1, name: 'Kuzey Işığı' });
    expect(within(screen.getByRole('group', { name: 'Türkçe' })).getByLabelText('Başlık')).toBeDisabled();
    expect(await screen.findByRole('checkbox', { name: 'Dram' })).toBeDisabled();
    expect(screen.getByLabelText('Defne Aksoy: karakter')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Kaydet' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Kişi ekle' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /yukarı taşı|çıkar/ })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Kuzey Işığı: Afiş' })).toHaveAttribute(
      'src',
      'https://images.test/poster.jpg',
    );
    expect(screen.queryByLabelText('Afişi değiştir')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Yayınla' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Sil' })).not.toBeInTheDocument();
    expect(section('Yayın')).toBeInTheDocument();
  });

  it('uploads images with the version and moves on from it', async () => {
    signInWith(everything);
    const change = answerMovie();
    const bodies = recordSaves();
    const attached: unknown[] = [];
    let removed: string | null = null;
    server.use(
      http.post(`${catalogUrl}/images/uploads`, () => HttpResponse.json(ticket)),
      http.put(`${catalogUrl}/movies/${kuzey.id}/images/poster`, async ({ request }) => {
        attached.push(await request.json());
        change({
          posterUrl: 'https://images.test/poster.jpg',
          backdropUrl: 'https://images.test/backdrop.jpg',
          version: 5,
        });
        return new HttpResponse(null, { status: 204 });
      }),
      http.delete(`${catalogUrl}/movies/${kuzey.id}/images/backdrop`, ({ request }) => {
        removed = new URL(request.url).search;
        change({ backdropUrl: null, version: 6 });
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp(`/movies/${kuzey.id}`, { upload: () => Promise.resolve() });

    const images = await screen.findByRole('region', { name: 'Görseller' });
    expect(within(images).getByText('Afiş yok.')).toBeInTheDocument();
    expect(within(images).getByText('Arka plan görseli yok.')).toBeInTheDocument();
    expect(within(images).getByLabelText('Afiş yükle')).toHaveAccessibleDescription(
      'JPEG, PNG ya da WebP; 2:3 oranında, en az 300×450 piksel, en fazla 10 MB.',
    );
    expect(within(images).getByLabelText('Arka plan yükle')).toHaveAccessibleDescription(
      'JPEG, PNG ya da WebP; 16:9 oranında, en az 1280×720 piksel, en fazla 10 MB.',
    );
    await userEvent.upload(within(images).getByLabelText('Afiş yükle'), image());

    expect(await within(images).findByRole('img', { name: 'Kuzey Işığı: Afiş' })).toHaveAttribute(
      'src',
      'https://images.test/poster.jpg',
    );
    expect(attached).toEqual([{ uploadId: ticket.uploadId, version: 4 }]);

    await userEvent.click(within(images).getByRole('button', { name: 'Arka planı kaldır' }));
    expect(await within(images).findByText('Arka plan görseli yok.')).toBeInTheDocument();
    expect(removed).toBe('?version=5');

    await save();
    await waitFor(() => {
      expect(bodies).toHaveLength(1);
    });
    expect(bodies[0]).toMatchObject({ version: 6 });
  });

  it('keeps a published movie’s poster and says why', async () => {
    signInWith(everything);
    answerMovie({
      ...kuzey,
      status: 'Published',
      posterUrl: 'https://images.test/poster.jpg',
      backdropUrl: 'https://images.test/backdrop.jpg',
    });
    renderApp(`/movies/${kuzey.id}`);

    const images = await screen.findByRole('region', { name: 'Görseller' });
    expect(within(images).queryByRole('button', { name: 'Afişi kaldır' })).not.toBeInTheDocument();
    expect(
      within(images).getByText('Yayındaki filmin afişi kaldırılamaz; önce yayından kaldır.'),
    ).toBeInTheDocument();
    expect(within(images).getByRole('button', { name: 'Arka planı kaldır' })).toBeInTheDocument();
  });

  it('shows a conflict from an image change and the image’s own refusal', async () => {
    signInWith(everything);
    answerMovie();
    server.use(
      http.post(`${catalogUrl}/images/uploads`, () => HttpResponse.json(ticket)),
      http.put(`${catalogUrl}/movies/${kuzey.id}/images/backdrop`, () =>
        problem(400, 'Image.WrongAspectRatio'),
      ),
      http.put(`${catalogUrl}/movies/${kuzey.id}/images/poster`, () =>
        problem(409, 'Content.VersionConflict'),
      ),
    );
    renderApp(`/movies/${kuzey.id}`, { upload: () => Promise.resolve() });

    const images = await screen.findByRole('region', { name: 'Görseller' });
    await userEvent.upload(within(images).getByLabelText('Arka plan yükle'), image());
    expect(await within(images).findByRole('alert')).toHaveTextContent(
      'Görselin en-boy oranı bu kullanım için uygun değil.',
    );
    expect(screen.queryByText(/başka biri değiştirdi/)).not.toBeInTheDocument();

    await userEvent.upload(within(images).getByLabelText('Afiş yükle'), image());
    expect(await screen.findByText(/Sen düzenlerken bu kaydı başka biri değiştirdi/)).toBeInTheDocument();
  });

  it('lists what publishing still needs and keeps it closed until then', async () => {
    signInWith(everything);
    answerMovie({ ...kuzey, genres: [], videoStatus: 'Processing', hasPlayableVideo: false });
    renderApp(`/movies/${kuzey.id}`);

    const publication = await screen.findByRole('region', { name: 'Yayın' });
    expect(within(publication).getByText('Taslak')).toBeInTheDocument();
    expect(
      within(publication)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['✗ En az bir tür: eksik', '✗ Afiş: eksik', '✗ Oynatılabilir video (Video işleniyor): eksik']);
    const publish = within(publication).getByRole('button', { name: 'Yayınla' });
    expect(publish).toBeDisabled();
    expect(publish).toHaveAccessibleDescription('Eksikler tamamlanınca yayınlanabilir.');
  });

  it('publishes what is saved and moves on from the version when nothing else came in between', async () => {
    signInWith(everything);
    const change = answerMovie({ ...kuzey, posterUrl: 'https://images.test/poster.jpg' });
    const bodies = recordSaves();
    let published = 0;
    server.use(
      http.post(`${catalogUrl}/movies/${kuzey.id}/publish`, () => {
        published += 1;
        change({ status: 'Published', publishedAt: '2026-11-20T09:00:00Z', version: 5 });
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp(`/movies/${kuzey.id}`);

    const publication = await screen.findByRole('region', { name: 'Yayın' });
    expect(
      within(publication)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['✓ En az bir tür: tamam', '✓ Afiş: tamam', '✓ Oynatılabilir video (Video hazır): tamam']);

    // Changes not saved keep it closed: publishing publishes what is stored.
    await userEvent.type(screen.getByLabelText('Orijinal başlık'), 'X');
    const publish = within(publication).getByRole('button', { name: 'Yayınla' });
    expect(publish).toBeDisabled();
    expect(publish).toHaveAccessibleDescription(
      'Önce değişiklikleri kaydet: yayınlama kayıtlı hâli yayınlar.',
    );
    await userEvent.clear(screen.getByLabelText('Orijinal başlık'));
    expect(publish).toBeEnabled();

    await userEvent.click(publish);
    expect(await within(publication).findByText('Yayın tarihi: 20 Kas 2026')).toBeInTheDocument();
    expect(published).toBe(1);
    expect(screen.getAllByText('Yayında')).toHaveLength(2);
    expect(within(publication).queryByRole('list')).not.toBeInTheDocument();
    expect(within(publication).getByRole('button', { name: 'Yayından kaldır' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kuzey Işığı: sil' })).toBeDisabled();

    await save();
    await waitFor(() => {
      expect(bodies).toHaveLength(1);
    });
    expect(bodies[0]).toMatchObject({ version: 5 });
  });

  it('keeps its version when someone else also changed the movie while publishing', async () => {
    signInWith(everything);
    const change = answerMovie({ ...kuzey, posterUrl: 'https://images.test/poster.jpg' });
    const bodies = recordSaves();
    server.use(
      http.post(`${catalogUrl}/movies/${kuzey.id}/publish`, () => {
        change({ status: 'Published', publishedAt: '2026-11-20T09:00:00Z', version: 6 });
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp(`/movies/${kuzey.id}`);

    await userEvent.click(
      await within(await screen.findByRole('region', { name: 'Yayın' })).findByRole('button', {
        name: 'Yayınla',
      }),
    );
    await within(section('Yayın')).findByRole('button', { name: 'Yayından kaldır' });
    await save();

    await waitFor(() => {
      expect(bodies).toHaveLength(1);
    });
    expect(bodies[0]).toMatchObject({ version: 4 });
  });

  it('shows why publishing failed', async () => {
    signInWith(everything);
    answerMovie({ ...kuzey, posterUrl: 'https://images.test/poster.jpg' });
    server.use(
      http.post(`${catalogUrl}/movies/${kuzey.id}/publish`, () => problem(409, 'Content.VideoRequired')),
    );
    renderApp(`/movies/${kuzey.id}`);

    const publication = await screen.findByRole('region', { name: 'Yayın' });
    await userEvent.click(within(publication).getByRole('button', { name: 'Yayınla' }));

    expect(await within(publication).findByRole('alert')).toHaveTextContent(
      'Yayınlamak için oynatılabilir bir video gerekli.',
    );
  });

  it('unpublishes after asking', async () => {
    signInWith(everything);
    const change = answerMovie({
      ...kuzey,
      status: 'Published',
      publishedAt: '2026-11-15T09:00:00Z',
      posterUrl: 'https://images.test/poster.jpg',
      version: 7,
    });
    let unpublished = 0;
    server.use(
      http.post(`${catalogUrl}/movies/${kuzey.id}/unpublish`, () => {
        unpublished += 1;
        change({ status: 'Draft', publishedAt: null, version: 8 });
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp(`/movies/${kuzey.id}`);

    const publication = await screen.findByRole('region', { name: 'Yayın' });
    expect(within(publication).getByText('Yayın tarihi: 15 Kas 2026')).toBeInTheDocument();
    expect(within(publication).queryByRole('list')).not.toBeInTheDocument();
    await userEvent.click(within(publication).getByRole('button', { name: 'Yayından kaldır' }));
    const dialog = screen.getByRole('dialog', { name: '“Kuzey Işığı” yayından kaldırılsın mı?' });
    expect(dialog).toHaveTextContent('Müşteriler bu filmi artık göremez ve izleyemez.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Vazgeç' }));
    expect(unpublished).toBe(0);

    await userEvent.click(within(publication).getByRole('button', { name: 'Yayından kaldır' }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Yayından kaldır' }),
    );

    expect(await within(publication).findByRole('button', { name: 'Yayınla' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(unpublished).toBe(1);
    expect(screen.getByRole('button', { name: 'Kuzey Işığı: sil' })).toBeEnabled();
  });

  it('shows a refused unpublishing in the question', async () => {
    signInWith(everything);
    answerMovie({ ...kuzey, status: 'Published', posterUrl: 'https://images.test/poster.jpg' });
    server.use(http.post(`${catalogUrl}/movies/${kuzey.id}/unpublish`, () => problem(404, 'Movie.NotFound')));
    renderApp(`/movies/${kuzey.id}`);

    await userEvent.click(
      await within(await screen.findByRole('region', { name: 'Yayın' })).findByRole('button', {
        name: 'Yayından kaldır',
      }),
    );
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Yayından kaldır' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Bu film artık yok.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Vazgeç' }));
    expect(within(section('Yayın')).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('needs the publish permission to publish', async () => {
    signInWith(['catalog:movies:read', 'catalog:movies:write']);
    answerMovie({ ...kuzey, posterUrl: 'https://images.test/poster.jpg' });
    renderApp(`/movies/${kuzey.id}`);

    const publication = await screen.findByRole('region', { name: 'Yayın' });
    expect(within(publication).getAllByRole('listitem')).toHaveLength(3);
    expect(within(publication).queryByRole('button')).not.toBeInTheDocument();
  });

  it('deletes a draft after asking and goes back to the list', async () => {
    signInWith(everything);
    answerMovie();
    let deleted = false;
    server.use(
      http.delete(`${catalogUrl}/movies/${kuzey.id}`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { router, queryClient } = renderApp(`/movies/${kuzey.id}`);

    await userEvent.click(await screen.findByRole('button', { name: 'Kuzey Işığı: sil' }));
    const dialog = screen.getByRole('dialog', { name: '“Kuzey Işığı” silinsin mi?' });
    expect(dialog).toHaveTextContent('Bu film kalıcı olarak silinir.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sil' }));

    await screen.findByRole('heading', { level: 1, name: 'Filmler' });
    expect(deleted).toBe(true);
    expect(locationOf(router)).toBe('/movies');
    expect(queryClient.getQueryData(['admin', 'catalog', 'movie', kuzey.id])).toBeUndefined();
  });

  it('keeps a published movie from deletion and says why', async () => {
    signInWith(everything);
    answerMovie({ ...kuzey, status: 'Published', posterUrl: 'https://images.test/poster.jpg' });
    renderApp(`/movies/${kuzey.id}`);

    const button = await screen.findByRole('button', { name: 'Kuzey Işığı: sil' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription('Yayındaki film silinemez; önce yayından kaldır.');
  });

  it('keeps the question open with the reason when Catalog refuses the deletion', async () => {
    signInWith(everything);
    answerMovie();
    server.use(
      http.delete(`${catalogUrl}/movies/${kuzey.id}`, () => problem(409, 'Content.MustBeUnpublished')),
    );
    renderApp(`/movies/${kuzey.id}`);

    await userEvent.click(await screen.findByRole('button', { name: 'Kuzey Işığı: sil' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sil' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Önce yayından kaldır.');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Vazgeç' }));
    await userEvent.click(screen.getByRole('button', { name: 'Kuzey Işığı: sil' }));
    expect(within(screen.getByRole('dialog')).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says when the movie cannot be found', async () => {
    signInWith(everything);
    server.use(http.get(`${catalogUrl}/movies/${kuzey.id}`, () => problem(404, 'Movie.NotFound')));
    renderApp(`/movies/${kuzey.id}`);

    expect(await screen.findByRole('alert')).toHaveTextContent('Bu film artık yok.');
  });

  it('asks before leaving with changes not saved', async () => {
    signInWith(everything);
    answerMovie();
    const { router } = renderApp(`/movies/${kuzey.id}`);

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Komedi' }));
    await router.navigate('/movies');
    expect(
      await screen.findByRole('dialog', { name: 'Kaydedilmemiş değişiklikler var' }),
    ).toBeInTheDocument();
  });
});
