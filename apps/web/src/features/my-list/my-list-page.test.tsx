import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { title, titlePage } from '../../test/catalog';
import { gatewayUrl, navigation, renderPage, server, signInAs, watchingProfile } from '../../test/render';
import { MyListPage } from './my-list-page';

const listUrl = `${gatewayUrl}/streaming/profiles/${watchingProfile.id}/my-list`;

describe('MyListPage', () => {
  it('sends a visitor to sign in, coming back here', async () => {
    navigation.pathname = '/tr/my-list';
    renderPage(<MyListPage />);

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith('/tr/sign-in?next=%2Ftr%2Fmy-list');
    });
  });

  it("lists the profile's titles, most recently added first", async () => {
    signInAs();
    const [newer, older] = [title(2), title(1)];
    server.use(
      http.get(listUrl, () =>
        HttpResponse.json([
          { titleId: newer.id, kind: 'Movie', addedAt: '2026-11-20T00:00:00Z' },
          { titleId: older.id, kind: 'Movie', addedAt: '2026-11-19T00:00:00Z' },
        ]),
      ),
      http.get(`${gatewayUrl}/catalog/titles`, () => HttpResponse.json(titlePage([older, newer]))),
    );

    renderPage(<MyListPage />);

    await waitFor(() => {
      expect(screen.getAllByRole('listitem')).toHaveLength(2);
    });
    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      `/tr/movies/${newer.id}`,
      `/tr/movies/${older.id}`,
    ]);
    // Signed in: never sent away while the session was still loading.
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('says how to fill an empty list', async () => {
    signInAs();
    server.use(http.get(listUrl, () => HttpResponse.json([])));

    renderPage(<MyListPage />, 'en');

    expect(await screen.findByText(/Your list is empty/)).toBeInTheDocument();
  });
});
