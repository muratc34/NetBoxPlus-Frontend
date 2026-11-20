import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { useTitlePages, useTitleRow } from './catalog';
import { nextTitlePage, type TitlePage, type TitleSummary } from './catalog-reads';
import { createBrowserGateway, GatewayProvider } from './gateway';
import { createAppQueryClient } from './query-client';

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

function title(id: string): TitleSummary {
  return {
    id,
    kind: 'Movie',
    title: `Title ${id}`,
    language: 'tr',
    releaseYear: 2024,
    ageRating: 'Age7',
    posterUrl: null,
    backdropUrl: null,
    genres: [],
  };
}

function page(pageNumber: number, ids: string[], totalCount: number, pageSize = 2): TitlePage {
  return { items: ids.map(title), pageNumber, pageSize, totalCount };
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={createAppQueryClient({ onSessionEnded: vi.fn() })}>
      <GatewayProvider gateway={createBrowserGateway(gatewayUrl)}>{children}</GatewayProvider>
    </QueryClientProvider>
  );
}

describe('nextTitlePage', () => {
  it('is the next page while the list has more, and none after the last', () => {
    expect(nextTitlePage(page(1, ['a', 'b'], 3))).toBe(2);
    expect(nextTitlePage(page(2, ['c'], 3))).toBeUndefined();
    expect(nextTitlePage(page(2, ['c', 'd'], 4))).toBeUndefined();
    expect(nextTitlePage(page(1, [], 0))).toBeUndefined();
  });
});

describe('useTitlePages', () => {
  it("starts from the server's page and asks for the next one with the same filter", async () => {
    const asked: URLSearchParams[] = [];
    server.use(
      http.get(`${gatewayUrl}/catalog/titles`, ({ request }) => {
        const query = new URL(request.url).searchParams;
        asked.push(query);
        return HttpResponse.json(page(Number(query.get('page')), ['c'], 3));
      }),
    );
    const filter = {
      lang: 'en',
      kind: 'Series',
      genreId: 'g-1',
      maxAgeRating: 'Age13',
      pageSize: 2,
    } as const;

    const { result } = renderHook(() => useTitlePages(filter, page(1, ['a', 'b'], 3)), { wrapper });

    expect(result.current.data?.pages.flatMap((each) => each.items.map((item) => item.id))).toEqual([
      'a',
      'b',
    ]);
    expect(asked).toHaveLength(0);
    expect(result.current.hasNextPage).toBe(true);

    await act(() => result.current.fetchNextPage());

    await waitFor(() => {
      expect(result.current.data?.pages.flatMap((each) => each.items.map((item) => item.id))).toEqual([
        'a',
        'b',
        'c',
      ]);
    });
    expect(result.current.hasNextPage).toBe(false);
    expect(Object.fromEntries(asked[0] ?? [])).toEqual({
      lang: 'en',
      kind: 'Series',
      genreId: 'g-1',
      maxAgeRating: 'Age13',
      pageSize: '2',
      page: '2',
    });
  });
});

describe('useTitleRow', () => {
  it('asks only once enabled', async () => {
    let asked = 0;
    server.use(
      http.get(`${gatewayUrl}/catalog/titles`, () => {
        asked++;
        return HttpResponse.json(page(1, ['a'], 1));
      }),
    );
    const filter = { lang: 'tr', genreId: 'g-2' } as const;

    const { result, rerender } = renderHook(({ enabled }) => useTitleRow(filter, enabled), {
      wrapper,
      initialProps: { enabled: false },
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(asked).toBe(0);

    rerender({ enabled: true });

    await waitFor(() => {
      expect(result.current.data?.items[0]?.id).toBe('a');
    });
    expect(asked).toBe(1);
  });
});
