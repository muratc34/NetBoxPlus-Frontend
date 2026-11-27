import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { title, titlePage } from '../../test/catalog';
import { gatewayUrl, navigation, renderPage, server, signInAs, watchingProfile } from '../../test/render';
import { HistoryPage } from './history-page';

const historyUrl = `${gatewayUrl}/streaming/profiles/${watchingProfile.id}/history`;

function catalogById() {
  return http.get(`${gatewayUrl}/catalog/titles`, ({ request }) => {
    const ids = new URL(request.url).searchParams.getAll('ids');
    return HttpResponse.json(titlePage(ids.map((id) => title(Number(id.slice(-12)), { id }))));
  });
}

/** A history Streaming keeps, in pages of `pageSize`; DELETE takes a title out. */
function streamingHistory(ids: string[]) {
  let kept = [...ids];
  const removed: string[] = [];
  server.use(
    http.get(historyUrl, ({ request }) => {
      const query = new URL(request.url).searchParams;
      const page = Number(query.get('page'));
      const size = Number(query.get('pageSize'));
      const items = kept
        .slice((page - 1) * size, page * size)
        .map((titleId) => ({ titleId, kind: 'Movie', watchedAt: '2026-11-20T12:00:00Z' }));
      return HttpResponse.json({ items, pageNumber: page, pageSize: size, totalCount: kept.length });
    }),
    http.delete(`${historyUrl}/:titleId`, ({ params }) => {
      removed.push(String(params.titleId));
      kept = kept.filter((id) => id !== params.titleId);
      return new HttpResponse(null, { status: 204 });
    }),
    catalogById(),
  );
  return removed;
}

describe('HistoryPage', () => {
  it('sends a visitor to sign in, coming back here', async () => {
    navigation.pathname = '/tr/history';
    renderPage(<HistoryPage />);

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith('/tr/sign-in?next=%2Ftr%2Fhistory');
    });
  });

  it('lists what the profile watched with the day, and takes a title out', async () => {
    signInAs();
    const [first, second] = [title(1).id, title(2).id];
    const removed = streamingHistory([first, second]);
    const user = userEvent.setup();

    renderPage(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getAllByRole('listitem')).toHaveLength(2);
    });
    const [row] = screen.getAllByRole('listitem');
    if (!row) {
      throw new Error('The history has no rows.');
    }
    expect(within(row).getByRole('link')).toHaveAttribute('href', `/tr/movies/${first}`);
    expect(row).toHaveTextContent('İzlendi: 20 Kasım 2026');

    await user.click(screen.getByRole('button', { name: 'Title 1: geçmişten kaldır' }));

    await waitFor(() => {
      expect(screen.getAllByRole('listitem')).toHaveLength(1);
    });
    expect(removed).toEqual([first]);
    expect(screen.getByRole('link', { name: /Title 2/ })).toBeInTheDocument();
  });

  it('shows more on request', async () => {
    signInAs();
    const ids = Array.from({ length: 25 }, (_, index) => title(index + 1).id);
    streamingHistory(ids);
    const user = userEvent.setup();

    renderPage(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getAllByRole('listitem')).toHaveLength(20);
    });
    await user.click(screen.getByRole('button', { name: 'Daha fazla göster' }));
    await waitFor(() => {
      expect(screen.getAllByRole('listitem')).toHaveLength(25);
    });
    expect(screen.queryByRole('button', { name: 'Daha fazla göster' })).not.toBeInTheDocument();
  });

  it('says when the profile has watched nothing', async () => {
    signInAs();
    streamingHistory([]);

    renderPage(<HistoryPage />);

    expect(await screen.findByText('Bu profil henüz bir şey izlemedi.')).toBeInTheDocument();
  });
});
