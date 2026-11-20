/**
 * The player's tests' stand-ins: a fake hls.js that records what the player asks of it and can say what a
 * real one would (tracks, qualities, errors), Streaming's playback endpoints, and a video element that
 * "plays". A test file uses them with:
 *
 *   vi.mock('hls.js', async () => ({ default: (await import('../../test/player')).FakeHls }));
 *   setUpPlayerTests();
 */
import { cleanup, fireEvent } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, vi, type MockInstance } from 'vitest';
import { Player } from '../features/watch/player';
import { gatewayUrl, navigation, renderPage, server } from './render';

type Handler = (event: string, data: Record<string, unknown>) => void;

export class FakeHls {
  static supported = true;
  static readonly Events = {
    ERROR: 'hlsError',
    MANIFEST_PARSED: 'hlsManifestParsed',
    AUDIO_TRACKS_UPDATED: 'hlsAudioTracksUpdated',
    AUDIO_TRACK_SWITCHED: 'hlsAudioTrackSwitched',
    SUBTITLE_TRACKS_UPDATED: 'hlsSubtitleTracksUpdated',
    SUBTITLE_TRACK_SWITCH: 'hlsSubtitleTrackSwitch',
    LEVEL_SWITCHED: 'hlsLevelSwitched',
  } as const;
  static readonly ErrorTypes = { MEDIA_ERROR: 'mediaError', NETWORK_ERROR: 'networkError' } as const;
  static isSupported() {
    return FakeHls.supported;
  }
  readonly handlers = new Map<string, Handler>();
  source: string | undefined;
  media: HTMLMediaElement | undefined;
  destroyed = false;
  recovered = 0;
  audioTracks: { lang?: string; name: string }[] = [];
  subtitleTracks: { lang?: string; name: string }[] = [];
  levels: { height: number }[] = [];
  autoLevelEnabled = true;
  private audio = -1;
  private subtitle = -1;
  private level = -1;
  constructor(readonly config: { startPosition?: number }) {
    playerFakes.created.push(this);
  }
  get audioTrack() {
    return this.audio;
  }
  set audioTrack(id: number) {
    this.audio = id;
    this.emit(FakeHls.Events.AUDIO_TRACK_SWITCHED);
  }
  get subtitleTrack() {
    return this.subtitle;
  }
  set subtitleTrack(id: number) {
    this.subtitle = id;
    this.emit(FakeHls.Events.SUBTITLE_TRACK_SWITCH);
  }
  get currentLevel() {
    return this.level;
  }
  set currentLevel(index: number) {
    this.autoLevelEnabled = index < 0;
    if (index >= 0) {
      this.level = index;
    }
    this.emit(FakeHls.Events.LEVEL_SWITCHED);
  }
  on(event: string, handler: Handler) {
    this.handlers.set(event, handler);
  }
  emit(event: string, data: Record<string, unknown> = {}) {
    this.handlers.get(event)?.(event, data);
  }
  loadSource(source: string) {
    this.source = source;
  }
  attachMedia(media: HTMLMediaElement) {
    this.media = media;
  }
  recoverMediaError() {
    this.recovered++;
  }
  destroy() {
    this.destroyed = true;
  }
  fail(type: string) {
    this.emit(FakeHls.Events.ERROR, { fatal: true, type });
  }
  /** The manifest arrives: its audio and subtitle languages and qualities, which play first. */
  parse({
    audio = [],
    subtitles = [],
    heights = [],
    audioCurrent = 0,
    subtitleCurrent = -1,
    playing = 0,
  }: {
    audio?: string[];
    subtitles?: string[];
    heights?: number[];
    audioCurrent?: number;
    subtitleCurrent?: number;
    playing?: number;
  }) {
    this.audioTracks = audio.map((lang) => ({ lang, name: `audio ${lang}` }));
    this.subtitleTracks = subtitles.map((lang) => ({ lang, name: `subtitles ${lang}` }));
    this.levels = heights.map((height) => ({ height }));
    this.audio = audioCurrent;
    this.subtitle = subtitleCurrent;
    this.level = playing;
    this.emit(FakeHls.Events.MANIFEST_PARSED);
  }
}

export const playerFakes = {
  created: [] as FakeHls[],
  finished: vi.fn(),
  pause: undefined as unknown as MockInstance<() => void>,
};

export const sessionsUrl = `${gatewayUrl}/streaming/playback-sessions`;

/**
 * Streaming as the player meets it: sessions `s1`, `s2`… that start where the profile stopped, and what
 * the player asked, in order ("start c1", "beat s1 42", "end s1 42").
 */
export function streaming({
  resume = 95,
  heartbeatSeconds = 30,
  start,
  beat,
  startDelayMs = 0,
  endDelayMs = 0,
}: {
  resume?: number;
  heartbeatSeconds?: number;
  start?: () => Response;
  beat?: () => Response;
  startDelayMs?: number;
  endDelayMs?: number;
} = {}) {
  const calls: string[] = [];
  let count = 0;
  server.use(
    http.post(sessionsUrl, async ({ request }) => {
      const body = (await request.json()) as { profileId: string; contentId: string };
      calls.push(`start ${body.contentId} for ${body.profileId}`);
      await delay(startDelayMs);
      if (start) {
        return start();
      }
      count++;
      return HttpResponse.json(
        {
          sessionId: `s${String(count)}`,
          playlist: `playback/s${String(count)}/master.m3u8?sig=x`,
          heartbeatSeconds,
          resumeFromSeconds: resume,
          audioLanguages: ['tr-TR'],
          subtitleLanguages: [],
        },
        { status: 201 },
      );
    }),
    http.post(`${sessionsUrl}/:id/heartbeat`, async ({ params, request }) => {
      const body = (await request.json()) as { positionSeconds: number };
      calls.push(`beat ${String(params.id)} ${String(body.positionSeconds)}`);
      return beat ? beat() : new HttpResponse(null, { status: 204 });
    }),
    http.delete(`${sessionsUrl}/:id`, async ({ params, request }) => {
      calls.push(
        `end ${String(params.id)} ${new URL(request.url).searchParams.get('positionSeconds') ?? ''}`,
      );
      if (endDelayMs > 0) {
        await delay(endDelayMs);
        calls.push(`ended ${String(params.id)}`);
      }
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return calls;
}

export function player(props: Partial<Parameters<typeof Player>[0]> = {}) {
  return renderPage(
    <Player
      profileId="p1"
      contentId="c1"
      fromStart={false}
      heading="Kuzey Işığı"
      backHref="/tr/movies/c1"
      onFinished={playerFakes.finished}
      {...props}
    />,
    'tr',
    { withProfiles: false },
  );
}

export function video(): HTMLVideoElement {
  const element = document.querySelector('video');
  if (!element) {
    throw new Error('The player has no video.');
  }
  return element;
}

/** The video at `seconds` of `duration`, as the browser would say after playing there. */
export function playAt(seconds: number, duration = 1800) {
  const element = video();
  Object.defineProperty(element, 'duration', { configurable: true, value: duration });
  Object.defineProperty(element, 'currentTime', { configurable: true, writable: true, value: seconds });
  fireEvent.playing(element);
  fireEvent.timeUpdate(element);
}

/** Resets the fakes before each test and lets the last session end after it. */
export function setUpPlayerTests() {
  beforeEach(() => {
    playerFakes.created.length = 0;
    FakeHls.supported = true;
    playerFakes.finished.mockReset();
    navigation.pathname = '/tr/watch/c1';
    // jsdom does not play media: playing and pausing only change the state and say so.
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
      Object.defineProperty(this, 'paused', { configurable: true, value: false });
      Object.defineProperty(this, 'readyState', { configurable: true, value: 4 });
      this.dispatchEvent(new Event('play'));
      return Promise.resolve();
    });
    playerFakes.pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (
      this: HTMLMediaElement,
    ) {
      Object.defineProperty(this, 'paused', { configurable: true, value: true });
      this.dispatchEvent(new Event('pause'));
    });
  });

  afterEach(async () => {
    // A session ends after the player has gone: let that request land before the next test's Streaming.
    cleanup();
    await new Promise((resolve) => setTimeout(resolve, 50));
    vi.restoreAllMocks();
  });
}
