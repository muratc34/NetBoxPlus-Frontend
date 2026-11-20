import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { readTitlesByIds, titlesByIdLimit, type TitleSummary } from './catalog-reads';
import { createBrowserGateway, GatewayProvider } from './gateway';
import { personalKeys, useChangeMyList, useContinueWatching, useMyList, type MyListItem } from './personal';
import { createAppQueryClient } from './query-client';
import { useSearchPages, useSuggestions } from './search';

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
    title: id,
    language: 'tr',
    releaseYear: 2024,
    ageRating: 'All',
    posterUrl: null,
    backdropUrl: null,
    genres: [],
  };
}

function setup() {
  const queryClient: QueryClient = createAppQueryClient({ onSessionEnded: vi.fn() });
  const gateway = createBrowserGateway(gatewayUrl);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <GatewayProvider gateway={gateway}>{children}</GatewayProvider>
    </QueryClientProvider>
  );
  return { queryClient, wrapper, gateway };
}

describe('readTitlesByIds', () => {
  it('keeps the order of the ids, once each, without the ones Catalog does not list', async () => {
    const asked: URLSearchParams[] = [];
    server.use(
      http.get(`${gatewayUrl}/catalog/titles`, ({ request }) => {
        const query = new URL(request.url).searchParams;
        asked.push(query);
        const ids = query.getAll('ids').filter((id) => id !== 'gone');
        return HttpResponse.json({
          items: ids.reverse().map(title),
          pageNumber: 1,
          pageSize: 100,
          totalCount: ids.length,
        });
      }),
    );

    const titles = await readTitlesByIds(setup().gateway.clients.catalog, ['b', 'gone', 'a', 'b'], 'en');

    expect(titles.map((item) => item.id)).toEqual(['b', 'a']);
    expect(asked).toHaveLength(1);
    expect(asked[0]?.getAll('ids')).toEqual(['b', 'gone', 'a']);
    expect(asked[0]?.get('lang')).toBe('en');
    expect(asked[0]?.get('pageSize')).toBe(String(titlesByIdLimit));
  });

  it('asks a hundred at a time', async () => {
    const sizes: number[] = [];
    server.use(
      http.get(`${gatewayUrl}/catalog/titles`, ({ request }) => {
        const ids = new URL(request.url).searchParams.getAll('ids');
        sizes.push(ids.length);
        return HttpResponse.json({
          items: ids.map(title),
          pageNumber: 1,
          pageSize: 100,
          totalCount: ids.length,
        });
      }),
    );
    const ids = Array.from({ length: 201 }, (_, index) => `t${String(index)}`);

    const titles = await readTitlesByIds(setup().gateway.clients.catalog, ids, 'tr');

    expect(sizes.sort((a, b) => b - a)).toEqual([100, 100, 1]);
    expect(titles.map((item) => item.id)).toEqual(ids);
  });
});

describe('personal queries', () => {
  it('ask nothing without a profile', async () => {
    let asked = 0;
    server.use(
      http.all(`${gatewayUrl}/*`, () => {
        asked++;
        return HttpResponse.json([]);
      }),
    );
    const { wrapper } = setup();

    renderHook(() => [useContinueWatching(undefined), useMyList(undefined)], { wrapper });
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(asked).toBe(0);
  });

  it("ask for the profile's own", async () => {
    server.use(
      http.get(`${gatewayUrl}/streaming/profiles/p1/continue-watching`, () =>
        HttpResponse.json([
          {
            titleId: 't',
            kind: 'Movie',
            contentId: 't',
            positionSeconds: 1,
            durationSeconds: 2,
            updatedAt: 'x',
          },
        ]),
      ),
    );
    const { wrapper } = setup();

    const { result } = renderHook(() => useContinueWatching('p1'), { wrapper });

    await waitFor(() => {
      expect(result.current.data?.[0]?.titleId).toBe('t');
    });
  });
});

describe('useChangeMyList', () => {
  const listed: MyListItem = { titleId: 'old', kind: 'Series', addedAt: '2026-11-01T00:00:00Z' };

  it('shows the change at once and marks the list to be asked again', async () => {
    const sent: string[] = [];
    server.use(
      http.put(`${gatewayUrl}/streaming/profiles/p1/my-list/new`, ({ request }) => {
        sent.push(`PUT ${request.headers.get('X-CSRF-Token') ?? ''}`);
        return new HttpResponse(null, { status: 204 });
      }),
      http.delete(`${gatewayUrl}/streaming/profiles/p1/my-list/old`, () => {
        sent.push('DELETE');
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { wrapper, queryClient, gateway } = setup();
    gateway.setCsrfToken('csrf');
    queryClient.setQueryData(personalKeys.myList('p1'), [listed]);

    const { result } = renderHook(() => useChangeMyList('p1'), { wrapper });
    act(() => {
      result.current.mutate({ titleId: 'new', kind: 'Movie', onList: true });
    });

    await waitFor(() => {
      expect(
        queryClient.getQueryData<MyListItem[]>(personalKeys.myList('p1'))?.map((item) => item.titleId),
      ).toEqual(['new', 'old']);
    });
    await act(() => result.current.mutateAsync({ titleId: 'old', kind: 'Series', onList: false }));

    expect(sent).toEqual(['PUT csrf', 'DELETE']);
    expect(queryClient.getQueryState(personalKeys.myList('p1'))?.isInvalidated).toBe(true);
  });

  it('puts the list back when Streaming refuses', async () => {
    server.use(
      http.put(`${gatewayUrl}/streaming/profiles/p1/my-list/new`, () =>
        HttpResponse.json({ status: 409, code: 'MyList.Full' }, { status: 409 }),
      ),
      http.get(`${gatewayUrl}/streaming/profiles/p1/my-list`, () => HttpResponse.json([listed])),
    );
    const { wrapper, queryClient } = setup();
    queryClient.setQueryData(personalKeys.myList('p1'), [listed]);

    const { result } = renderHook(() => useChangeMyList('p1'), { wrapper });
    await act(async () => {
      await expect(
        result.current.mutateAsync({ titleId: 'new', kind: 'Movie', onList: true }),
      ).rejects.toMatchObject({
        code: 'MyList.Full',
      });
    });

    expect(queryClient.getQueryData<MyListItem[]>(personalKeys.myList('p1'))).toEqual([listed]);
  });
});

describe('search hooks', () => {
  it('ask nothing for blank text', async () => {
    let asked = 0;
    server.use(
      http.get(`${gatewayUrl}/catalog/search*`, () => {
        asked++;
        return HttpResponse.json([]);
      }),
    );
    const { wrapper } = setup();

    renderHook(() => [useSearchPages({ q: '  ', lang: 'tr' }), useSuggestions(' ', 'tr')], { wrapper });
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(asked).toBe(0);
  });

  it('suggest for the trimmed text with the age limit', async () => {
    const asked: string[] = [];
    server.use(
      http.get(`${gatewayUrl}/catalog/search/suggest`, ({ request }) => {
        asked.push(new URL(request.url).search);
        return HttpResponse.json([title('k')]);
      }),
    );
    const { wrapper } = setup();

    const { result } = renderHook(() => useSuggestions(' kuz ', 'en', 'Age7'), { wrapper });

    await waitFor(() => {
      expect(result.current.data?.[0]?.id).toBe('k');
    });
    expect(asked).toEqual(['?q=kuz&lang=en&maxAgeRating=Age7']);
  });
});
