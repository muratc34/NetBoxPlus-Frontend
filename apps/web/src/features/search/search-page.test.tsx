import { fireEvent, screen, waitFor, within } from '@testing-library/react';
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

function catalog(results: ReturnType<typeof titlePage>, suggestions = results.items) {
  const asked = { search: [] as string[], suggest: [] as string[] };
  server.use(
    http.get(`${gatewayUrl}/catalog/search`, ({ request }) => {
      asked.search.push(new URL(request.url).search);
      return HttpResponse.json(results);
    }),
    http.get(`${gatewayUrl}/catalog/search/suggest`, ({ request }) => {
      asked.suggest.push(new URL(request.url).search);
      return HttpResponse.json(suggestions);
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

    expect(screen.getByRole('combobox')).toHaveValue('kuzey');
    expect(screen.getByText('1 sonuç')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Title 1/ })).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(asked.search).toEqual([]);
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('follows the typing: the address, the results and the suggestions, within the age limit', async () => {
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

    await userEvent.setup().type(screen.getByRole('combobox'), 'gece');

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenLastCalledWith('/tr/search?q=gece', { scroll: false });
    });
    expect(await screen.findByText('2 sonuç')).toBeInTheDocument();
    const suggestions = await screen.findByRole('listbox', { name: 'Öneriler' });
    expect(within(suggestions).getAllByRole('option')).toHaveLength(2);
    expect(asked.search.at(-1)).toBe('?q=gece&lang=tr&maxAgeRating=Age7&page=1');
    expect(asked.suggest.at(-1)).toBe('?q=gece&lang=tr&maxAgeRating=Age7');
  });

  it('moves through the suggestions with the arrows and opens one with Enter', async () => {
    catalog(titlePage([title(1)]), [title(1), title(2, { kind: 'Series' })]);
    search();
    const user = userEvent.setup();
    const box = screen.getByRole('combobox');

    await user.type(box, 'ti');
    await screen.findAllByRole('option');
    await user.keyboard('{ArrowDown}{ArrowDown}');

    const second = screen.getAllByRole('option')[1];
    expect(second).toHaveAttribute('aria-selected', 'true');
    expect(box).toHaveAttribute('aria-activedescendant', second?.id);

    await user.keyboard('{ArrowDown}');
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowUp}{Enter}');

    expect(navigation.push).toHaveBeenCalledWith(`/tr/series/${title(2).id}`);
  });

  it('closes the suggestions with Escape, and opens one chosen with the pointer', async () => {
    catalog(titlePage([title(1)]));
    search();
    const user = userEvent.setup();

    await user.type(screen.getByRole('combobox'), 'ti');
    await screen.findAllByRole('option');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');

    await user.type(screen.getByRole('combobox'), 'x');
    // The box keeps its focus (the list would close on blur before the choice).
    expect(fireEvent.mouseDown(await screen.findByRole('option'))).toBe(false);

    expect(navigation.push).toHaveBeenCalledWith(`/tr/movies/${title(1).id}`);
  });

  it('goes back to the genres when the box is emptied', async () => {
    catalog(titlePage([title(1)]));
    search({ initialQuery: 'gece', firstPage: titlePage([title(1)]) });

    await userEvent.setup().clear(screen.getByRole('combobox'));

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenLastCalledWith('/tr/search', { scroll: false });
    });
    expect(screen.getByRole('link', { name: 'Komedi' })).toBeInTheDocument();
  });

  it('says when nothing was found', async () => {
    catalog(titlePage([]), []);
    search();

    await userEvent.setup().type(screen.getByRole('combobox'), 'zzz');

    expect(await screen.findByText('"zzz" için sonuç bulunamadı.')).toBeInTheDocument();
  });

  it('says so when search is down, from the server or the browser', async () => {
    const { unmount } = search({ initialQuery: 'gece', unavailable: true });
    expect(screen.getByRole('alert')).toHaveTextContent('Arama şu an kullanılamıyor.');
    unmount();

    server.use(
      http.get(`${gatewayUrl}/catalog/search`, () => problem(503, 'Search.Unavailable')),
      http.get(`${gatewayUrl}/catalog/search/suggest`, () => problem(503, 'Search.Unavailable')),
    );
    search();
    await userEvent.setup().type(screen.getByRole('combobox'), 'gece');

    expect(await screen.findByRole('alert', {}, { timeout: 5000 })).toHaveTextContent(
      'Arama şu an kullanılamıyor.',
    );
  });

  it('stops at what Catalog accepts', () => {
    search();

    expect(screen.getByRole('combobox')).toHaveAttribute('maxLength', '200');
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
