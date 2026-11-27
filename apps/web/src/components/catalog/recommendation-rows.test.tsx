import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { title, titlePage } from '../../test/catalog';
import { gatewayUrl, problem, renderPage, server, signInAs, watchingProfile } from '../../test/render';
import { moreLikeRowCount, PersonalRows, recommendationRowLength } from './personal-rows';

const profileUrl = `${gatewayUrl}/streaming/profiles/${watchingProfile.id}`;

/** A profile with nothing to continue and an empty list, so only the recommendation rows can show. */
function emptyRows(taste: { like: string[]; unlike: string[]; seen: string[] }) {
  return [
    http.get(`${profileUrl}/continue-watching`, () => HttpResponse.json([])),
    http.get(`${profileUrl}/my-list`, () => HttpResponse.json([])),
    http.get(`${profileUrl}/taste`, () => HttpResponse.json(taste)),
    http.get(`${gatewayUrl}/catalog/titles`, ({ request }) => {
      const ids = new URL(request.url).searchParams.getAll('ids');
      return HttpResponse.json(titlePage(ids.map((id) => title(Number(id.slice(-12)), { id }))));
    }),
  ];
}

describe('PersonalRows recommendations', () => {
  it("recommends from the taste within the profile's age, and draws a row like each of the most liked", async () => {
    signInAs({ ...watchingProfile, maxAgeRating: 'Age13' });
    const [loved, liked, watched, disliked, seen] = [
      title(1).id,
      title(2).id,
      title(3).id,
      title(4).id,
      title(5).id,
    ];
    let recommended: URLSearchParams | undefined;
    const similar: string[] = [];
    server.use(
      ...emptyRows({ like: [loved, liked, watched], unlike: [disliked], seen: [seen] }),
      http.get(`${gatewayUrl}/catalog/titles/recommended`, ({ request }) => {
        recommended = new URL(request.url).searchParams;
        return HttpResponse.json(titlePage([title(10), title(11)]));
      }),
      http.get(`${gatewayUrl}/catalog/titles/:id/similar`, ({ params }) => {
        similar.push(String(params.id));
        return HttpResponse.json(titlePage([title(20 + similar.length)]));
      }),
    );

    renderPage(<PersonalRows />);

    // The skeleton's section gives way to the row's own: looked up again on every try.
    await waitFor(() => {
      expect(within(screen.getByRole('region', { name: 'Senin için' })).getAllByRole('link')).toHaveLength(2);
    });
    expect(recommended?.getAll('like')).toEqual([loved, liked, watched]);
    expect(recommended?.getAll('unlike')).toEqual([disliked]);
    expect(recommended?.getAll('exclude')).toEqual([seen]);
    expect(recommended?.get('maxAgeRating')).toBe('Age13');
    expect(recommended?.get('pageSize')).toBe(String(recommendationRowLength));

    // One row for each of the most liked, named after it.
    expect(moreLikeRowCount).toBe(2);
    await screen.findByRole('region', { name: 'Title 1 gibileri' });
    await screen.findByRole('region', { name: 'Title 2 gibileri' });
    expect([...similar].sort()).toEqual([loved, liked].sort());
    expect(screen.queryByRole('region', { name: 'Title 3 gibileri' })).not.toBeInTheDocument();
  });

  it('draws no row like the only liked title, which would repeat "For you"', async () => {
    signInAs();
    const only = title(1).id;
    let similarAsked = false;
    server.use(
      ...emptyRows({ like: [only], unlike: [], seen: [] }),
      http.get(`${gatewayUrl}/catalog/titles/recommended`, () => HttpResponse.json(titlePage([title(10)]))),
      http.get(`${gatewayUrl}/catalog/titles/:id/similar`, () => {
        similarAsked = true;
        return HttpResponse.json(titlePage([title(11)]));
      }),
    );

    renderPage(<PersonalRows />);
    await screen.findByRole('link', { name: /Title 10/ });

    expect(similarAsked).toBe(false);
    expect(screen.queryByRole('region', { name: 'Title 1 gibileri' })).not.toBeInTheDocument();
  });

  it('recommends nothing to a profile without a taste', async () => {
    signInAs();
    let asked = false;
    server.use(
      ...emptyRows({ like: [], unlike: [], seen: [] }),
      http.get(`${gatewayUrl}/catalog/titles/recommended`, () => {
        asked = true;
        return HttpResponse.json(titlePage([title(10)]));
      }),
    );

    const { container } = renderPage(<PersonalRows />);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(asked).toBe(false);
    expect(container).toBeEmptyDOMElement();
  });

  it('leaves the recommendations out while search is down', { timeout: 10_000 }, async () => {
    signInAs();
    let asked = 0;
    server.use(
      ...emptyRows({ like: [title(1).id, title(2).id], unlike: [], seen: [] }),
      http.get(`${gatewayUrl}/catalog/titles/recommended`, () => {
        asked++;
        return problem(503, 'Search.Unavailable');
      }),
      http.get(`${gatewayUrl}/catalog/titles/:id/similar`, () => {
        asked++;
        return problem(503, 'Search.Unavailable');
      }),
    );

    const { container } = renderPage(<PersonalRows />);

    // A 5xx is tried again twice (the query client's rule) before the rows give up: three asks for each of
    // the three rows.
    await waitFor(
      () => {
        expect(asked).toBe(9);
        expect(container).toBeEmptyDOMElement();
      },
      { timeout: 8000 },
    );
  });
});
