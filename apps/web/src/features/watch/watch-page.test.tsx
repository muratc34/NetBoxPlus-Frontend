import { screen, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { movie, series } from '../../test/catalog';
import { gatewayUrl, navigation, renderPage, server, signInAs, watchingProfile } from '../../test/render';
import { orderEpisodes } from './episodes';
import type { Player } from './player';
import { WatchPage, type WatchTitle } from './watch-page';

const shown = vi.hoisted(() => ({ props: [] as Parameters<typeof Player>[0][] }));

vi.mock('./player', () => ({
  Player: (props: Parameters<typeof Player>[0]) => {
    shown.props.push(props);
    return (
      <button type="button" onClick={props.onFinished}>
        playing {props.contentId}
      </button>
    );
  },
}));

const film: WatchTitle = { id: movie.id, kind: 'Movie', title: movie.title, episodes: [] };
const show: WatchTitle = {
  id: series.id,
  kind: 'Series',
  title: series.title,
  episodes: orderEpisodes(series.seasons),
};

function progress(views: object[]) {
  const asked: string[] = [];
  server.use(
    http.get(`${gatewayUrl}/streaming/profiles/${watchingProfile.id}/progress`, ({ request }) => {
      asked.push(new URL(request.url).searchParams.get('titleId') ?? '');
      return HttpResponse.json(views);
    }),
  );
  return asked;
}

const last = () => shown.props.at(-1);

describe('WatchPage', () => {
  it('sends a visitor without a session to sign in, coming back to the same episode', async () => {
    navigation.pathname = `/tr/watch/${series.id}`;
    navigation.search = new URLSearchParams({ episode: 'e12', from: 'start' });
    renderPage(<WatchPage title={show} episodeId="e12" fromStart />);

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith(
        `/tr/sign-in?next=${encodeURIComponent(`/tr/watch/${series.id}?episode=e12&from=start`)}`,
      );
    });
    expect(screen.getByRole('status')).toHaveTextContent('Yükleniyor…');
    expect(shown.props).toHaveLength(0);
  });

  it('waits for the session before sending anyone away', async () => {
    signInAs();
    server.use(
      http.get(`${gatewayUrl}/session`, async () => {
        await delay(80);
        return HttpResponse.json({
          userId: 'u',
          email: 'viewer@example.test',
          roles: [],
          permissions: [],
          csrfToken: 'c',
        });
      }),
    );
    renderPage(<WatchPage title={film} episodeId={undefined} fromStart={false} />);

    expect(await screen.findByRole('button', { name: `playing ${movie.id}` })).toBeInTheDocument();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("plays a movie for the watching profile, and goes back to the movie's page at the end", async () => {
    signInAs();
    renderPage(<WatchPage title={film} episodeId="ignored" fromStart={false} />);

    const playing = await screen.findByRole('button', { name: `playing ${movie.id}` });
    expect(last()).toMatchObject({
      profileId: watchingProfile.id,
      contentId: movie.id,
      fromStart: false,
      heading: 'Kuzey Işığı',
      backHref: `/tr/movies/${movie.id}`,
    });
    expect(last()?.subheading).toBeUndefined();

    playing.click();
    expect(navigation.push).toHaveBeenCalledWith(`/tr/movies/${movie.id}`);
  });

  it('plays the episode the address names, without asking where the series stopped', async () => {
    signInAs();
    const asked = progress([]);
    renderPage(<WatchPage title={show} episodeId="e12" fromStart />, 'en');

    await screen.findByRole('button', { name: 'playing e12' });
    expect(last()).toMatchObject({
      contentId: 'e12',
      fromStart: true,
      subheading: 'S1:E2 · İlk Robot',
      backHref: `/en/series/${series.id}`,
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(asked).toEqual([]);
  });

  it('plays nothing of a series until it knows where the series stopped', async () => {
    signInAs();
    server.use(
      http.get(`${gatewayUrl}/streaming/profiles/${watchingProfile.id}/progress`, async () => {
        await delay(80);
        return HttpResponse.json([]);
      }),
    );
    renderPage(<WatchPage title={show} episodeId={undefined} fromStart={false} />);

    expect(await screen.findByRole('button', { name: 'playing e11' })).toBeInTheDocument();
    expect(shown.props.map((props) => props.contentId)).not.toContain(series.id);
  });

  it('offers the next episode, from where the profile stopped in it, and none after the last', async () => {
    signInAs();
    const { unmount } = renderPage(<WatchPage title={show} episodeId="e12" fromStart />);

    await screen.findByRole('button', { name: 'playing e12' });
    expect(last()?.next?.label).toBe('S2:B1 · Yeni Atölye');
    last()?.next?.onPlay();
    expect(navigation.replace).toHaveBeenCalledWith(`/tr/watch/${series.id}?episode=e21`);
    unmount();

    renderPage(<WatchPage title={show} episodeId="e21" fromStart={false} />);
    await screen.findByRole('button', { name: 'playing e21' });
    expect(last()?.next).toBeUndefined();
  });

  it('goes on where the series stopped when the address names no episode it has', async () => {
    signInAs();
    const asked = progress([
      { contentId: 'e11', positionSeconds: 3660, durationSeconds: 3660, completed: true, updatedAt: 'x' },
    ]);
    renderPage(<WatchPage title={show} episodeId="gone" fromStart={false} />);

    await screen.findByRole('button', { name: 'playing e12' });
    expect(asked).toEqual([series.id]);
    expect(last()?.subheading).toBe('S1:B2 · İlk Robot');
  });
});
