import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import type { BlockRequest } from '../data/blocks';
import type { MovieDetails } from '../data/movies';
import type { SeriesDetails } from '../data/series';
import type { VideoDetails } from '../data/videos';
import { catalogUrl, gatewayUrl, locationOf, problem, renderApp, server, signInWith } from '../test/render';

const streamingUrl = `${gatewayUrl}/admin/streaming`;
const watching = ['streaming:videos:read', 'streaming:videos:write'];

const movie: MovieDetails = {
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
  genres: [],
  credits: [],
  createdAt: '2026-11-01T10:00:00Z',
  modifiedAt: null,
  videoStatus: 'None',
  hasPlayableVideo: false,
};

function summary(index: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `0195f0e0-0000-7000-8000-0000000f${String(index).padStart(4, '0')}`,
    purpose: 'Feature',
    contentKind: 'Movie',
    contentId: movie.id,
    status: 'Ready',
    durationSeconds: 90 + index,
    createdAt: `2026-11-1${String(index)}T10:00:00Z`,
    ...overrides,
  };
}

function details(overrides: Partial<VideoDetails> = {}): VideoDetails {
  return {
    id: summary(1).id,
    purpose: 'Feature',
    contentKind: 'Movie',
    contentId: movie.id,
    status: 'Ready',
    sizeBytes: 3 * 1024 ** 3,
    durationSeconds: 125,
    renditions: [
      { height: 720, width: 1280, bandwidth: 3000000, playlist: '720.m3u8' },
      { height: 360, width: 640, bandwidth: 800000, playlist: '360.m3u8' },
    ],
    failureReason: null,
    uploadExpiresAt: '2026-11-11T12:00:00Z',
    createdAt: '2026-11-11T10:00:00Z',
    audioLayout: 'Separate',
    originalAudioLanguage: 'en-US',
    audioTracks: [],
    subtitles: [],
    ...overrides,
  };
}

/** The movie, its videos and the catalog reads the movie page makes. */
function answerMovie(videos: unknown[] = [summary(1), summary(2, { purpose: 'Trailer' })]) {
  server.use(
    http.get(`${catalogUrl}/movies/${movie.id}`, () => HttpResponse.json(movie)),
    http.get(`${catalogUrl}/movies`, () =>
      HttpResponse.json({ items: [], pageNumber: 1, pageSize: 20, totalCount: 0 }),
    ),
    http.get(`${catalogUrl}/genres`, () => HttpResponse.json([])),
    http.get(`${streamingUrl}/videos`, ({ request }) => {
      const url = new URL(request.url);
      if (url.searchParams.get('contentId') !== movie.id) {
        return problem(400, 'Unexpected');
      }
      return HttpResponse.json({ items: videos, pageNumber: 1, pageSize: 100, totalCount: videos.length });
    }),
  );
}

const ticket = {
  videoId: '0195f0e0-0000-7000-8000-0000000f0009',
  uploadAddress: 'https://storage.test/uploads/v9?sig=x',
  expiresAt: '2026-11-21T12:00:00Z',
  maxBytes: 1000,
};

function video(type = 'video/mp4', size = 10) {
  return new File(['x'.repeat(size)], 'clip.mp4', { type });
}

const videos = () => screen.getByRole('region', { name: 'Videolar' });

describe('ContentVideos', () => {
  it('lists a movie’s videos newest first, each linking to its page', async () => {
    signInWith(['catalog:movies:read', 'streaming:videos:read']);
    answerMovie();
    renderApp(`/movies/${movie.id}`);

    const section = await screen.findByRole('region', { name: 'Videolar' });
    const rows = await within(section).findAllByRole('row');
    expect(
      rows.slice(1).map((row) =>
        within(row)
          .getAllByRole('cell')
          .slice(0, 3)
          .map((cell) => cell.textContent),
      ),
    ).toEqual([
      ['Fragman', 'Hazır', '1 dk 32 sn'],
      ['Asıl video', 'Hazır', '1 dk 31 sn'],
    ]);
    const link = within(rows[1] ?? section).getByRole('link');
    expect(link).toHaveAttribute('href', `/videos/${summary(2).id}`);
    expect(link).toHaveAccessibleName(/^Fragman · .*: aç$/);
    expect(within(section).queryByRole('button', { name: 'Video yükle' })).not.toBeInTheDocument();
  });

  it('asks again while one of the videos is processed', async () => {
    signInWith(['catalog:movies:read', 'streaming:videos:read']);
    answerMovie();
    let asked = 0;
    server.use(
      http.get(`${streamingUrl}/videos`, () => {
        asked += 1;
        const items = [summary(1, { status: asked === 1 ? 'Queued' : 'Ready' })];
        return HttpResponse.json({ items, pageNumber: 1, pageSize: 100, totalCount: 1 });
      }),
    );
    renderApp(`/movies/${movie.id}`);

    const section = await screen.findByRole('region', { name: 'Videolar' });
    expect(await within(section).findByText('İşleniyor')).toBeInTheDocument();
    expect(await within(section).findByText('Hazır', {}, { timeout: 7000 })).toBeInTheDocument();
  }, 10000);

  it('is not there without the read permission', async () => {
    signInWith(['catalog:movies:read']);
    answerMovie();
    renderApp(`/movies/${movie.id}`);

    await screen.findByRole('heading', { level: 1, name: 'Kuzey Işığı' });
    expect(screen.queryByRole('region', { name: 'Videolar' })).not.toBeInTheDocument();
  });

  it('says when there are none and when they cannot be read', async () => {
    signInWith(['catalog:movies:read', ...watching]);
    answerMovie([]);
    const first = renderApp(`/movies/${movie.id}`);
    expect(
      await within(await screen.findByRole('region', { name: 'Videolar' })).findByText('Henüz video yok.'),
    ).toBeInTheDocument();
    first.unmount();

    server.use(http.get(`${streamingUrl}/videos`, () => problem(403, 'Auth.Forbidden')));
    renderApp(`/movies/${movie.id}`);
    expect(
      await within(await screen.findByRole('region', { name: 'Videolar' })).findByRole(
        'alert',
        {},
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
  });

  it('uploads a video in blocks with its language, confirms it and opens it', async () => {
    signInWith(['catalog:movies:read', ...watching]);
    answerMovie();
    let started: unknown;
    let confirmed = false;
    server.use(
      http.post(`${streamingUrl}/videos`, async ({ request }) => {
        started = await request.json();
        return HttpResponse.json(ticket, { status: 201 });
      }),
      http.post(`${streamingUrl}/videos/${ticket.videoId}/uploaded`, () => {
        confirmed = true;
        return new HttpResponse(null, { status: 204 });
      }),
      http.get(`${streamingUrl}/videos/${ticket.videoId}`, () =>
        HttpResponse.json(
          details({
            id: ticket.videoId,
            status: 'Queued',
            renditions: [],
            durationSeconds: null,
            sizeBytes: 10,
          }),
        ),
      ),
    );
    const sendBlock = vi.fn<BlockRequest>((_method, _address, body, _headers, onProgress) => {
      onProgress(typeof body === 'string' ? 0 : body.size);
      return Promise.resolve();
    });
    const { router } = renderApp(`/movies/${movie.id}`, { sendBlock });

    await userEvent.click(
      await within(await screen.findByRole('region', { name: 'Videolar' })).findByRole('button', {
        name: 'Video yükle',
      }),
    );
    const form = screen.getByRole('form', { name: 'Video yükle' });
    expect(within(form).getByLabelText('Dosya')).toHaveAccessibleDescription(
      'Video dosyası, en fazla 10 GB. Yükleme bitene kadar bu sayfada kal.',
    );
    expect(within(form).getByRole('button', { name: 'Yükle' })).toBeDisabled();
    expect(within(form).getByLabelText('Orijinal ses dili')).toHaveValue('tr-TR');
    expect(within(within(form).getByLabelText('Orijinal ses dili')).getAllByRole('option')).toHaveLength(6);
    await userEvent.selectOptions(within(form).getByLabelText('Orijinal ses dili'), 'en-US');
    const file = video();
    await userEvent.upload(within(form).getByLabelText('Dosya'), file);
    await userEvent.click(within(form).getByRole('button', { name: 'Yükle' }));

    await screen.findByRole('heading', { level: 1, name: 'Asıl video · Film' });
    expect(locationOf(router)).toBe(`/videos/${ticket.videoId}`);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(started).toEqual({
      contentKind: 'Movie',
      contentId: movie.id,
      purpose: 'Feature',
      originalAudioLanguage: 'en-US',
    });
    expect(sendBlock.mock.calls.map((call) => call[1])).toEqual([
      `${ticket.uploadAddress}&comp=block&blockid=${encodeURIComponent(btoa('block-000000'))}`,
      `${ticket.uploadAddress}&comp=blocklist`,
    ]);
    expect(confirmed).toBe(true);
  });

  it('uploads a trailer and says what a trailer takes', async () => {
    signInWith(['catalog:movies:read', ...watching]);
    answerMovie();
    let started: unknown;
    server.use(
      http.post(`${streamingUrl}/videos`, async ({ request }) => {
        started = await request.json();
        return problem(400, 'Video.PurposeInvalid');
      }),
    );
    renderApp(`/movies/${movie.id}`);

    await userEvent.click(
      await within(await screen.findByRole('region', { name: 'Videolar' })).findByRole('button', {
        name: 'Fragman yükle',
      }),
    );
    const form = screen.getByRole('form', { name: 'Fragman yükle' });
    expect(within(form).getByLabelText('Dosya')).toHaveAccessibleDescription(/Fragman en fazla 5 dakika/);
    await userEvent.upload(within(form).getByLabelText('Dosya'), video());
    await userEvent.click(within(form).getByRole('button', { name: 'Yükle' }));

    expect(await within(form).findByRole('alert')).toHaveTextContent('Diziye sadece fragman eklenebilir.');
    expect(started).toMatchObject({ purpose: 'Trailer', originalAudioLanguage: 'tr-TR' });
    await userEvent.click(within(form).getByRole('button', { name: 'Vazgeç' }));
    expect(screen.queryByRole('form', { name: 'Fragman yükle' })).not.toBeInTheDocument();
    expect(within(videos()).getByRole('button', { name: 'Video yükle' })).toBeInTheDocument();
  });

  it('refuses a file that is not a video, an empty one and one too large', async () => {
    signInWith(['catalog:movies:read', ...watching]);
    answerMovie();
    let tickets = 0;
    server.use(
      http.post(`${streamingUrl}/videos`, () => {
        tickets += 1;
        return HttpResponse.json(ticket, { status: 201 });
      }),
    );
    const sendBlock = vi.fn<BlockRequest>(() => Promise.resolve());
    renderApp(`/movies/${movie.id}`, { sendBlock });

    await userEvent.click(
      await within(await screen.findByRole('region', { name: 'Videolar' })).findByRole('button', {
        name: 'Video yükle',
      }),
    );
    const form = screen.getByRole('form', { name: 'Video yükle' });
    const input = within(form).getByLabelText('Dosya');

    await userEvent.upload(input, video('image/png'), { applyAccept: false });
    await userEvent.click(within(form).getByRole('button', { name: 'Yükle' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('Bu bir video dosyası değil.');

    await userEvent.upload(input, video('video/mp4', 0));
    expect(within(form).queryByRole('alert')).not.toBeInTheDocument();
    await userEvent.click(within(form).getByRole('button', { name: 'Yükle' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('Dosya boş.');
    expect(tickets).toBe(0);

    await userEvent.upload(input, video('video/mp4', 1001));
    await userEvent.click(within(form).getByRole('button', { name: 'Yükle' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('Dosya bu yükleme için çok büyük.');
    expect(tickets).toBe(1);
    expect(sendBlock).not.toHaveBeenCalled();
  });

  it('shows how far the upload is and asks before leaving while it runs', async () => {
    signInWith(['catalog:movies:read', ...watching]);
    answerMovie();
    server.use(http.post(`${streamingUrl}/videos`, () => HttpResponse.json(ticket, { status: 201 })));
    let finish: () => void = () => undefined;
    const sendBlock: BlockRequest = (_method, _address, body, _headers, onProgress) =>
      new Promise((resolve) => {
        if (typeof body !== 'string') {
          onProgress(body.size / 2);
        }
        finish = () => {
          resolve();
        };
      });
    const { router } = renderApp(`/movies/${movie.id}`, { sendBlock });

    await userEvent.click(
      await within(await screen.findByRole('region', { name: 'Videolar' })).findByRole('button', {
        name: 'Video yükle',
      }),
    );
    const form = screen.getByRole('form', { name: 'Video yükle' });
    await userEvent.upload(within(form).getByLabelText('Dosya'), video());
    await userEvent.click(within(form).getByRole('button', { name: 'Yükle' }));

    expect(await within(form).findByText('Yükleniyor: %50')).toBeInTheDocument();
    expect(within(form).getByRole('progressbar')).toHaveAttribute('value', '50');
    expect(within(form).getByLabelText('Dosya')).toBeDisabled();
    expect(within(form).getByRole('button', { name: 'Vazgeç' })).toBeDisabled();

    // Closing the tab asks too.
    const closing = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(closing);
    expect(closing.defaultPrevented).toBe(true);

    await router.navigate('/movies');
    const dialog = await screen.findByRole('dialog', { name: 'Yükleme sürüyor' });
    expect(dialog).toHaveTextContent('Ayrılırsan yükleme yarıda kalır.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Vazgeç' }));
    expect(locationOf(router)).toBe(`/movies/${movie.id}`);
    finish();
  });

  it('opens the videos of an episode from its row', async () => {
    const series: SeriesDetails = {
      id: '0195f0e0-0000-7000-8000-00000000c501',
      title: 'Rüzgarın Kızı',
      originalTitle: null,
      translations: { tr: { title: 'Rüzgarın Kızı', synopsis: 'Aile.' } },
      releaseYear: 2022,
      ageRating: 'Age13',
      status: 'Draft',
      publishedAt: null,
      version: 3,
      posterUrl: null,
      backdropUrl: null,
      genres: [],
      credits: [],
      seasons: [
        {
          id: '0195f0e0-0000-7000-8000-0000000005a1',
          number: 1,
          title: null,
          translations: {},
          episodes: [
            {
              id: '0195f0e0-0000-7000-8000-0000000e0001',
              number: 1,
              title: 'Eve Dönüş',
              translations: { tr: { title: 'Eve Dönüş', synopsis: 'Dönüş.' } },
              runtimeMinutes: 48,
              status: 'Draft',
              publishedAt: null,
              videoStatus: 'None',
              hasPlayableVideo: false,
            },
          ],
        },
      ],
      createdAt: '2026-11-01T10:00:00Z',
      modifiedAt: null,
    };
    signInWith(['catalog:series:read', ...watching]);
    const asked: string[] = [];
    server.use(
      http.get(`${catalogUrl}/series/${series.id}`, () => HttpResponse.json(series)),
      http.get(`${catalogUrl}/genres`, () => HttpResponse.json([])),
      http.get(`${streamingUrl}/videos`, ({ request }) => {
        asked.push(new URL(request.url).searchParams.get('contentId') ?? '');
        return HttpResponse.json({ items: [], pageNumber: 1, pageSize: 100, totalCount: 0 });
      }),
    );
    renderApp(`/series/${series.id}`);

    const trailers = await screen.findByRole('region', { name: 'Videolar' });
    expect(within(trailers).getByRole('button', { name: 'Fragman yükle' })).toBeInTheDocument();
    expect(within(trailers).queryByRole('button', { name: 'Video yükle' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '1. Eve Dönüş: videolar' }));
    const dialog = screen.getByRole('dialog', { name: '1. Eve Dönüş: videolar' });
    expect(await within(dialog).findByText('Henüz video yok.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Video yükle' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Fragman yükle' })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(asked).toContain('0195f0e0-0000-7000-8000-0000000e0001');
    });
    expect(asked).toContain(series.id);
  });
});

describe('VideoPage', () => {
  it('shows the video’s facts and links to its movie', async () => {
    signInWith(['streaming:videos:read', 'catalog:movies:read']);
    server.use(http.get(`${streamingUrl}/videos/${summary(1).id}`, () => HttpResponse.json(details())));
    const { router } = renderApp(`/videos/${summary(1).id}`);

    await screen.findByRole('heading', { level: 1, name: 'Asıl video · Film' });
    expect(document.title).toBe('Asıl video · Film');
    const facts = Object.fromEntries(
      screen.getAllByRole('term').map((term) => [term.textContent, term.nextElementSibling?.textContent]),
    );
    expect(facts).toMatchObject({
      İçerik: 'Film',
      Süre: '2 dk 5 sn',
      Boyut: '3 GB',
      Kaliteler: '360p, 720p',
    });
    expect(facts['Orijinal ses']).toMatch(/İngilizce/);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'İçeriğin sayfasına git' }));
    expect(locationOf(router)).toBe(`/movies/${movie.id}`);
  });

  it('says why it failed and how to go on, and shows sizes under a gigabyte in megabytes', async () => {
    signInWith(['streaming:videos:read']);
    server.use(
      http.get(`${streamingUrl}/videos/${summary(1).id}`, () =>
        HttpResponse.json(
          details({
            status: 'Failed',
            failureReason: 'The source has no video stream.',
            sizeBytes: 5 * 1024 ** 2,
            renditions: [],
            durationSeconds: null,
            contentKind: 'Episode',
          }),
        ),
      ),
    );
    renderApp(`/videos/${summary(1).id}`);

    expect(await screen.findByRole('alert')).toHaveTextContent('The source has no video stream.');
    expect(
      screen.getByText('Bu yükleme tamamlanmadı; içeriğin sayfasından yeni bir video yükle.'),
    ).toBeInTheDocument();
    const facts = Object.fromEntries(
      screen.getAllByRole('term').map((term) => [term.textContent, term.nextElementSibling?.textContent]),
    );
    expect(facts).toMatchObject({ Boyut: '5 MB', Süre: '—', Kaliteler: '—', İçerik: 'Bölüm' });
    expect(screen.queryByRole('link', { name: 'İçeriğin sayfasına git' })).not.toBeInTheDocument();
  });

  it('asks again while the video is processed, until it is ready', async () => {
    signInWith(['streaming:videos:read']);
    let asked = 0;
    server.use(
      http.get(`${streamingUrl}/videos/${summary(1).id}`, () => {
        asked += 1;
        return HttpResponse.json(details(asked === 1 ? { status: 'Queued', renditions: [] } : {}));
      }),
    );
    renderApp(`/videos/${summary(1).id}`);

    expect(await screen.findByRole('status')).toHaveTextContent('İşleniyor; sayfa kendiliğinden yenilenir.');
    expect(screen.getByText('İşleniyor', { selector: 'span' })).toBeInTheDocument();
    expect(await screen.findByText('Hazır', {}, { timeout: 7000 })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  }, 10000);

  it('links a series trailer to its series and says when the video is gone', async () => {
    signInWith(['streaming:videos:read']);
    server.use(
      http.get(`${streamingUrl}/videos/${summary(1).id}`, () =>
        HttpResponse.json(
          details({ purpose: 'Trailer', contentKind: 'Series', contentId: 'series-1', sizeBytes: 1024 ** 3 }),
        ),
      ),
    );
    const first = renderApp(`/videos/${summary(1).id}`);
    expect(await screen.findByRole('link', { name: 'İçeriğin sayfasına git' })).toHaveAttribute(
      'href',
      '/series/series-1',
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Fragman · Dizi');
    expect(screen.getByText('1 GB')).toBeInTheDocument();
    first.unmount();

    server.use(http.get(`${streamingUrl}/videos/${summary(1).id}`, () => problem(404, 'Video.NotFound')));
    renderApp(`/videos/${summary(1).id}`);
    expect(await screen.findByRole('alert')).toHaveTextContent('Bu video artık yok.');
  });
});

describe('VideosPage', () => {
  it('lists every video and filters by purpose and status in the address', async () => {
    signInWith(['streaming:videos:read']);
    const asked: string[] = [];
    server.use(
      http.get(`${streamingUrl}/videos`, ({ request }) => {
        asked.push(new URL(request.url).search);
        return HttpResponse.json({
          items: [
            summary(1, { status: 'Failed', contentKind: 'Episode', durationSeconds: null }),
            summary(2),
          ],
          pageNumber: 1,
          pageSize: 20,
          totalCount: 45,
        });
      }),
    );
    const { router } = renderApp('/videos?page=2');

    const table = await within(await screen.findByRole('main')).findByRole('table');
    expect(document.title).toBe('Videolar');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(
      rows.map((row) =>
        within(row)
          .getAllByRole('cell')
          .slice(1, 5)
          .map((cell) => cell.textContent),
      ),
    ).toEqual([
      ['Asıl video', 'Bölüm', 'Başarısız', '—'],
      ['Asıl video', 'Film', 'Hazır', '1 dk 32 sn'],
    ]);
    expect(within(rows[0] ?? table).getByRole('link')).toHaveAttribute('href', `/videos/${summary(1).id}`);
    expect(asked).toEqual(['?page=2&pageSize=20']);

    await userEvent.selectOptions(screen.getByLabelText('Durum'), 'Başarısız');
    await waitFor(() => {
      expect(locationOf(router)).toBe('/videos?status=Failed');
    });
    await userEvent.selectOptions(screen.getByLabelText('Amaç'), 'Fragman');
    await waitFor(() => {
      expect(asked.at(-1)).toBe('?purpose=Trailer&status=Failed&page=1&pageSize=20');
    });
    await userEvent.click(screen.getByRole('button', { name: 'Sonraki' }));
    await waitFor(() => {
      expect(locationOf(router)).toBe('/videos?status=Failed&purpose=Trailer&page=2');
    });
    await userEvent.selectOptions(screen.getByLabelText('Amaç'), 'Hepsi');
    await waitFor(() => {
      expect(locationOf(router)).toBe('/videos?status=Failed');
    });
  });

  it('ignores unknown filters and says when nothing matches or the list cannot be read', async () => {
    signInWith(['streaming:videos:read']);
    const asked: string[] = [];
    server.use(
      http.get(`${streamingUrl}/videos`, ({ request }) => {
        asked.push(new URL(request.url).search);
        return HttpResponse.json({ items: [], pageNumber: 1, pageSize: 20, totalCount: 0 });
      }),
    );
    const first = renderApp('/videos?purpose=Other&status=Gone');
    expect(await screen.findByText('Video bulunamadı.')).toBeInTheDocument();
    expect(asked).toEqual(['?page=1&pageSize=20']);
    const menu = screen.getByRole('navigation', { name: 'Yönetim menüsü' });
    expect(
      within(menu)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Videolar']);
    first.unmount();

    server.use(http.get(`${streamingUrl}/videos`, () => problem(403, 'Auth.Forbidden')));
    renderApp('/videos');
    expect(await screen.findByRole('alert', {}, { timeout: 5000 })).toBeInTheDocument();
  });
});
