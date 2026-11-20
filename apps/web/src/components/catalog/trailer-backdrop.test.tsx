import { fireEvent, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bringIntoView, leaveView, preferReducedMotion } from '../../test/observers';
import { gatewayUrl, problem, renderPage, server, signedOut } from '../../test/render';
import { TrailerBackdrop, trailerDelayMs } from './trailer-backdrop';

const players = vi.hoisted(() => {
  class FakeHls {
    static supported = true;
    static readonly Events = { ERROR: 'hlsError' };
    static isSupported() {
      return FakeHls.supported;
    }
    readonly handlers = new Map<string, (event: string, data: { fatal: boolean }) => void>();
    source: string | undefined;
    media: HTMLMediaElement | undefined;
    destroyed = false;
    constructor(readonly config: object) {
      created.push(this);
    }
    on(event: string, handler: (event: string, data: { fatal: boolean }) => void) {
      this.handlers.set(event, handler);
    }
    loadSource(source: string) {
      this.source = source;
    }
    attachMedia(media: HTMLMediaElement) {
      this.media = media;
    }
    destroy() {
      this.destroyed = true;
    }
    fail() {
      this.handlers.get(FakeHls.Events.ERROR)?.(FakeHls.Events.ERROR, { fatal: true });
    }
  }
  const created: FakeHls[] = [];
  return { FakeHls, created };
});

vi.mock('hls.js', () => ({ default: players.FakeHls }));

const titleId = '0195f0e0-0000-7000-8000-000000000007';
const session = {
  userId: '0195f0e0-0000-7000-8000-000000000001',
  email: 'viewer@example.test',
  roles: [],
  permissions: [],
  csrfToken: 'csrf',
};
const child = { id: '0195f0e0-0000-7000-8000-0000000000a2', name: 'Ada', maxAgeRating: 'Age7' };

function trailer(ageRating = 'Age13') {
  return http.get(`${gatewayUrl}/streaming/titles/${titleId}/trailer`, () =>
    HttpResponse.json({
      videoId: 'v1',
      playlist: 'trailers/v1/master.m3u8?exp=1&sig=s',
      durationSeconds: 20,
      expiresAt: '2026-11-20T10:00:00Z',
      ageRating,
    }),
  );
}

function renderBackdrop() {
  return renderPage(
    <TrailerBackdrop
      titleId={titleId}
      imageUrl="http://storage.test/b.png"
      title="Kuzey Işığı"
      delayMs={0}
    />,
    'tr',
    {
      withProfiles: true,
    },
  );
}

const played = vi.fn<() => Promise<void>>();
const paused = vi.fn<() => void>();

/** The trailer's video element, which must be there. */
function videoIn(container: HTMLElement): HTMLVideoElement {
  const video = container.querySelector('video');
  if (!video) {
    throw new Error('No video.');
  }
  return video;
}

beforeEach(() => {
  players.created.length = 0;
  players.FakeHls.supported = true;
  played.mockReset().mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(played);
  paused.mockReset();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(paused);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TrailerBackdrop', () => {
  it("plays the title's trailer muted over its image, from the playlist under Streaming's address", async () => {
    server.use(signedOut, trailer());
    const { container } = renderBackdrop();

    await waitFor(() => {
      expect(players.created).toHaveLength(1);
    });
    const [player] = players.created;
    expect(player?.source).toBe(`${gatewayUrl}/streaming/trailers/v1/master.m3u8?exp=1&sig=s`);
    const video = container.querySelector('video');
    expect(player?.media).toBe(video);
    expect(video?.muted).toBe(true);
    expect(played).toHaveBeenCalled();
    expect(video).toHaveClass('opacity-0');

    fireEvent.playing(videoIn(container));

    expect(video).toHaveClass('opacity-100');
    expect(container.querySelector('img')).toHaveAttribute('src', 'http://storage.test/b.png');
  });

  it('waits while it is off screen, and goes on when it is seen again', async () => {
    server.use(signedOut, trailer());
    renderBackdrop();
    await waitFor(() => {
      expect(players.created).toHaveLength(1);
    });
    played.mockClear();
    vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockReturnValue(true);

    leaveView();
    expect(paused).toHaveBeenCalled();
    expect(played).not.toHaveBeenCalled();

    bringIntoView();
    expect(played).toHaveBeenCalledOnce();
  });

  it('gives way to the image when it ends', async () => {
    server.use(signedOut, trailer());
    const { container } = renderBackdrop();
    await waitFor(() => {
      expect(players.created).toHaveLength(1);
    });

    fireEvent.ended(videoIn(container));

    expect(container.querySelector('video')).not.toBeInTheDocument();
    expect(players.created[0]?.destroyed).toBe(true);
  });

  it('gives way to the image when the stream fails', async () => {
    server.use(signedOut, trailer());
    const { container } = renderBackdrop();
    await waitFor(() => {
      expect(players.created).toHaveLength(1);
    });

    players.created[0]?.fail();

    await waitFor(() => {
      expect(container.querySelector('video')).not.toBeInTheDocument();
    });
  });

  it('lets Safari play the playlist itself', async () => {
    players.FakeHls.supported = false;
    vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('maybe');
    server.use(signedOut, trailer());
    const { container } = renderBackdrop();

    await waitFor(() => {
      expect(container.querySelector('video')?.getAttribute('src')).toBe(
        `${gatewayUrl}/streaming/trailers/v1/master.m3u8?exp=1&sig=s`,
      );
    });
    expect(players.created).toHaveLength(0);
  });

  it("does not play a trailer rated above the chosen profile's limit", async () => {
    document.cookie = `nbp-profile=${child.id}.Age7; Path=/`;
    let asked = 0;
    server.use(
      http.get(`${gatewayUrl}/session`, () => HttpResponse.json(session)),
      http.get(`${gatewayUrl}/auth/profiles`, () => HttpResponse.json([child])),
      http.get(`${gatewayUrl}/streaming/titles/${titleId}/trailer`, () => {
        asked++;
        return HttpResponse.json({
          videoId: 'v1',
          playlist: 'trailers/v1/master.m3u8',
          durationSeconds: 20,
          expiresAt: '2026-11-20T10:00:00Z',
          ageRating: 'Age13',
        });
      }),
    );
    const { container } = renderBackdrop();

    await waitFor(() => {
      expect(asked).toBe(1);
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(container.querySelector('video')).not.toBeInTheDocument();
    expect(players.created).toHaveLength(0);
  });

  it("plays one within the chosen profile's limit", async () => {
    document.cookie = `nbp-profile=${child.id}.Age7; Path=/`;
    server.use(
      http.get(`${gatewayUrl}/session`, () => HttpResponse.json(session)),
      http.get(`${gatewayUrl}/auth/profiles`, () => HttpResponse.json([child])),
      trailer('Age7'),
    );
    renderBackdrop();

    await waitFor(() => {
      expect(players.created).toHaveLength(1);
    });
  });

  it('does not even ask when the visitor wants less motion', async () => {
    preferReducedMotion(true);
    let asked = 0;
    server.use(
      signedOut,
      http.get(`${gatewayUrl}/streaming/titles/${titleId}/trailer`, () => {
        asked++;
        return problem(404, 'Trailer.NotFound');
      }),
    );
    const { container } = renderBackdrop();

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(asked).toBe(0);
    expect(container.querySelector('video')).not.toBeInTheDocument();
  });

  it('keeps the image when the title has no trailer', async () => {
    let asked = 0;
    server.use(
      signedOut,
      http.get(`${gatewayUrl}/streaming/titles/${titleId}/trailer`, () => {
        asked++;
        return problem(404, 'Trailer.NotFound');
      }),
    );
    const { container } = renderBackdrop();

    await waitFor(() => {
      expect(asked).toBe(1);
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(container.querySelector('video')).not.toBeInTheDocument();
  });

  it('waits two seconds before asking', () => {
    expect(trailerDelayMs).toBe(2000);
  });
});
