import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { comedy, drama, title, titlePage } from '../../test/catalog';
import { gatewayUrl, navigation, problem, renderPage, server } from '../../test/render';
import { SearchPage } from './search-page';
import { searchText } from './search-text';

function search(props: Partial<Parameters<typeof SearchPage>[0]> = {}) {
  return renderPage(
    <SearchPage
      initialQuery=""
      firstPage={undefined}
      unavailable={false}
      genres={[drama, comedy]}
      maxAgeRating={undefined}
      delayMs={0}
      {...props}
    />,
  );
}

function catalog(results: ReturnType<typeof titlePage>) {
  const asked = { search: [] as string[], suggest: [] as string[] };
  server.use(
    http.get(`${gatewayUrl}/catalog/search`, ({ request }) => {
      asked.search.push(new URL(request.url).search);
      return HttpResponse.json(results);
    }),
    http.get(`${gatewayUrl}/catalog/search/suggest`, ({ request }) => {
      asked.suggest.push(new URL(request.url).search);
      return HttpResponse.json(results.items);
    }),
  );
  return asked;
}

describe('SearchPage', () => {
  it('offers genres to browse while nothing is typed', () => {
    search();

    expect(screen.getByRole('link', { name: 'Dram' })).toHaveAttribute('href', `/tr/genres/${drama.id}`);
  });

  it("shows the server's results for the address's text without asking again", async () => {
    const asked = catalog(titlePage([]));
    search({ initialQuery: 'kuzey', firstPage: titlePage([title(1)], 1, 1) });

    expect(screen.getByRole('searchbox')).toHaveValue('kuzey');
    expect(screen.getByText('1 sonuç')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Title 1/ })).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(asked.search).toEqual([]);
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('follows the typing: the address and the results, within the age limit, with no second list', async () => {
    const asked = catalog(titlePage([title(1), title(2)], 1, 2));
    renderPage(
      <SearchPage
        initialQuery=""
        firstPage={undefined}
        unavailable={false}
        genres={[]}
        maxAgeRating="Age7"
        delayMs={0}
      />,
    );

    await userEvent.setup().type(screen.getByRole('searchbox'), 'gece');

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenLastCalledWith('/tr/search?q=gece', { scroll: false });
    });
    expect(await screen.findByText('2 sonuç')).toBeInTheDocument();
    expect(asked.search.at(-1)).toBe('?q=gece&lang=tr&maxAgeRating=Age7&page=1');
    expect(asked.suggest).toEqual([]);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('puts the keyboard away on Enter, without leaving the page', async () => {
    catalog(titlePage([title(1)]));
    search();
    const user = userEvent.setup();
    const box = screen.getByRole('searchbox');

    await user.type(box, 'ti{Enter}');

    expect(box).not.toHaveFocus();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it('goes back to the genres when the box is emptied', async () => {
    catalog(titlePage([title(1)]));
    search({ initialQuery: 'gece', firstPage: titlePage([title(1)]) });

    await userEvent.setup().clear(screen.getByRole('searchbox'));

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenLastCalledWith('/tr/search', { scroll: false });
    });
    expect(screen.getByRole('link', { name: 'Komedi' })).toBeInTheDocument();
  });

  it('says when nothing was found', async () => {
    catalog(titlePage([]));
    search();

    await userEvent.setup().type(screen.getByRole('searchbox'), 'zzz');

    expect(await screen.findByText('"zzz" için sonuç bulunamadı.')).toBeInTheDocument();
  });

  it('says so when search is down, from the server or the browser', async () => {
    const { unmount } = search({ initialQuery: 'gece', unavailable: true });
    expect(screen.getByRole('alert')).toHaveTextContent('Arama şu an kullanılamıyor.');
    unmount();

    server.use(http.get(`${gatewayUrl}/catalog/search`, () => problem(503, 'Search.Unavailable')));
    search();
    await userEvent.setup().type(screen.getByRole('searchbox'), 'gece');

    expect(await screen.findByRole('alert', {}, { timeout: 5000 })).toHaveTextContent(
      'Arama şu an kullanılamıyor.',
    );
  });

  it('stops at what Catalog accepts', () => {
    search();

    expect(screen.getByRole('searchbox')).toHaveAttribute('maxLength', '200');
  });
});

describe('searchText', () => {
  it('is the trimmed text of the address, cut to 200 characters', () => {
    expect(searchText('  kuzey ')).toBe('kuzey');
    expect(searchText(['a', 'b'])).toBe('a');
    expect(searchText(undefined)).toBe('');
    expect(searchText('x'.repeat(250))).toHaveLength(200);
  });
});
