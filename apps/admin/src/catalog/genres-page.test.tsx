import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { catalogUrl, problem, renderApp, server, signInWith } from '../test/render';

const drama = {
  id: '0195f0e0-0000-7000-8000-00000000d001',
  name: 'Dram',
  translations: { tr: 'Dram', en: 'Drama' },
  usageCount: 3,
};
const local = {
  id: '0195f0e0-0000-7000-8000-00000000d002',
  name: 'Yerel',
  translations: { tr: 'Yerel' },
  usageCount: 0,
};

/** The genres Catalog has now; a change the test makes is seen on the next read. */
function answerGenres(genres: unknown[] = [drama, local]) {
  let current = genres;
  server.use(http.get(`${catalogUrl}/genres`, () => HttpResponse.json(current)));
  return (next: unknown[]) => {
    current = next;
  };
}

function rows() {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole('cell')
        .slice(0, 3)
        .map((cell) => cell.textContent),
    );
}

describe('GenresPage', () => {
  it('lists the genres with their names and use', async () => {
    signInWith();
    answerGenres();
    renderApp('/genres');

    await screen.findByRole('table');
    expect(document.title).toBe('Türler');
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Türkçe ad',
      'İngilizce ad',
      'Kullanan başlık',
      'İşlemler',
    ]);
    expect(rows()).toEqual([
      ['Dram', 'Drama', '3'],
      ['Yerel', '—', '0'],
    ]);
  });

  it('falls back to the name without a Turkish one', async () => {
    signInWith();
    answerGenres([{ ...drama, translations: { en: 'Drama' } }]);
    renderApp('/genres');

    await screen.findByRole('table');
    expect(rows()).toEqual([['Dram', 'Drama', '3']]);
  });

  it('only shows them without the write permission', async () => {
    signInWith(['catalog:genres:read']);
    answerGenres();
    renderApp('/genres');

    await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: 'Yeni tür' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /düzenle|sil/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(3);
  });

  it('says when there are none and when they cannot be read', async () => {
    signInWith();
    answerGenres([]);
    const first = renderApp('/genres');
    expect(await screen.findByText('Henüz tür yok.')).toBeInTheDocument();
    first.unmount();

    server.use(http.get(`${catalogUrl}/genres`, () => problem(503, 'Data.Unavailable')));
    renderApp('/genres');
    expect(await screen.findByRole('alert', {}, { timeout: 5000 })).toBeInTheDocument();
  });

  it('adds a genre, leaving out an empty English name', async () => {
    signInWith();
    const change = answerGenres([drama]);
    let sent: unknown;
    server.use(
      http.post(`${catalogUrl}/genres`, async ({ request }) => {
        sent = await request.json();
        change([drama, { ...local, translations: { tr: 'Belgesel' }, name: 'Belgesel' }]);
        return HttpResponse.json({ id: local.id }, { status: 201 });
      }),
    );
    renderApp('/genres');

    await userEvent.click(await screen.findByRole('button', { name: 'Yeni tür' }));
    const dialog = screen.getByRole('dialog', { name: 'Yeni tür' });
    await userEvent.type(within(dialog).getByLabelText('Türkçe ad'), ' Belgesel ');
    await userEvent.type(within(dialog).getByLabelText('İngilizce ad'), '   ');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Kaydet' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(sent).toEqual({ translations: { tr: 'Belgesel' } });
    expect(await screen.findByRole('cell', { name: 'Belgesel' })).toBeInTheDocument();
  });

  it('renames a genre from its current names', async () => {
    signInWith();
    answerGenres();
    let sent: unknown;
    server.use(
      http.put(`${catalogUrl}/genres/${drama.id}`, async ({ request }) => {
        sent = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp('/genres');

    await userEvent.click(await screen.findByRole('button', { name: 'Dram: düzenle' }));
    const dialog = screen.getByRole('dialog', { name: 'Türü düzenle' });
    expect(within(dialog).getByLabelText('Türkçe ad')).toHaveValue('Dram');
    expect(within(dialog).getByLabelText('Türkçe ad')).toHaveAttribute('lang', 'tr');
    expect(within(dialog).getByLabelText('İngilizce ad')).toHaveValue('Drama');
    expect(within(dialog).getByLabelText('İngilizce ad')).toHaveAttribute('lang', 'en');
    await userEvent.clear(within(dialog).getByLabelText('İngilizce ad'));
    await userEvent.type(within(dialog).getByLabelText('İngilizce ad'), 'Drama film');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Kaydet' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(sent).toEqual({ translations: { tr: 'Dram', en: 'Drama film' } });
  });

  it('needs the Turkish name and shows a taken one on it', async () => {
    signInWith();
    answerGenres();
    server.use(http.post(`${catalogUrl}/genres`, () => problem(409, 'Genre.NameTaken')));
    renderApp('/genres');

    await userEvent.click(await screen.findByRole('button', { name: 'Yeni tür' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Kaydet' }));
    expect(await within(dialog).findByText('Bu alan zorunlu.')).toBeInTheDocument();

    await userEvent.type(within(dialog).getByLabelText('Türkçe ad'), 'Dram');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Kaydet' }));
    expect(await within(dialog).findByText('Bu adda bir tür zaten var.')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Türkçe ad')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows another failure on the form and closes on cancel', async () => {
    signInWith();
    answerGenres();
    server.use(http.post(`${catalogUrl}/genres`, () => problem(500, 'Error.Unexpected')));
    renderApp('/genres');

    await userEvent.click(await screen.findByRole('button', { name: 'Yeni tür' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Türkçe ad'), 'Dram');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Kaydet' }));
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Vazgeç' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('deletes a genre after asking', async () => {
    signInWith();
    const change = answerGenres();
    let deleted = false;
    server.use(
      http.delete(`${catalogUrl}/genres/${local.id}`, () => {
        deleted = true;
        change([drama]);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp('/genres');

    await userEvent.click(await screen.findByRole('button', { name: 'Yerel: sil' }));
    const dialog = screen.getByRole('dialog', { name: '“Yerel” silinsin mi?' });
    expect(dialog).toHaveTextContent('Bu tür kalıcı olarak silinir.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sil' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(deleted).toBe(true);
    await waitFor(() => {
      expect(rows()).toEqual([['Dram', 'Drama', '3']]);
    });
  });

  it('keeps the question open with the reason when the genre is in use', async () => {
    signInWith();
    answerGenres();
    server.use(http.delete(`${catalogUrl}/genres/${drama.id}`, () => problem(409, 'Genre.InUse')));
    renderApp('/genres');

    await userEvent.click(await screen.findByRole('button', { name: 'Dram: sil' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sil' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Bu türü kullanan başlıklar var; önce onlardan çıkar.',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Vazgeç' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Asking again starts without the old error.
    await userEvent.click(screen.getByRole('button', { name: 'Dram: sil' }));
    expect(within(screen.getByRole('dialog')).queryByRole('alert')).not.toBeInTheDocument();
  });
});
