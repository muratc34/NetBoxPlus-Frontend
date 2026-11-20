import { createTranslator } from '@netboxplus/i18n';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { series } from '../../test/catalog';
import { gatewayUrl, renderPage, server, signInAs, watchingProfile } from '../../test/render';
import { EpisodeList } from './episode-list';
import { MovieProgress, timeLeft } from './title-progress';

const t = createTranslator('en');
const view = { contentId: 'c', updatedAt: 'x' };

describe('timeLeft', () => {
  it('is the time left of something started and not finished', () => {
    expect(timeLeft({ ...view, positionSeconds: 600, durationSeconds: 6480, completed: false }, t)).toBe(
      '1h 38m left',
    );
    expect(timeLeft({ ...view, positionSeconds: 29, durationSeconds: 30, completed: false }, t)).toBe(
      '1m left',
    );
  });

  it('is nothing for something not started, finished, or not watched at all', () => {
    expect(
      timeLeft({ ...view, positionSeconds: 0, durationSeconds: 30, completed: false }, t),
    ).toBeUndefined();
    expect(
      timeLeft({ ...view, positionSeconds: 30, durationSeconds: 30, completed: true }, t),
    ).toBeUndefined();
    expect(timeLeft(undefined, t)).toBeUndefined();
  });
});

describe('MovieProgress', () => {
  it('says how much of the movie the profile has left', async () => {
    signInAs();
    server.use(
      http.get(`${gatewayUrl}/streaming/profiles/${watchingProfile.id}/progress`, ({ request }) =>
        HttpResponse.json(
          new URL(request.url).searchParams.get('titleId') === 'm1'
            ? [
                {
                  contentId: 'm1',
                  positionSeconds: 4980,
                  durationSeconds: 6480,
                  completed: false,
                  updatedAt: 'x',
                },
              ]
            : [],
        ),
      ),
    );

    renderPage(<MovieProgress titleId="m1" />, 'tr');

    expect(await screen.findByText('25 dk kaldı')).toBeInTheDocument();
  });

  it('says nothing to a visitor', async () => {
    const { container } = renderPage(<MovieProgress titleId="m1" />);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(container).toBeEmptyDOMElement();
  });
});

describe('EpisodeList progress', () => {
  it('marks the episodes the profile has watched or started', async () => {
    signInAs();
    server.use(
      http.get(`${gatewayUrl}/streaming/profiles/${watchingProfile.id}/progress`, () =>
        HttpResponse.json([
          { contentId: 'e11', positionSeconds: 3660, durationSeconds: 3660, completed: true, updatedAt: 'x' },
          { contentId: 'e12', positionSeconds: 300, durationSeconds: 1500, completed: false, updatedAt: 'x' },
        ]),
      ),
    );

    renderPage(<EpisodeList seriesId={series.id} seasons={series.seasons} />, 'en');

    expect(await screen.findByText('Watched')).toBeInTheDocument();
    expect(screen.getByText('20m left')).toBeInTheDocument();
  });
});
