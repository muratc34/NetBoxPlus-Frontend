import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { gatewayUrl, problem, renderPage, server, signInAs, watchingProfile } from '../../test/render';
import { RatingButton } from './rating-button';

const titleId = '0195f0e0-0000-7000-8000-000000000007';
const ratingUrl = `${gatewayUrl}/streaming/profiles/${watchingProfile.id}/ratings/${titleId}`;

/** A rating Streaming keeps, changed by PUT and DELETE; every request is written down. */
function streamingRating(initial: string | null) {
  let rating = initial;
  const sent: string[] = [];
  server.use(
    http.get(ratingUrl, () => {
      sent.push('GET');
      return HttpResponse.json({ rating });
    }),
    http.put(ratingUrl, async ({ request }) => {
      rating = ((await request.json()) as { rating: string }).rating;
      sent.push(`PUT ${rating}`);
      return new HttpResponse(null, { status: 204 });
    }),
    http.delete(ratingUrl, () => {
      rating = null;
      sent.push('DELETE');
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return sent;
}

describe('RatingButton', () => {
  it('is not there without a signed-in profile', async () => {
    const { container } = renderPage(<RatingButton titleId={titleId} title="Kuzey" variant="hero" />);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(container).toBeEmptyDOMElement();
  });

  it("names the rating on a title's page, changes it and takes it back", async () => {
    signInAs();
    const sent = streamingRating('Like');
    const user = userEvent.setup();
    renderPage(<RatingButton titleId={titleId} title="Kuzey" variant="hero" />);

    const button = await screen.findByRole('button', { name: 'Kuzey: değerlendir: Beğendim' });
    await user.click(button);
    expect(screen.getByRole('menuitemradio', { name: /Beğendim/ })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('menuitemradio', { name: /Bayıldım/ }));

    await screen.findByRole('button', { name: 'Kuzey: değerlendir: Bayıldım' });
    await user.click(screen.getByRole('button', { name: /Kuzey: değerlendir/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Değerlendirmeyi kaldır' }));

    await screen.findByRole('button', { name: 'Kuzey: değerlendir' });
    await waitFor(() => {
      expect(sent.filter((request) => request !== 'GET')).toEqual(['PUT Love', 'DELETE']);
    });
  });

  it('asks for the rating on a card only when its menu opens, and offers no removal before one', async () => {
    signInAs();
    const sent = streamingRating(null);
    const user = userEvent.setup();
    renderPage(<RatingButton titleId={titleId} title="Kuzey" variant="card" />);

    const button = await screen.findByRole('button', { name: 'Kuzey: değerlendir' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(sent).toEqual([]);

    await user.click(button);
    await waitFor(() => {
      expect(sent).toEqual(['GET']);
    });
    expect(screen.queryByRole('menuitem', { name: 'Değerlendirmeyi kaldır' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitemradio', { name: /Bana göre değil/ }));

    await waitFor(() => {
      expect(sent).toContain('PUT NotForMe');
    });
  });

  it("says why Streaming refused, and keeps the profile's rating as it was", async () => {
    signInAs();
    streamingRating(null);
    server.use(http.put(ratingUrl, () => problem(403, 'Playback.AgeRestricted')));
    const user = userEvent.setup();
    renderPage(<RatingButton titleId={titleId} title="Kuzey" variant="hero" />);

    await user.click(await screen.findByRole('button', { name: 'Kuzey: değerlendir' }));
    await user.click(screen.getByRole('menuitemradio', { name: /Beğendim/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bu başlık bu profilin yaş sınırının üstünde.',
    );
    expect(screen.getByRole('button', { name: 'Kuzey: değerlendir' })).toBeInTheDocument();
  });
});
