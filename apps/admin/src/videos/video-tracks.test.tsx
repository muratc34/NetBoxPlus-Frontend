import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import type { BlockRequest } from '../data/blocks';
import type { VideoDetails } from '../data/videos';
import { catalogUrl, gatewayUrl, problem, renderApp, server, signInWith } from '../test/render';

const streamingUrl = `${gatewayUrl}/admin/streaming`;
const videoId = '0195f0e0-0000-7000-8000-0000000f0001';
const movieId = '0195f0e0-0000-7000-8000-00000000c001';
const writing = ['streaming:videos:read', 'streaming:videos:write'];

function details(overrides: Partial<VideoDetails> = {}): VideoDetails {
  return {
    id: videoId,
    purpose: 'Feature',
    contentKind: 'Movie',
    contentId: movieId,
    status: 'Ready',
    sizeBytes: 1024 ** 2,
    durationSeconds: 30,
    renditions: [{ height: 720, width: 1280, bandwidth: 3000000, playlist: '720.m3u8' }],
    failureReason: null,
    uploadExpiresAt: '2026-11-11T12:00:00Z',
    createdAt: '2026-11-11T10:00:00Z',
    audioLayout: 'Separate',
    originalAudioLanguage: 'tr-TR',
    audioTracks: [
      {
        id: 'a2',
        language: 'en-US',
        isOriginal: false,
        status: 'Failed',
        failureReason: 'Too short.',
        uploadExpiresAt: '',
      },
      {
        id: 'a1',
        language: 'tr-TR',
        isOriginal: true,
        status: 'Ready',
        failureReason: null,
        uploadExpiresAt: '',
      },
    ],
    subtitles: [
      { id: 's2', language: 'en-US', status: 'Ready', uploadExpiresAt: '' },
      { id: 's1', language: 'de-DE', status: 'AwaitingUpload', uploadExpiresAt: '' },
    ],
    ...overrides,
  };
}

/** The video as Streaming holds it; a change the test makes is seen on the next read. */
function answerVideo(video: VideoDetails = details()) {
  let current = video;
  server.use(http.get(`${streamingUrl}/videos/${videoId}`, () => HttpResponse.json(current)));
  return (next: Partial<VideoDetails>) => {
    current = { ...current, ...next };
  };
}

const region = (name: string) => screen.getByRole('region', { name });
const rows = (name: string) =>
  within(region(name))
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    );

function file(name: string, type: string, size = 10) {
  return new File(['x'.repeat(size)], name, { type });
}

describe('ContentName', () => {
  it('names the movie a video belongs to when Catalog can be read', async () => {
    signInWith(['streaming:videos:read', 'catalog:movies:read']);
    answerVideo();
    server.use(
      http.get(`${catalogUrl}/movies/${movieId}`, () =>
        HttpResponse.json({ id: movieId, title: 'Kuzey Işığı' }),
      ),
    );
    renderApp(`/videos/${videoId}`);

    const content = await screen.findByText('Film · Kuzey Işığı');
    expect(content.tagName).toBe('DD');
  });

  it('names a series and keeps to the kind without the permission, for an episode, or when Catalog fails', async () => {
    signInWith(['streaming:videos:read', 'catalog:series:read']);
    const asked: string[] = [];
    server.use(
      http.get(`${streamingUrl}/videos`, () =>
        HttpResponse.json({
          items: [
            {
              id: 'v1',
              purpose: 'Trailer',
              contentKind: 'Series',
              contentId: 'series-1',
              status: 'Ready',
              durationSeconds: 20,
              createdAt: '2026-11-12T10:00:00Z',
            },
            {
              id: 'v2',
              purpose: 'Feature',
              contentKind: 'Episode',
              contentId: 'episode-1',
              status: 'Ready',
              durationSeconds: 30,
              createdAt: '2026-11-11T10:00:00Z',
            },
            {
              id: 'v3',
              purpose: 'Feature',
              contentKind: 'Movie',
              contentId: movieId,
              status: 'Ready',
              durationSeconds: 30,
              createdAt: '2026-11-10T10:00:00Z',
            },
            {
              id: 'v4',
              purpose: 'Trailer',
              contentKind: 'Series',
              contentId: 'series-gone',
              status: 'Ready',
              durationSeconds: 20,
              createdAt: '2026-11-09T10:00:00Z',
            },
          ],
          pageNumber: 1,
          pageSize: 20,
          totalCount: 4,
        }),
      ),
      http.get(`${catalogUrl}/series/series-1`, () =>
        HttpResponse.json({ id: 'series-1', title: 'Rüzgarın Kızı' }),
      ),
      http.get(`${catalogUrl}/series/series-gone`, ({ request }) => {
        asked.push(new URL(request.url).pathname);
        return problem(404, 'Series.NotFound');
      }),
      http.get(`${catalogUrl}/*`, ({ request }) => {
        asked.push(new URL(request.url).pathname);
        return problem(404, 'Error.NotFound');
      }),
    );
    renderApp('/videos');

    const table = await within(await screen.findByRole('main')).findByRole('table');
    await waitFor(() => {
      expect(
        within(table)
          .getAllByRole('row')
          .slice(1)
          .map((row) => within(row).getAllByRole('cell')[2]?.textContent),
      ).toEqual(['Dizi · Rüzgarın Kızı', 'Bölüm', 'Film', 'Dizi']);
    });
    // An episode and a movie without its permission are not asked about; a title Catalog cannot give is not asked again.
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(asked).toEqual(['/admin/catalog/series/series-gone']);
  });
});

describe('Audio tracks', () => {
  it('lists the original first, then the dubbing with its state and why it failed', async () => {
    signInWith(writing);
    answerVideo();
    renderApp(`/videos/${videoId}`);

    await screen.findByRole('region', { name: 'Ses izleri' });
    expect(rows('Ses izleri')).toEqual([
      ['Türkçe (Türkiye)', 'Orijinal ses', 'Hazır', ''],
      ['Amerikan İngilizcesi', 'Dublaj', 'BaşarısızToo short.', 'Kaldır'],
    ]);
    expect(
      within(region('Ses izleri')).queryByRole('button', { name: 'Türkçe (Türkiye): kaldır' }),
    ).not.toBeInTheDocument();
    const form = within(region('Ses izleri')).getByRole('form', { name: 'Dublaj ekle' });
    const languages = within(within(form).getByLabelText('Dil'))
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(languages).toHaveLength(4);
    expect(languages.join()).not.toMatch(/Türkçe|Amerikan/);
    expect(within(form).getByLabelText('Ses dosyası')).toHaveAccessibleDescription(
      'Ses ya da video dosyası; süresi videodan en fazla 2 saniye farklı olmalı.',
    );
  });

  it('adds dubbing in a language, in blocks, then confirms it', async () => {
    signInWith(writing);
    const change = answerVideo(details({ audioTracks: [] }));
    let started: unknown;
    let confirmed = false;
    server.use(
      http.post(`${streamingUrl}/videos/${videoId}/audio-tracks`, async ({ request }) => {
        started = await request.json();
        return HttpResponse.json(
          { trackId: 'a9', uploadAddress: 'https://storage.test/a9?sig=x', expiresAt: '', maxBytes: 1000 },
          { status: 201 },
        );
      }),
      http.post(`${streamingUrl}/videos/${videoId}/audio-tracks/a9/uploaded`, () => {
        confirmed = true;
        change({
          audioTracks: [
            {
              id: 'a9',
              language: 'de-DE',
              isOriginal: false,
              status: 'Ready',
              failureReason: null,
              uploadExpiresAt: '',
            },
          ],
        });
        return new HttpResponse(null, { status: 204 });
      }),
    );
    let finish: () => void = () => undefined;
    const sendBlock = vi.fn<BlockRequest>((_method, _address, body, _headers, onProgress) =>
      typeof body === 'string'
        ? Promise.resolve()
        : new Promise((resolve) => {
            onProgress(body.size / 2);
            finish = () => {
              resolve();
            };
          }),
    );
    const { router } = renderApp(`/videos/${videoId}`, { sendBlock });

    const form = await within(await screen.findByRole('region', { name: 'Ses izleri' })).findByRole('form', {
      name: 'Dublaj ekle',
    });
    expect(
      within(within(form).getByLabelText('Dil'))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).not.toContain('Türkçe (Türkiye)');
    expect(within(region('Ses izleri')).getByText('Henüz dublaj yok.')).toBeInTheDocument();
    expect(within(form).getByRole('button', { name: 'Yükle' })).toBeDisabled();
    await userEvent.selectOptions(within(form).getByLabelText('Dil'), 'de-DE');
    await userEvent.upload(within(form).getByLabelText('Ses dosyası'), file('dub.m4a', 'audio/mp4'));
    await userEvent.click(within(form).getByRole('button', { name: 'Yükle' }));

    expect(await within(form).findByText('Yükleniyor: %50')).toBeInTheDocument();
    await router.navigate('/videos');
    const dialog = await screen.findByRole('dialog', { name: 'Yükleme sürüyor' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Vazgeç' }));
    finish();
    expect(await within(region('Ses izleri')).findByText('Almanca (Almanya)')).toBeInTheDocument();
    expect(started).toEqual({ language: 'de-DE' });
    expect(confirmed).toBe(true);
    expect(sendBlock.mock.calls[0]?.[1]).toContain('https://storage.test/a9?sig=x&comp=block');
    const after = within(region('Ses izleri')).getByRole('form', { name: 'Dublaj ekle' });
    expect(within(after).queryByRole('alert')).not.toBeInTheDocument();
    expect(await within(after).findByRole('button', { name: 'Yükle' })).toBeDisabled();

    // The language just taken is no longer chosen: the next upload goes in the first free one.
    await userEvent.upload(within(after).getByLabelText('Ses dosyası'), file('dub.m4a', 'audio/mp4'));
    await userEvent.click(within(after).getByRole('button', { name: 'Yükle' }));
    await waitFor(() => {
      expect(started).toEqual({ language: 'en-US' });
    });
    finish();
  });

  it('refuses a file that is not audio or video, an empty one and one too large', async () => {
    signInWith(writing);
    answerVideo(details({ audioTracks: [] }));
    let tickets = 0;
    server.use(
      http.post(`${streamingUrl}/videos/${videoId}/audio-tracks`, () => {
        tickets += 1;
        return HttpResponse.json(
          { trackId: 'a9', uploadAddress: 'https://storage.test/a9', expiresAt: '', maxBytes: 1000 },
          { status: 201 },
        );
      }),
    );
    const sendBlock = vi.fn<BlockRequest>(() => Promise.resolve());
    renderApp(`/videos/${videoId}`, { sendBlock });

    const form = await within(await screen.findByRole('region', { name: 'Ses izleri' })).findByRole('form', {
      name: 'Dublaj ekle',
    });
    const input = within(form).getByLabelText('Ses dosyası');
    await userEvent.upload(input, file('notes.txt', 'text/plain'), { applyAccept: false });
    await userEvent.click(within(form).getByRole('button', { name: 'Yükle' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('Bir ses ya da video dosyası seç.');

    await userEvent.upload(input, file('clip.mp4', 'video/mp4', 0));
    await userEvent.click(within(form).getByRole('button', { name: 'Yükle' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('Dosya boş.');
    expect(tickets).toBe(0);

    await userEvent.upload(input, file('clip.mp4', 'video/mp4', 1001));
    await userEvent.click(within(form).getByRole('button', { name: 'Yükle' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('Dosya bu yükleme için çok büyük.');
    expect(tickets).toBe(1);
    expect(sendBlock).not.toHaveBeenCalled();
  });

  it('removes dubbing after asking and shows a refusal in the question', async () => {
    signInWith(writing);
    const change = answerVideo();
    let answer = () => problem(409, 'Video.OriginalAudioKept');
    const removed: string[] = [];
    server.use(
      http.delete(`${streamingUrl}/videos/${videoId}/audio-tracks/:language`, ({ params }) => {
        removed.push(String(params.language));
        return answer();
      }),
    );
    renderApp(`/videos/${videoId}`);

    await userEvent.click(
      await within(await screen.findByRole('region', { name: 'Ses izleri' })).findByRole('button', {
        name: 'Amerikan İngilizcesi: kaldır',
      }),
    );
    let dialog = screen.getByRole('dialog', { name: '“Amerikan İngilizcesi” kaldırılsın mı?' });
    expect(dialog).toHaveTextContent('Bu dublaj videodan kaldırılır.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Kaldır' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Orijinal ses kaldırılamaz.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Vazgeç' }));

    answer = () => {
      change({
        audioTracks: [details().audioTracks[1] ?? details().audioTracks[0]].filter(
          (track) => track !== undefined,
        ),
      });
      return new HttpResponse(null, { status: 204 });
    };
    await userEvent.click(
      within(region('Ses izleri')).getByRole('button', { name: 'Amerikan İngilizcesi: kaldır' }),
    );
    dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Kaldır' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(removed).toEqual(['en-US', 'en-US']);
    await waitFor(() => {
      expect(within(region('Ses izleri')).getAllByRole('row')).toHaveLength(2);
    });
  });

  it('says why an old-layout video, a trailer or an unready one takes no dubbing', async () => {
    signInWith(writing);
    answerVideo(details({ audioLayout: 'Muxed', audioTracks: [] }));
    const first = renderApp(`/videos/${videoId}`);
    const audio = await screen.findByRole('region', { name: 'Ses izleri' });
    expect(
      within(audio).getByText(
        'Bu video eski düzende: dublaj için içeriğin sayfasından videoyu yeniden yükle.',
      ),
    ).toBeInTheDocument();
    expect(within(audio).queryByRole('form')).not.toBeInTheDocument();
    expect(within(region('Altyazılar')).getByRole('form', { name: 'Altyazı ekle' })).toBeInTheDocument();
    first.unmount();

    answerVideo(details({ purpose: 'Trailer', audioTracks: [], subtitles: [] }));
    const second = renderApp(`/videos/${videoId}`);
    expect(await screen.findByText('Fragmanlara dublaj ve altyazı eklenmez.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Ses izleri' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Altyazılar' })).not.toBeInTheDocument();
    second.unmount();

    answerVideo(details({ status: 'Queued', audioTracks: [], subtitles: [] }));
    renderApp(`/videos/${videoId}`);
    const unready = await screen.findByRole('region', { name: 'Ses izleri' });
    expect(within(unready).getByText('Dublaj ve altyazı video hazır olunca eklenir.')).toBeInTheDocument();
    expect(
      within(region('Altyazılar')).getByText('Dublaj ve altyazı video hazır olunca eklenir.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('only shows the tracks without the write permission', async () => {
    signInWith(['streaming:videos:read']);
    answerVideo(details({ status: 'Queued' }));
    renderApp(`/videos/${videoId}`);

    await screen.findByRole('region', { name: 'Ses izleri' });
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /kaldır/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/hazır olunca eklenir/)).not.toBeInTheDocument();
  });

  it('asks again while dubbing is processed', async () => {
    signInWith(['streaming:videos:read']);
    let asked = 0;
    server.use(
      http.get(`${streamingUrl}/videos/${videoId}`, () => {
        asked += 1;
        const status = asked === 1 ? 'Queued' : 'Ready';
        return HttpResponse.json(
          details({
            audioTracks: [
              {
                id: 'a2',
                language: 'en-US',
                isOriginal: false,
                status,
                failureReason: null,
                uploadExpiresAt: '',
              },
            ],
          }),
        );
      }),
    );
    renderApp(`/videos/${videoId}`);

    const audio = await screen.findByRole('region', { name: 'Ses izleri' });
    expect(within(audio).getByText('İşleniyor')).toBeInTheDocument();
    expect(await within(audio).findByText('Hazır', {}, { timeout: 7000 })).toBeInTheDocument();
  }, 10000);
});

describe('Subtitles', () => {
  it('lists the subtitles by language and adds one in a free language', async () => {
    signInWith(writing);
    const change = answerVideo();
    let started: unknown;
    server.use(
      http.post(`${streamingUrl}/videos/${videoId}/subtitles`, async ({ request }) => {
        started = await request.json();
        return HttpResponse.json(
          {
            subtitleId: 's9',
            uploadAddress: 'https://storage.test/s9?sig=x',
            expiresAt: '',
            maxBytes: 1024 * 1024,
          },
          { status: 201 },
        );
      }),
      http.post(`${streamingUrl}/videos/${videoId}/subtitles/s9/uploaded`, () => {
        change({
          subtitles: [
            ...details().subtitles,
            { id: 's9', language: 'fr-FR', status: 'Ready', uploadExpiresAt: '' },
          ],
        });
        return new HttpResponse(null, { status: 204 });
      }),
    );
    let finish: () => void = () => undefined;
    const sendBlock = vi.fn<BlockRequest>((_method, _address, body) =>
      typeof body === 'string'
        ? Promise.resolve()
        : new Promise((resolve) => {
            finish = () => {
              resolve();
            };
          }),
    );
    const { router } = renderApp(`/videos/${videoId}`, { sendBlock });

    await screen.findByRole('region', { name: 'Altyazılar' });
    expect(rows('Altyazılar')).toEqual([
      ['Almanca (Almanya)', 'Yükleme bekleniyor', 'Kaldır'],
      ['Amerikan İngilizcesi', 'Hazır', 'Kaldır'],
    ]);
    const form = within(region('Altyazılar')).getByRole('form', { name: 'Altyazı ekle' });
    expect(within(within(form).getByLabelText('Dil')).getAllByRole('option')).toHaveLength(4);
    expect(within(form).getByLabelText('Altyazı dosyası')).toHaveAccessibleDescription(
      'WebVTT (.vtt) ya da SRT (.srt), en fazla 1 MB.',
    );
    await userEvent.selectOptions(within(form).getByLabelText('Dil'), 'fr-FR');
    await userEvent.upload(within(form).getByLabelText('Altyazı dosyası'), file('Film.FR.SRT', ''));
    await userEvent.click(within(form).getByRole('button', { name: 'Yükle' }));
    // Leaving while the subtitle goes up asks first.
    await router.navigate('/videos');
    const dialog = await screen.findByRole('dialog', { name: 'Yükleme sürüyor' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Vazgeç' }));
    finish();

    expect(await within(region('Altyazılar')).findByText('Fransızca (Fransa)')).toBeInTheDocument();
    expect(started).toEqual({ language: 'fr-FR' });
    expect(sendBlock).toHaveBeenCalledTimes(2);
  });

  it('refuses another kind of file and shows a file Streaming cannot read', async () => {
    signInWith(writing);
    answerVideo(details({ subtitles: [] }));
    let tickets = 0;
    server.use(
      http.post(`${streamingUrl}/videos/${videoId}/subtitles`, () => {
        tickets += 1;
        return HttpResponse.json(
          { subtitleId: 's9', uploadAddress: 'https://storage.test/s9', expiresAt: '', maxBytes: 20 },
          { status: 201 },
        );
      }),
      http.post(`${streamingUrl}/videos/${videoId}/subtitles/s9/uploaded`, () =>
        problem(400, 'Video.SubtitleInvalid'),
      ),
    );
    renderApp(`/videos/${videoId}`);

    const form = await within(await screen.findByRole('region', { name: 'Altyazılar' })).findByRole('form', {
      name: 'Altyazı ekle',
    });
    expect(within(region('Altyazılar')).getByText('Henüz altyazı yok.')).toBeInTheDocument();
    const input = within(form).getByLabelText('Altyazı dosyası');
    await userEvent.upload(input, file('notes.txt', 'text/plain'), { applyAccept: false });
    await userEvent.click(within(form).getByRole('button', { name: 'Yükle' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent(
      'WebVTT (.vtt) ya da SRT (.srt) dosyası seç.',
    );

    await userEvent.upload(input, file('empty.vtt', 'text/vtt', 0));
    await userEvent.click(within(form).getByRole('button', { name: 'Yükle' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('Dosya boş.');
    expect(tickets).toBe(0);

    await userEvent.upload(input, file('big.vtt', 'text/vtt', 21));
    await userEvent.click(within(form).getByRole('button', { name: 'Yükle' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('Dosya bu yükleme için çok büyük.');

    await userEvent.upload(input, file('broken.vtt', 'text/vtt', 5));
    await userEvent.click(within(form).getByRole('button', { name: 'Yükle' }));
    expect(
      await within(form).findByText('Altyazı dosyası geçersiz: WebVTT ya da SRT olmalı.'),
    ).toBeInTheDocument();
    expect(tickets).toBe(2);
  });

  it('removes a subtitle after asking and says when every language is there', async () => {
    signInWith(writing);
    const all = ['tr-TR', 'en-US', 'en-GB', 'de-DE', 'fr-FR', 'es-ES'].map((language, index) => ({
      id: `s${String(index)}`,
      language,
      status: 'Ready' as const,
      uploadExpiresAt: '',
    }));
    const change = answerVideo(details({ subtitles: all }));
    const removed: string[] = [];
    server.use(
      http.delete(`${streamingUrl}/videos/${videoId}/subtitles/:language`, ({ params }) => {
        removed.push(String(params.language));
        change({ subtitles: all.filter((subtitle) => subtitle.language !== params.language) });
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp(`/videos/${videoId}`);

    const subtitles = await screen.findByRole('region', { name: 'Altyazılar' });
    expect(within(subtitles).getByText('Bütün diller eklendi.')).toBeInTheDocument();
    expect(within(subtitles).queryByRole('form')).not.toBeInTheDocument();

    await userEvent.click(within(subtitles).getByRole('button', { name: 'Fransızca (Fransa): kaldır' }));
    const dialog = screen.getByRole('dialog', { name: '“Fransızca (Fransa)” kaldırılsın mı?' });
    expect(dialog).toHaveTextContent('Bu altyazı videodan kaldırılır.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Kaldır' }));

    expect(await within(subtitles).findByRole('form', { name: 'Altyazı ekle' })).toBeInTheDocument();
    expect(removed).toEqual(['fr-FR']);
    expect(
      within(within(subtitles).getByLabelText('Dil'))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Fransızca (Fransa)']);
  });
});
