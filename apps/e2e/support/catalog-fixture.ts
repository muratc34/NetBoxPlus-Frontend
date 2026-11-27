import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test as base } from '@playwright/test';
import { required, urls } from './environment';

/**
 * A movie the run makes for itself and takes away afterwards, so the flows need no seeded content and
 * leave none behind: dubbed in en-US, subtitled in tr-TR and en-US, rated 13+, published. Made through the
 * gateway's admin API, as the admin panel would.
 */
export interface DubbedMovie {
  readonly id: string;
  readonly title: string;
  readonly synopsis: string;
  readonly path: string;
}

const ffmpeg = process.env.FFMPEG_DIRECTORY ? join(process.env.FFMPEG_DIRECTORY, 'ffmpeg') : 'ffmpeg';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Long enough to play past the checks and stay unfinished for "continue watching". */
const seconds = 30;

function makeMedia(directory: string) {
  mkdirSync(directory, { recursive: true });
  const file = (name: string) => join(directory, name);
  const run = (args: string[]) =>
    execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'pipe' });
  run(['-f', 'lavfi', '-i', 'testsrc2=size=600x900', '-frames:v', '1', file('poster.png')]);
  run(['-f', 'lavfi', '-i', 'testsrc2=size=1920x1080', '-frames:v', '1', file('backdrop.png')]);
  run([
    ...['-f', 'lavfi', '-i', `testsrc2=size=1280x720:rate=25:duration=${String(seconds)}`],
    ...['-f', 'lavfi', '-i', `sine=frequency=440:duration=${String(seconds)}`],
    ...['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', file('feature.mp4')],
  ]);
  run(['-f', 'lavfi', '-i', `sine=frequency=660:duration=${String(seconds)}`, file('dub.m4a')]);
  writeFileSync(file('subtitle.vtt'), 'WEBVTT\n\n00:00:00.500 --> 00:00:20.000\nUçtan uca altyazı.\n');
  return {
    poster: file('poster.png'),
    backdrop: file('backdrop.png'),
    feature: file('feature.mp4'),
    dub: file('dub.m4a'),
    subtitle: file('subtitle.vtt'),
  };
}

class AdminApi {
  private cookie = '';
  private csrf = '';

  async signIn() {
    const response = await fetch(`${urls.gateway}/admin/session/sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: required('AUTH_ADMIN_EMAIL'),
        password: required('AUTH_ADMIN_PASSWORD'),
      }),
    });
    if (!response.ok) {
      throw new Error(`The admin sign-in answered ${String(response.status)}.`);
    }
    this.cookie =
      response.headers
        .getSetCookie()
        .map((value) => value.split(';')[0] ?? '')
        .find((value) => value.startsWith('__Host-nbp-admin=')) ?? '';
    this.csrf = ((await response.json()) as { csrfToken: string }).csrfToken;
  }

  async send<T>(method: string, path: string, body?: unknown): Promise<T> {
    for (;;) {
      const response = await fetch(`${urls.gateway}${path}`, {
        method,
        headers: {
          Cookie: this.cookie,
          'X-CSRF-Token': this.csrf,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (response.status === 429) {
        await sleep(1000 * Number(response.headers.get('retry-after') ?? '1'));
        continue;
      }
      const text = await response.text();
      if (!response.ok) {
        const error = new Error(
          `${method} ${path} answered ${String(response.status)}: ${text.slice(0, 200)}`,
        );
        Object.assign(error, {
          status: response.status,
          code: (text ? (JSON.parse(text) as { code?: string }) : {}).code,
        });
        throw error;
      }
      return (text ? JSON.parse(text) : undefined) as T;
    }
  }
}

async function put(address: string, file: string, contentType: string) {
  const response = await fetch(address, {
    method: 'PUT',
    headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': contentType },
    body: readFileSync(file),
  });
  if (!response.ok) {
    throw new Error(`Uploading ${file} answered ${String(response.status)}.`);
  }
}

async function until(what: string, check: () => Promise<boolean>, timeoutMs = 4 * 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) {
      throw new Error(`${what} did not happen in time. Is the transcoder running?`);
    }
    await sleep(3000);
  }
}

export async function createDubbedMovie(directory: string): Promise<DubbedMovie> {
  const media = makeMedia(directory);
  const api = new AdminApi();
  await api.signIn();
  const run = Date.now().toString(36);
  const title = `Uçtan Uca Dublaj ${run}`;
  const synopsis = `Uçtan uca testin dublajlı filmi, koşu ${run}.`;

  const genres = await api.send<{ id: string }[]>('GET', '/admin/catalog/genres');
  const genre = genres[0];
  if (!genre) {
    throw new Error('The catalog has no genre to file the movie under.');
  }
  const { id } = await api.send<{ id: string }>('POST', '/admin/catalog/movies', {
    translations: {
      tr: { title, synopsis },
      en: { title: `End to End Dub ${run}`, synopsis: `The end-to-end run's dubbed movie, run ${run}.` },
    },
    originalTitle: title,
    releaseYear: 2026,
    ageRating: 'Age13',
    runtimeMinutes: 90,
    genreIds: [genre.id],
    credits: [],
    version: 0,
  });

  for (const [slot, file] of [
    ['poster', media.poster],
    ['backdrop', media.backdrop],
  ] as const) {
    const ticket = await api.send<{ uploadId: string; uploadAddress: string }>(
      'POST',
      '/admin/catalog/images/uploads',
    );
    await put(ticket.uploadAddress, file, 'image/png');
    const { version } = await api.send<{ version: number }>('GET', `/admin/catalog/movies/${id}`);
    await api.send('PUT', `/admin/catalog/movies/${id}/images/${slot}`, {
      uploadId: ticket.uploadId,
      version,
    });
  }

  const video = await api.send<{ videoId: string; uploadAddress: string }>(
    'POST',
    '/admin/streaming/videos',
    {
      contentKind: 'Movie',
      contentId: id,
    },
  );
  await put(video.uploadAddress, media.feature, 'video/mp4');
  await api.send('POST', `/admin/streaming/videos/${video.videoId}/uploaded`);
  const videoPath = `/admin/streaming/videos/${video.videoId}`;
  await until(
    'The video transcoding',
    async () => (await api.send<{ status: string }>('GET', videoPath)).status === 'Ready',
  );

  const dub = await api.send<{ trackId: string; uploadAddress: string }>(
    'POST',
    `${videoPath}/audio-tracks`,
    {
      language: 'en-US',
    },
  );
  await put(dub.uploadAddress, media.dub, 'audio/mp4');
  await api.send('POST', `${videoPath}/audio-tracks/${dub.trackId}/uploaded`);
  for (const language of ['tr-TR', 'en-US']) {
    const subtitle = await api.send<{ subtitleId: string; uploadAddress: string }>(
      'POST',
      `${videoPath}/subtitles`,
      {
        language,
      },
    );
    await put(subtitle.uploadAddress, media.subtitle, 'text/vtt');
    await api.send('POST', `${videoPath}/subtitles/${subtitle.subtitleId}/uploaded`);
  }
  await until('The dub transcoding', async () => {
    const details = await api.send<{ audioTracks?: { language: string; status: string }[] }>(
      'GET',
      videoPath,
    );
    return (
      details.audioTracks?.some((track) => track.language === 'en-US' && track.status === 'Ready') ?? false
    );
  });

  // Catalog hears that the video is ready through an event; until then publishing is refused.
  await until('Publishing', async () => {
    try {
      await api.send('POST', `/admin/catalog/movies/${id}/publish`);
      return true;
    } catch (error) {
      if ((error as { code?: string }).code === 'Content.VideoRequired') {
        return false;
      }
      throw error;
    }
  });
  return { id, title, synopsis, path: `/tr/movies/${id}` };
}

export async function removeMovie(movie: DubbedMovie) {
  const api = new AdminApi();
  await api.signIn();
  await api.send('POST', `/admin/catalog/movies/${movie.id}/unpublish`).catch(() => undefined);
  await api.send('DELETE', `/admin/catalog/movies/${movie.id}`);
}

/** Tests that need the dubbed movie take it from here: made once per worker, removed when the worker ends. */
export const test = base.extend<object, { dubbedMovie: DubbedMovie }>({
  dubbedMovie: [
    // eslint-disable-next-line no-empty-pattern -- Playwright reads the fixtures a function asks for from its first parameter.
    async ({}, use, info) => {
      const movie = await createDubbedMovie(join(info.project.outputDir, 'dubbed-movie'));
      await use(movie);
      await removeMovie(movie);
    },
    { scope: 'worker', timeout: 8 * 60_000 },
  ],
});

export { expect } from '@playwright/test';
