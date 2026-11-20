import { createTranslator } from '@netboxplus/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { title, titlePage } from '../../test/catalog';
import { gatewayUrl, renderPage, server, signInAs, watchingProfile } from '../../test/render';
import { myListRowLength, PersonalRows, progressOf } from './personal-rows';

const t = createTranslator('tr');
const profileUrl = `${gatewayUrl}/streaming/profiles/${watchingProfile.id}`;

function catalogById() {
  return http.get(`${gatewayUrl}/catalog/titles`, ({ request }) => {
    const ids = new URL(request.url).searchParams.getAll('ids');
    // Catalog lists in its own order; the rows keep Streaming's.
    return HttpResponse.json(titlePage([...ids].reverse().map((id) => title(Number(id.slice(-12)), { id }))));
  });
}

describe('progressOf', () => {
  const item = { titleId: 't', contentId: 'c', updatedAt: 'x' };

  it('says the time left and how far it is', () => {
    expect(progressOf({ ...item, kind: 'Movie', positionSeconds: 1800, durationSeconds: 6480 }, t)).toEqual({
      fraction: 1800 / 6480,
      label: '1 sa 18 dk kaldı',
    });
    expect(progressOf({ ...item, kind: 'Movie', positionSeconds: 12, durationSeconds: 30 }, t).label).toBe(
      '1 dk kaldı',
    );
  });

  it('rounds the time left up to a whole minute', () => {
    expect(
      progressOf({ ...item, kind: 'Movie', positionSeconds: 1700, durationSeconds: 1800 }, t).label,
    ).toBe('2 dk kaldı');
  });

  it("calls a series' episode not started yet the next one, not a movie", () => {
    expect(progressOf({ ...item, kind: 'Movie', positionSeconds: 0, durationSeconds: 1500 }, t).label).toBe(
      '25 dk kaldı',
    );
    expect(progressOf({ ...item, kind: 'Series', positionSeconds: 0, durationSeconds: 1500 }, t)).toEqual({
      fraction: 0,
      label: 'Sıradaki bölüm',
    });
  });

  it('copes with an unknown length', () => {
    expect(progressOf({ ...item, kind: 'Movie', positionSeconds: 5, durationSeconds: 0 }, t).fraction).toBe(
      0,
    );
  });
});

describe('PersonalRows', () => {
  it('shows nothing without a signed-in profile', async () => {
    const { container } = renderPage(<PersonalRows />);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(container).toBeEmptyDOMElement();
  });

  it("shows what the profile was watching, in Streaming's order, then its list", async () => {
    signInAs();
    const one = title(1).id;
    const two = title(2).id;
    server.use(
      http.get(`${profileUrl}/continue-watching`, () =>
        HttpResponse.json([
          {
            titleId: one,
            kind: 'Series',
            contentId: 'e',
            positionSeconds: 0,
            durationSeconds: 1500,
            updatedAt: 'x',
          },
          {
            titleId: two,
            kind: 'Movie',
            contentId: two,
            positionSeconds: 600,
            durationSeconds: 1800,
            updatedAt: 'x',
          },
        ]),
      ),
      http.get(`${profileUrl}/my-list`, () =>
        HttpResponse.json([{ titleId: two, kind: 'Movie', addedAt: 'x' }]),
      ),
      catalogById(),
    );

    renderPage(<PersonalRows />);
    // Each row asks Catalog for its own titles: wait until both have them.
    await waitFor(() => {
      expect(screen.getAllByRole('link', { name: /Title 2/ })).toHaveLength(2);
    });

    const watching = screen.getByRole('region', { name: 'İzlemeye devam et' });
    expect(
      within(watching)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([
      expect.stringMatching(/^Title 1Sıradaki bölüm2024/),
      expect.stringMatching(/^Title 220 dk kaldı2024/),
    ]);
    // Going on opens the player at the movie or episode.
    expect(
      within(watching)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual([`/tr/watch/${one}?episode=e`, `/tr/watch/${two}`]);
    const list = screen.getByRole('region', { name: 'Listem' });
    expect(
      within(list)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([expect.stringMatching(/^Title 22024/)]);
    expect(within(list).getByRole('link')).toHaveAttribute('href', `/tr/movies/${two}`);
  });

  it('leaves out empty rows, and shows at most twenty of the list', async () => {
    signInAs();
    const ids = Array.from({ length: myListRowLength + 5 }, (_, index) => title(index + 1).id);
    let asked: string[] = [];
    server.use(
      http.get(`${profileUrl}/continue-watching`, () => HttpResponse.json([])),
      http.get(`${profileUrl}/my-list`, () =>
        HttpResponse.json(ids.map((id) => ({ titleId: id, kind: 'Movie', addedAt: 'x' }))),
      ),
      http.get(`${gatewayUrl}/catalog/titles`, ({ request }) => {
        asked = new URL(request.url).searchParams.getAll('ids');
        return HttpResponse.json(titlePage(asked.map((id) => title(Number(id.slice(-12)), { id }))));
      }),
    );

    renderPage(<PersonalRows />);
    await waitFor(() => {
      const list = screen.getByRole('region', { name: 'Listem' });
      expect(within(list).getAllByRole('link')).toHaveLength(myListRowLength);
    });
    expect(asked).toEqual(ids.slice(0, myListRowLength));
    expect(screen.queryByRole('region', { name: 'İzlemeye devam et' })).not.toBeInTheDocument();
  });
});
