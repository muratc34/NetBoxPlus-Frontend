import { renderHook } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createBrowserGateway, GatewayProvider } from './gateway';
import { playbackRequests, streamingUrl, usePlaybackRequests } from './playback';

const gatewayUrl = 'http://gateway.test';
const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

function requests() {
  const gateway = createBrowserGateway(`${gatewayUrl}/`);
  gateway.setCsrfToken('csrf');
  return playbackRequests(gateway.clients.streaming, gateway.baseUrl);
}

describe('streamingUrl', () => {
  it("resolves against Streaming's root at the gateway", () => {
    expect(streamingUrl('http://gw.test/', 'playback/s/master.m3u8?sig=x')).toBe(
      'http://gw.test/streaming/playback/s/master.m3u8?sig=x',
    );
    expect(streamingUrl('http://gw.test', '/playback/a')).toBe('http://gw.test/playback/a');
  });
});

describe('playback requests', () => {
  it('start a session for the profile and the content, with the full playlist address', async () => {
    const sent: { body: unknown; csrf: string | null }[] = [];
    server.use(
      http.post(`${gatewayUrl}/streaming/playback-sessions`, async ({ request }) => {
        sent.push({ body: await request.json(), csrf: request.headers.get('X-CSRF-Token') });
        return HttpResponse.json(
          {
            sessionId: 's1',
            playlist: 'playback/s1/master.m3u8?sig=x',
            heartbeatSeconds: 30,
            resumeFromSeconds: 12.5,
            audioLanguages: ['tr-TR', 'en-US'],
            subtitleLanguages: ['tr-TR'],
          },
          { status: 201 },
        );
      }),
    );

    await expect(requests().start('p1', 'c1')).resolves.toEqual({
      id: 's1',
      playlistUrl: `${gatewayUrl}/streaming/playback/s1/master.m3u8?sig=x`,
      heartbeatSeconds: 30,
      resumeFromSeconds: 12.5,
      audioLanguages: ['tr-TR', 'en-US'],
      subtitleLanguages: ['tr-TR'],
    });
    expect(sent).toEqual([{ body: { profileId: 'p1', contentId: 'c1' }, csrf: 'csrf' }]);
  });

  it("pass on Streaming's refusal", async () => {
    server.use(
      http.post(`${gatewayUrl}/streaming/playback-sessions`, () =>
        HttpResponse.json({ status: 409, code: 'Playback.TooManyScreens' }, { status: 409 }),
      ),
    );

    await expect(requests().start('p1', 'c1')).rejects.toMatchObject({
      status: 409,
      code: 'Playback.TooManyScreens',
    });
  });

  it('report the position in whole seconds, never below zero', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${gatewayUrl}/streaming/playback-sessions/s1/heartbeat`, async ({ request }) => {
        bodies.push(await request.json());
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await requests().heartbeat('s1', 61.9);
    await requests().heartbeat('s1', -3);
    await requests().heartbeat('s1', Number.NaN);

    expect(bodies).toEqual([{ positionSeconds: 61 }, { positionSeconds: 0 }, { positionSeconds: 0 }]);
  });

  it('fail a heartbeat Streaming no longer accepts', async () => {
    server.use(
      http.post(`${gatewayUrl}/streaming/playback-sessions/s1/heartbeat`, () =>
        HttpResponse.json({ status: 404, code: 'Playback.SessionEnded' }, { status: 404 }),
      ),
    );

    await expect(requests().heartbeat('s1', 1)).rejects.toMatchObject({ code: 'Playback.SessionEnded' });
  });

  it('end the session with its position, outliving the page when asked', async () => {
    // MSW copies the request without `keepalive`, so the request the client builds is read directly.
    const ended: { url: string; method: string; keepalive: boolean; csrf: string | null }[] = [];
    const gateway = createBrowserGateway(gatewayUrl, (request) => {
      ended.push({
        url: request.url,
        method: request.method,
        keepalive: request.keepalive,
        csrf: request.headers.get('X-CSRF-Token'),
      });
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    gateway.setCsrfToken('csrf');
    const { end } = playbackRequests(gateway.clients.streaming, gateway.baseUrl);

    await end('s1', 42.7);
    await end('s1', 43, { keepalive: true });

    const address = `${gatewayUrl}/streaming/playback-sessions/s1?positionSeconds=`;
    expect(ended).toEqual([
      { url: `${address}42`, method: 'DELETE', keepalive: false, csrf: 'csrf' },
      { url: `${address}43`, method: 'DELETE', keepalive: true, csrf: 'csrf' },
    ]);
  });

  it("keep the profile's languages", async () => {
    const sent: unknown[] = [];
    server.use(
      http.put(`${gatewayUrl}/streaming/profiles/p1/playback-preferences`, async ({ request }) => {
        sent.push(await request.json());
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await requests().savePreferences('p1', { audioLanguage: 'en-US', subtitleLanguage: null });

    expect(sent).toEqual([{ audioLanguage: 'en-US', subtitleLanguage: null }]);
  });

  it("are bound to the provider's gateway", () => {
    const gateway = createBrowserGateway(gatewayUrl);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <GatewayProvider gateway={gateway}>{children}</GatewayProvider>
    );

    const { result, rerender } = renderHook(() => usePlaybackRequests(), { wrapper });
    const first = result.current;
    rerender();

    expect(result.current).toBe(first);
    expect(Object.keys(first).sort()).toEqual(['end', 'heartbeat', 'savePreferences', 'start']);
  });
});
