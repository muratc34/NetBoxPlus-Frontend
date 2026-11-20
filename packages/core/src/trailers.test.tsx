import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ageRatings, isWithinAgeLimit } from './age-ratings';
import { createBrowserGateway, GatewayProvider } from './gateway';
import { createAppQueryClient } from './query-client';
import { useTrailer } from './trailers';

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

function wrapperFor(gatewayUrl: string) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={createAppQueryClient({ onSessionEnded: vi.fn() })}>
      <GatewayProvider gateway={createBrowserGateway(gatewayUrl)}>{children}</GatewayProvider>
    </QueryClientProvider>
  );
}

describe('useTrailer', () => {
  it("resolves the playlist under Streaming's address at the gateway", async () => {
    server.use(
      http.get('https://api.test/streaming/titles/t1/trailer', () =>
        HttpResponse.json({
          videoId: 'v1',
          playlist: 'trailers/v1/master.m3u8?exp=1&sig=a%2Bb',
          durationSeconds: 20.5,
          expiresAt: '2026-11-20T10:00:00Z',
          ageRating: 'Age16',
        }),
      ),
    );

    const { result } = renderHook(() => useTrailer('t1', true), { wrapper: wrapperFor('https://api.test/') });

    await waitFor(() => {
      expect(result.current.data).toEqual({
        playlistUrl: 'https://api.test/streaming/trailers/v1/master.m3u8?exp=1&sig=a%2Bb',
        durationSeconds: 20.5,
        ageRating: 'Age16',
      });
    });
  });

  it('is null for a title without a trailer, and an error for anything else', async () => {
    server.use(
      http.get('https://api.test/streaming/titles/none/trailer', () =>
        HttpResponse.json({ status: 404, code: 'Trailer.NotFound' }, { status: 404 }),
      ),
      http.get('https://api.test/streaming/titles/broken/trailer', () =>
        HttpResponse.json({ status: 400, code: 'Validation.Failed' }, { status: 400 }),
      ),
    );
    const wrapper = wrapperFor('https://api.test');

    const none = renderHook(() => useTrailer('none', true), { wrapper });
    const broken = renderHook(() => useTrailer('broken', true), { wrapper });

    await waitFor(() => {
      expect(none.result.current.data).toBeNull();
    });
    await waitFor(() => {
      expect(broken.result.current.isError).toBe(true);
    });
  });

  it('asks only once enabled', async () => {
    let asked = 0;
    server.use(
      http.get('https://api.test/streaming/titles/t2/trailer', () => {
        asked++;
        return HttpResponse.json({ status: 404, code: 'Trailer.NotFound' }, { status: 404 });
      }),
    );

    renderHook(() => useTrailer('t2', false), { wrapper: wrapperFor('https://api.test') });
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(asked).toBe(0);
  });
});

describe('isWithinAgeLimit', () => {
  it('allows the same rating and younger ones', () => {
    expect(isWithinAgeLimit('Age7', 'Age7')).toBe(true);
    expect(isWithinAgeLimit('All', 'Age7')).toBe(true);
    expect(isWithinAgeLimit('Age13', 'Age7')).toBe(false);
    expect(isWithinAgeLimit('Age18', 'Age18')).toBe(true);
    for (const rating of ageRatings) {
      expect(isWithinAgeLimit(rating, 'All')).toBe(rating === 'All');
    }
  });
});
