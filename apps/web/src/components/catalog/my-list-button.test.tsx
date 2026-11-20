import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import {
  gatewayUrl,
  navigation,
  problem,
  renderPage,
  server,
  signInAs,
  watchingProfile,
} from '../../test/render';
import { MyListButton } from './my-list-button';

const titleId = '0195f0e0-0000-7000-8000-000000000007';
const listUrl = `${gatewayUrl}/streaming/profiles/${watchingProfile.id}/my-list`;

function listOf(...ids: string[]) {
  return http.get(listUrl, () =>
    HttpResponse.json(ids.map((id) => ({ titleId: id, kind: 'Movie', addedAt: '2026-11-20T00:00:00Z' }))),
  );
}

describe('MyListButton', () => {
  it('is not on a card without a signed-in profile', async () => {
    const { container } = renderPage(
      <MyListButton titleId={titleId} kind="Movie" title="Kuzey" variant="card" />,
    );

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(container).toBeEmptyDOMElement();
  });

  it("sends a visitor to sign in from a title's page, coming back to it", async () => {
    navigation.pathname = `/tr/movies/${titleId}`;
    renderPage(<MyListButton titleId={titleId} kind="Movie" title="Kuzey" variant="hero" />);

    await userEvent.setup().click(await screen.findByRole('button', { name: /Listeme ekle/ }));

    expect(navigation.push).toHaveBeenCalledWith(
      `/tr/sign-in?next=${encodeURIComponent(`/tr/movies/${titleId}`)}`,
    );
  });

  it('puts the title on the list and takes it off again', async () => {
    signInAs();
    const sent: string[] = [];
    let onList = false;
    server.use(
      http.get(listUrl, () =>
        HttpResponse.json(onList ? [{ titleId, kind: 'Movie', addedAt: '2026-11-20T00:00:00Z' }] : []),
      ),
      http.put(`${listUrl}/${titleId}`, () => {
        sent.push('PUT');
        onList = true;
        return new HttpResponse(null, { status: 204 });
      }),
      http.delete(`${listUrl}/${titleId}`, () => {
        sent.push('DELETE');
        onList = false;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderPage(<MyListButton titleId={titleId} kind="Movie" title="Kuzey" variant="card" />);
    const user = userEvent.setup();

    const add = await screen.findByRole('button', { name: 'Kuzey: Listeme ekle' });
    expect(add).toHaveAttribute('aria-pressed', 'false');
    await user.click(add);

    const remove = await screen.findByRole('button', { name: 'Kuzey: Listemden çıkar' });
    expect(remove).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => {
      expect(remove).toBeEnabled();
    });
    await user.click(remove);

    expect(await screen.findByRole('button', { name: 'Kuzey: Listeme ekle' })).toBeInTheDocument();
    expect(sent).toEqual(['PUT', 'DELETE']);
  });

  it('says why Streaming refused and shows the list as it was', async () => {
    signInAs();
    server.use(
      listOf('other'),
      http.put(`${listUrl}/${titleId}`, () => problem(409, 'MyList.Full')),
    );
    renderPage(<MyListButton titleId={titleId} kind="Movie" title="Kuzey" variant="hero" />);

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Listeme ekle' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Listende en fazla 200 başlık olabilir.');
    expect(screen.getByRole('button', { name: 'Listeme ekle' })).toHaveAttribute('aria-pressed', 'false');
  });
});
