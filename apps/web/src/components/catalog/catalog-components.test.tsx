import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { comedy, drama, title, titlePage } from '../../test/catalog';
import { bringIntoView } from '../../test/observers';
import { gatewayUrl, problem, renderPage, server, signedOut } from '../../test/render';
import { Billboard } from './billboard';
import { BrowseFilters } from './browse-filters';
import { LazyTitleRow } from './lazy-title-row';
import { TitleCard } from './title-card';
import { TitleGrid } from './title-grid';
import { TitleImage } from './title-image';
import { TitleRow } from './title-row';

describe('TitleCard', () => {
  it("opens the title's page and tells its year, rating and genres", () => {
    renderPage(<TitleCard title={title(1, { kind: 'Series', genres: [drama, comedy] })} />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/tr/series/0195f0e0-0000-7000-8000-000000000001');
    expect(link).toHaveTextContent('Title 1');
    expect(link).toHaveTextContent('2024');
    expect(link).toHaveTextContent('Yaş sınırı: 13+');
    expect(link).toHaveTextContent('Dram, Komedi');
  });

  it('shows the title on a tile when there is no image', () => {
    renderPage(<TitleCard title={title(2, { backdropUrl: null, posterUrl: null })} />, 'en');

    expect(screen.queryByRole('img', { hidden: true })).not.toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/en/movies/0195f0e0-0000-7000-8000-000000000002',
    );
  });

  it('falls back to the poster when there is no wide image', () => {
    const { container } = renderPage(
      <TitleCard title={title(3, { backdropUrl: null, posterUrl: 'http://storage.test/poster.png' })} />,
    );

    expect(container.querySelector('img')).toHaveAttribute('src', 'http://storage.test/poster.png');
  });

  it("has a Catalog image resized through the web app's /media route to a card's width", () => {
    const name = '01a1d602b78a700baf02a83be30c9a09.jpg';
    const { container } = renderPage(
      <TitleCard
        title={title(4, { backdropUrl: `http://127.0.0.1:10000/devstoreaccount1/images/${name}` })}
      />,
    );

    const image = container.querySelector('img');
    expect(image?.getAttribute('src')?.startsWith(`/_next/image?url=%2Fmedia%2F${name}&w=`)).toBe(true);
    expect(image?.getAttribute('srcset')).toContain(`url=%2Fmedia%2F${name}&w=640`);
    expect(image).toHaveAttribute(
      'sizes',
      '(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw',
    );
    expect(image).toHaveAttribute('loading', 'lazy');
  });
});

describe('TitleRow', () => {
  const stored = (n: number) =>
    title(n, {
      backdropUrl: `http://127.0.0.1:10000/devstoreaccount1/images/${String(n).padStart(32, '0')}.png`,
    });

  it("asks the optimizer for a row card's width, a ranked card's narrower", () => {
    const { container, unmount } = renderPage(<TitleRow heading="Yeni" titles={[stored(1)]} />);
    expect(container.querySelector('img')?.getAttribute('sizes')).toMatch(/, 70vw$/);
    unmount();

    const ranked = renderPage(<TitleRow heading="Top" titles={[stored(1)]} ranked />);
    expect(ranked.container.querySelector('img')?.getAttribute('sizes')).toMatch(/, 55vw$/);
  });

  it('lists the titles under its heading', () => {
    renderPage(<TitleRow heading="Yeni eklenenler" titles={[title(1), title(2)]} />);

    const row = screen.getByRole('region', { name: 'Yeni eklenenler' });
    expect(within(row).getByRole('heading', { name: 'Yeni eklenenler' })).toBeInTheDocument();
    expect(
      within(row)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([expect.stringContaining('Title 1'), expect.stringContaining('Title 2')]);
  });

  it('reads out the rank before each title of a Top 10', () => {
    renderPage(<TitleRow heading="Top" titles={[title(1), title(2)]} ranked />, 'en');

    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      expect.stringMatching(/^Number 1: Title 1/),
      expect.stringMatching(/^Number 2: Title 2/),
    ]);
  });
});

describe('LazyTitleRow', () => {
  const filter = { lang: 'tr', genreId: drama.id, sort: 'Popular', maxAgeRating: 'Age7' } as const;

  it('asks for its titles only when it comes near the screen', async () => {
    const asked: string[] = [];
    server.use(
      http.get(`${gatewayUrl}/catalog/titles`, ({ request }) => {
        asked.push(new URL(request.url).search);
        return HttpResponse.json(titlePage([title(5)]));
      }),
    );
    renderPage(<LazyTitleRow heading="Dram" filter={filter} />);

    expect(screen.getByRole('region', { name: 'Dram' })).toHaveAttribute('aria-busy', 'true');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(asked).toHaveLength(0);

    bringIntoView();

    expect(await screen.findByRole('link', { name: /Title 5/ })).toBeInTheDocument();
    expect(asked).toEqual([`?lang=tr&genreId=${drama.id}&sort=Popular&maxAgeRating=Age7&page=1`]);
  });

  it('disappears when the genre has nothing to show', async () => {
    server.use(http.get(`${gatewayUrl}/catalog/titles`, () => HttpResponse.json(titlePage([]))));
    renderPage(<LazyTitleRow heading="Dram" filter={filter} />);

    bringIntoView();

    await waitFor(() => {
      expect(screen.queryByRole('region', { name: 'Dram' })).not.toBeInTheDocument();
    });
  });

  it('says so when the row cannot be loaded', async () => {
    server.use(http.get(`${gatewayUrl}/catalog/titles`, () => problem(400, 'Validation.Failed')));
    renderPage(<LazyTitleRow heading="Dram" filter={filter} />);

    bringIntoView();

    expect(await screen.findByText('Bu satır yüklenemedi.')).toBeInTheDocument();
  });
});

describe('TitleGrid', () => {
  const filter = { lang: 'tr', kind: 'Movie', sort: 'Newest' } as const;

  it('loads the images of the first screen at once and the rest lazily', () => {
    const titles = Array.from({ length: 12 }, (_, index) => title(index + 1));
    const { container } = renderPage(
      <TitleGrid filter={filter} firstPage={titlePage(titles)} pathname="/tr/movies" query={{}} />,
    );

    expect([...container.querySelectorAll('img')].map((image) => image.getAttribute('loading'))).toEqual([
      ...Array<string>(10).fill('eager'),
      'lazy',
      'lazy',
    ]);
  });

  it("shows the server's page, links to the next one, and loads it in place", async () => {
    const asked: (string | null)[] = [];
    server.use(
      http.get(`${gatewayUrl}/catalog/titles`, ({ request }) => {
        asked.push(new URL(request.url).searchParams.get('page'));
        return HttpResponse.json(titlePage([title(3)], 2, 3, 2));
      }),
    );
    renderPage(
      <TitleGrid
        filter={filter}
        firstPage={titlePage([title(1), title(2)], 1, 3, 2)}
        pathname="/tr/movies"
        query={{ sort: 'Newest' }}
      />,
    );

    const more = screen.getByRole('link', { name: 'Daha fazla göster' });
    expect(more).toHaveAttribute('href', '/tr/movies?sort=Newest&page=2');

    // Loaded in place: the browser does not follow the link.
    expect(fireEvent.click(more)).toBe(false);

    expect(await screen.findByRole('link', { name: /Title 3/ })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryByRole('link', { name: 'Daha fazla göster' })).not.toBeInTheDocument();
    expect(asked).toEqual(['2']);
  });

  it('loads the next page as its end comes near', async () => {
    server.use(
      http.get(`${gatewayUrl}/catalog/titles`, () => HttpResponse.json(titlePage([title(3)], 2, 3, 2))),
    );
    renderPage(
      <TitleGrid
        filter={filter}
        firstPage={titlePage([title(1), title(2)], 1, 3, 2)}
        pathname="/tr/movies"
        query={{}}
      />,
    );

    bringIntoView();

    expect(await screen.findByRole('link', { name: /Title 3/ })).toBeInTheDocument();
  });

  it('says when there is nothing to list', () => {
    renderPage(<TitleGrid filter={filter} firstPage={titlePage([])} pathname="/tr/movies" query={{}} />);

    expect(screen.getByText('Burada henüz bir şey yok.')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('Billboard', () => {
  it('names the title and leads to its page, its image loading first', () => {
    server.use(signedOut);
    const { container } = renderPage(<Billboard title={title(7, { title: 'Kuzey Işığı' })} />, 'tr', {
      withProfiles: true,
    });

    expect(screen.getByRole('heading', { level: 2, name: 'Kuzey Işığı' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Daha fazla bilgi' })).toHaveAttribute(
      'href',
      '/tr/movies/0195f0e0-0000-7000-8000-000000000007',
    );
    expect(container.querySelector('img')).toHaveAttribute('loading', 'eager');
  });
});

describe('BrowseFilters', () => {
  it('links every genre and sort to its own address, marking the current ones', () => {
    renderPage(
      <BrowseFilters pathname="/tr/series" genres={[drama, comedy]} genreId={comedy.id} sort="Newest" />,
    );

    const genres = within(screen.getByRole('navigation', { name: 'Türler' })).getAllByRole('link');
    expect(genres.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Tümü', '/tr/series?sort=Newest'],
      ['Dram', `/tr/series?genre=${drama.id}&sort=Newest`],
      ['Komedi', `/tr/series?genre=${comedy.id}&sort=Newest`],
    ]);
    expect(screen.getByRole('link', { name: 'Komedi' })).toHaveAttribute('aria-current', 'page');

    const sorts = within(screen.getByRole('navigation', { name: 'Sıralama' })).getAllByRole('link');
    expect(sorts.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Popüler', `/tr/series?genre=${comedy.id}`],
      ['Yeni', `/tr/series?genre=${comedy.id}&sort=Newest`],
    ]);
    expect(screen.getByRole('link', { name: 'Yeni' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('TitleImage', () => {
  it("draws the page's largest paint across the screen and loads it first", () => {
    const { container } = renderPage(
      <TitleImage
        url="http://127.0.0.1:10000/devstoreaccount1/images/01a1d602b78a700baf02a83be30c9a09.png"
        title="Kuzey Işığı"
        priority
      />,
    );

    const image = container.querySelector('img');
    expect(image).toHaveAttribute('sizes', '100vw');
    expect(image).toHaveAttribute('loading', 'eager');
    expect(image).toHaveAttribute('fetchpriority', 'high');
    expect(image?.getAttribute('srcset')).toContain('w=1920');
  });
});
