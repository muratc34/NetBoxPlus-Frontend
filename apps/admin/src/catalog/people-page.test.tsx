import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { catalogUrl, locationOf, problem, renderApp, server, signInWith } from '../test/render';
import { pageOf, searchDelayMs } from '../components/address-search';

function person(index: number, photo = false) {
  return {
    id: `0195f0e0-0000-7000-8000-${String(index).padStart(12, '0')}`,
    name: `Person ${String(index)}`,
    biography: null,
    translations: {},
    photoUrl: photo ? `https://images.test/${String(index)}.jpg` : null,
  };
}

/** Answers the list and keeps each query string asked. */
function answerPeople(totalCount = 2) {
  const asked: string[] = [];
  server.use(
    http.get(`${catalogUrl}/people`, ({ request }) => {
      const url = new URL(request.url);
      asked.push(url.search);
      const page = Number(url.searchParams.get('page'));
      return HttpResponse.json({
        items: [person(page * 10 + 1, true), person(page * 10 + 2)],
        pageNumber: page,
        pageSize: 20,
        totalCount,
      });
    }),
  );
  return asked;
}

describe('PeoplePage', () => {
  it('lists the people with their photos, linking each', async () => {
    signInWith();
    const asked = answerPeople();
    renderApp('/people');

    const list = await within(await screen.findByRole('main')).findByRole('list');
    expect(document.title).toBe('Kişiler');
    const links = within(list).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Person 11', 'Person 12']);
    expect(links[0]).toHaveAttribute('href', `/people/${person(11).id}`);
    expect(links[0]?.querySelector('img')).toHaveAttribute('src', 'https://images.test/11.jpg');
    expect(links[1]?.querySelector('img')).toBeNull();
    expect(asked).toEqual(['?page=1&pageSize=20']);
    expect(screen.queryByRole('navigation', { name: 'Sayfalar' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Yeni kişi' })).toHaveAttribute('href', '/people/new');
  });

  it('offers no new person without the write permission', async () => {
    signInWith(['catalog:people:read']);
    answerPeople();
    renderApp('/people');

    await within(await screen.findByRole('main')).findByRole('list');
    expect(screen.queryByRole('link', { name: 'Yeni kişi' })).not.toBeInTheDocument();
  });

  it('searches once typing rests, from the first page', async () => {
    signInWith();
    const asked = answerPeople(45);
    const { router } = renderApp('/people?page=2');

    await within(await screen.findByRole('main')).findByRole('list');
    await userEvent.type(screen.getByLabelText('Ada göre ara'), ' Ada ');

    await waitFor(() => {
      expect(locationOf(router)).toBe('/people?search=Ada');
    });
    await waitFor(() => {
      expect(asked).toContain('?search=Ada&page=1&pageSize=20');
    });
    expect(asked.filter((query) => query.includes('search'))).toEqual(['?search=Ada&page=1&pageSize=20']);

    await userEvent.clear(screen.getByLabelText('Ada göre ara'));
    await waitFor(() => {
      expect(locationOf(router)).toBe('/people');
    });
    await waitFor(() => {
      expect(asked.at(-1)).toBe('?page=1&pageSize=20');
    });
  });

  it('starts from the search and page in the address and moves between pages', async () => {
    signInWith();
    const asked = answerPeople(45);
    const { router } = renderApp('/people?search=Ada&page=2');

    const pages = await screen.findByRole('navigation', { name: 'Sayfalar' });
    expect(screen.getByLabelText('Ada göre ara')).toHaveValue('Ada');
    expect(asked).toEqual(['?search=Ada&page=2&pageSize=20']);
    expect(pages).toHaveTextContent('2 / 3');
    // The search box starting from the address changes nothing by itself.
    await new Promise((resolve) => setTimeout(resolve, searchDelayMs + 100));
    expect(locationOf(router)).toBe('/people?search=Ada&page=2');

    await userEvent.click(within(pages).getByRole('button', { name: 'Sonraki' }));
    await waitFor(() => {
      expect(locationOf(router)).toBe('/people?search=Ada&page=3');
    });
    expect(await within(pages).findByText('3 / 3')).toBeInTheDocument();
    expect(within(pages).getByRole('button', { name: 'Sonraki' })).toBeDisabled();

    await userEvent.click(within(pages).getByRole('button', { name: 'Önceki' }));
    await userEvent.click(await within(pages).findByRole('button', { name: 'Önceki' }));
    await waitFor(() => {
      expect(locationOf(router)).toBe('/people?search=Ada&page=1');
    });
    expect(within(pages).getByRole('button', { name: 'Önceki' })).toBeDisabled();
  });

  it('pages without a search', async () => {
    signInWith();
    answerPeople(21);
    const { router } = renderApp('/people');

    const pages = await screen.findByRole('navigation', { name: 'Sayfalar' });
    expect(pages).toHaveTextContent('1 / 2');
    await userEvent.click(within(pages).getByRole('button', { name: 'Sonraki' }));
    await waitFor(() => {
      expect(locationOf(router)).toBe('/people?page=2');
    });
  });

  it('says when nobody matches and when the list cannot be read', async () => {
    signInWith();
    server.use(
      http.get(`${catalogUrl}/people`, () =>
        HttpResponse.json({ items: [], pageNumber: 1, pageSize: 20, totalCount: 0 }),
      ),
    );
    const first = renderApp('/people');
    expect(await screen.findByText('Kişi bulunamadı.')).toBeInTheDocument();
    first.unmount();

    server.use(http.get(`${catalogUrl}/people`, () => problem(403, 'Auth.Forbidden')));
    renderApp('/people');
    expect(await screen.findByRole('alert', {}, { timeout: 5000 })).toBeInTheDocument();
  });
});

describe('pageOf', () => {
  it('takes a whole page number from 1 and 1 for anything else', () => {
    expect(pageOf('3')).toBe(3);
    expect(pageOf('1')).toBe(1);
    expect(pageOf(null)).toBe(1);
    expect(pageOf('0')).toBe(1);
    expect(pageOf('-2')).toBe(1);
    expect(pageOf('2.5')).toBe(1);
    expect(pageOf('x')).toBe(1);
  });
});
