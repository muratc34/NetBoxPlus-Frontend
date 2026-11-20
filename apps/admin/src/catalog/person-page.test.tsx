import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import type { BlobUpload } from '../data/images';
import { catalogUrl, locationOf, problem, renderApp, server, signInWith } from '../test/render';

const ada = {
  id: '0195f0e0-0000-7000-8000-0000000000a1',
  name: 'Ada Kaya',
  biography: 'Oyuncu.',
  translations: { tr: 'Oyuncu.', en: 'Actor.' },
  photoUrl: null as string | null,
};

/** Catalog's copy of the person; a change the test makes is seen on the next read. */
function answerPerson(person = ada) {
  let current = person;
  server.use(
    http.get(`${catalogUrl}/people/${person.id}`, () => HttpResponse.json(current)),
    http.get(`${catalogUrl}/people`, () =>
      HttpResponse.json({ items: [current], pageNumber: 1, pageSize: 20, totalCount: 1 }),
    ),
    http.get(`${catalogUrl}/genres`, () => HttpResponse.json([])),
  );
  return (next: typeof ada) => {
    current = next;
  };
}

const ticket = {
  uploadId: '0195f0e0-0000-7000-8000-00000000f001',
  uploadAddress: 'https://storage.test/images/upload-1?sig=x',
  expiresAt: '2026-11-20T12:00:00Z',
  maxBytes: 1000,
};

function image(type = 'image/jpeg', size = 10) {
  return new File(['x'.repeat(size)], 'photo.jpg', { type });
}

const form = () => screen.getByRole('form', { name: 'Kişi bilgileri' });

describe('PersonPage', () => {
  it('shows the person and saves the changes', async () => {
    signInWith();
    const change = answerPerson();
    let sent: unknown;
    server.use(
      http.put(`${catalogUrl}/people/${ada.id}`, async ({ request }) => {
        sent = await request.json();
        change({ ...ada, name: 'Ada Kaya Demir' });
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp(`/people/${ada.id}`);

    await screen.findByRole('heading', { level: 1, name: 'Ada Kaya' });
    expect(document.title).toBe('Ada Kaya');
    expect(screen.getByLabelText('Ad')).toHaveValue('Ada Kaya');
    expect(screen.getByLabelText('Türkçe biyografi')).toHaveValue('Oyuncu.');
    expect(screen.getByLabelText('Türkçe biyografi')).toHaveAttribute('lang', 'tr');
    expect(screen.getByLabelText('İngilizce biyografi')).toHaveValue('Actor.');
    expect(screen.getByLabelText('İngilizce biyografi')).toHaveAttribute('lang', 'en');

    await userEvent.type(screen.getByLabelText('Ad'), ' Demir ');
    await userEvent.clear(screen.getByLabelText('İngilizce biyografi'));
    await userEvent.click(within(form()).getByRole('button', { name: 'Kaydet' }));

    expect(await within(form()).findByRole('status')).toHaveTextContent('Kaydedildi.');
    expect(sent).toEqual({ name: 'Ada Kaya Demir', translations: { tr: 'Oyuncu.' } });
    expect(await screen.findByRole('heading', { level: 1, name: 'Ada Kaya Demir' })).toBeInTheDocument();

    // Saved changes are no reason to ask before leaving.
    await userEvent.click(screen.getByRole('link', { name: 'Türler' }));
    await screen.findByRole('heading', { name: 'Türler' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('makes a person and goes on to its page', async () => {
    signInWith();
    answerPerson();
    let sent: unknown;
    server.use(
      http.post(`${catalogUrl}/people`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ id: ada.id }, { status: 201 });
      }),
    );
    const { router } = renderApp('/people/new');

    await screen.findByRole('heading', { level: 1, name: 'Yeni kişi' });
    expect(document.title).toBe('Yeni kişi');
    expect(screen.queryByRole('heading', { name: 'Fotoğraf' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sil' })).not.toBeInTheDocument();
    await userEvent.click(within(form()).getByRole('button', { name: 'Kaydet' }));
    expect(await screen.findByText('Bu alan zorunlu.')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Ad'), 'Ada Kaya');
    await userEvent.type(screen.getByLabelText('Türkçe biyografi'), 'Oyuncu.');
    await userEvent.click(within(form()).getByRole('button', { name: 'Kaydet' }));

    await screen.findByRole('heading', { level: 1, name: 'Ada Kaya' });
    expect(sent).toEqual({ name: 'Ada Kaya', translations: { tr: 'Oyuncu.' } });
    expect(locationOf(router)).toBe(`/people/${ada.id}`);
    expect(screen.queryByText('Kaydedildi.')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('puts the failures on their fields', async () => {
    signInWith();
    answerPerson();
    server.use(http.put(`${catalogUrl}/people/${ada.id}`, () => problem(400, 'Person.BiographyTooLong')));
    renderApp(`/people/${ada.id}`);

    await userEvent.click(
      await within(await screen.findByRole('form')).findByRole('button', { name: 'Kaydet' }),
    );

    expect(await screen.findByText('Biyografi çok uzun.')).toBeInTheDocument();
    expect(screen.getByLabelText('Türkçe biyografi')).toHaveAttribute('aria-invalid', 'true');

    server.use(
      http.put(`${catalogUrl}/people/${ada.id}`, () =>
        problem(400, 'Validation.Failed', { errorCodes: { Name: ['Person.NameTooLong'] } }),
      ),
    );
    await userEvent.click(within(form()).getByRole('button', { name: 'Kaydet' }));
    expect(await screen.findByText('Ad çok uzun.')).toBeInTheDocument();

    server.use(http.put(`${catalogUrl}/people/${ada.id}`, () => problem(404, 'Person.NotFound')));
    await userEvent.click(within(form()).getByRole('button', { name: 'Kaydet' }));
    expect(await within(form()).findByRole('alert')).toHaveTextContent('Bu kişi artık yok.');
  });

  it('only shows the person without the write permission', async () => {
    signInWith(['catalog:people:read', 'catalog:images:upload']);
    answerPerson({ ...ada, photoUrl: 'https://images.test/ada.jpg' });
    renderApp(`/people/${ada.id}`);

    await screen.findByRole('heading', { level: 1, name: 'Ada Kaya' });
    expect(screen.getByLabelText('Ad')).toBeDisabled();
    expect(screen.getByLabelText('Türkçe biyografi')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Kaydet' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sil' })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Ada Kaya' })).toHaveAttribute(
      'src',
      'https://images.test/ada.jpg',
    );
    expect(screen.queryByLabelText('Fotoğrafı değiştir')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fotoğrafı kaldır' })).not.toBeInTheDocument();
  });

  it('needs the upload permission for the photo', async () => {
    signInWith(['catalog:people:read', 'catalog:people:write']);
    answerPerson();
    renderApp(`/people/${ada.id}`);

    await screen.findByRole('heading', { level: 1, name: 'Ada Kaya' });
    expect(screen.getByText('Fotoğraf yok.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Fotoğraf yükle')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kaydet' })).toBeInTheDocument();
  });

  it('says when the person cannot be found', async () => {
    signInWith();
    server.use(http.get(`${catalogUrl}/people/${ada.id}`, () => problem(404, 'Person.NotFound')));
    renderApp(`/people/${ada.id}`);

    expect(await screen.findByRole('alert')).toHaveTextContent('Bu kişi artık yok.');
  });

  it('asks before leaving with changes not saved', async () => {
    signInWith();
    answerPerson();
    const { router } = renderApp(`/people/${ada.id}`);

    await userEvent.type(await screen.findByLabelText('Ad'), ' X');
    await userEvent.click(screen.getByRole('link', { name: 'Türler' }));

    const dialog = await screen.findByRole('dialog', { name: 'Kaydedilmemiş değişiklikler var' });
    expect(dialog).toHaveTextContent('Ayrılırsan değişikliklerin kaybolur.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Vazgeç' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(locationOf(router)).toBe(`/people/${ada.id}`);
    expect(screen.getByLabelText('Ad')).toHaveValue('Ada Kaya X');

    await userEvent.click(screen.getByRole('link', { name: 'Türler' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Ayrıl' }));
    await screen.findByRole('heading', { name: 'Türler' });
    expect(locationOf(router)).toBe('/genres');
  });

  it('lets a page without changes, or within the same page, go without asking', async () => {
    signInWith();
    answerPerson();
    const { router } = renderApp(`/people/${ada.id}`);

    await screen.findByLabelText('Ad');
    await userEvent.type(screen.getByLabelText('Ad'), ' X');
    await router.navigate(`/people/${ada.id}?tab=1`);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('Ad'));
    await userEvent.type(screen.getByLabelText('Ad'), 'Ada Kaya');
    await userEvent.click(screen.getByRole('link', { name: 'Türler' }));
    await screen.findByRole('heading', { name: 'Türler' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('uploads a photo, showing how far it is, and attaches it', async () => {
    signInWith();
    const change = answerPerson();
    let attached: unknown;
    let finish: () => void = () => undefined;
    const upload = vi.fn<BlobUpload>(
      (_address, _file, onProgress) =>
        new Promise((resolve) => {
          onProgress(0.42);
          finish = () => {
            onProgress(1);
            resolve();
          };
        }),
    );
    server.use(
      http.post(`${catalogUrl}/images/uploads`, () => HttpResponse.json(ticket)),
      http.put(`${catalogUrl}/people/${ada.id}/photo`, async ({ request }) => {
        attached = await request.json();
        change({ ...ada, photoUrl: 'https://images.test/ada.jpg' });
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp(`/people/${ada.id}`, { upload });

    const input = await screen.findByLabelText('Fotoğraf yükle');
    expect(input).toHaveAccessibleDescription('JPEG, PNG ya da WebP; en az 200×200 piksel, en fazla 10 MB.');
    expect(input).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
    const file = image();
    await userEvent.upload(input, file);

    expect(await screen.findByText('Yükleniyor: %42')).toBeInTheDocument();
    expect(input).toBeDisabled();
    expect(upload).toHaveBeenCalledWith(ticket.uploadAddress, file, expect.any(Function));
    finish();

    expect(await screen.findByRole('img', { name: 'Ada Kaya' })).toHaveAttribute(
      'src',
      'https://images.test/ada.jpg',
    );
    expect(attached).toEqual({ uploadId: ticket.uploadId });
    expect(screen.queryByText(/Yükleniyor/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Fotoğrafı değiştir')).toHaveValue('');
  });

  it('refuses a file of another type or too large before uploading it', async () => {
    signInWith();
    answerPerson();
    let tickets = 0;
    server.use(
      http.post(`${catalogUrl}/images/uploads`, () => {
        tickets += 1;
        return HttpResponse.json(ticket);
      }),
    );
    const upload = vi.fn<BlobUpload>(() => Promise.resolve());
    renderApp(`/people/${ada.id}`, { upload });

    const input = await screen.findByLabelText('Fotoğraf yükle');
    await userEvent.upload(input, image('image/gif'), { applyAccept: false });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bu dosya türü desteklenmiyor: JPEG, PNG ya da WebP seç.',
    );
    expect(tickets).toBe(0);

    await userEvent.upload(input, image('image/png', 1001));
    expect(await screen.findByText('Dosya 10 MB’tan büyük.')).toBeInTheDocument();
    expect(tickets).toBe(1);
    expect(upload).not.toHaveBeenCalled();
  });

  it('shows why Catalog refused the photo', async () => {
    signInWith();
    answerPerson();
    server.use(
      http.post(`${catalogUrl}/images/uploads`, () => HttpResponse.json(ticket)),
      http.put(`${catalogUrl}/people/${ada.id}/photo`, () => problem(400, 'Image.TooSmall')),
    );
    renderApp(`/people/${ada.id}`, { upload: () => Promise.resolve() });

    await userEvent.upload(await screen.findByLabelText('Fotoğraf yükle'), image());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Görselin çözünürlüğü bu kullanım için düşük.',
    );
  });

  it('removes the photo', async () => {
    signInWith();
    const change = answerPerson({ ...ada, photoUrl: 'https://images.test/ada.jpg' });
    server.use(
      http.delete(`${catalogUrl}/people/${ada.id}/photo`, () => {
        change(ada);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp(`/people/${ada.id}`);

    await userEvent.click(await screen.findByRole('button', { name: 'Fotoğrafı kaldır' }));

    expect(await screen.findByText('Fotoğraf yok.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fotoğrafı kaldır' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Fotoğraf yükle')).toBeInTheDocument();
  });

  it('deletes the person after asking and goes back to the list', async () => {
    signInWith();
    answerPerson();
    let deleted = false;
    server.use(
      http.delete(`${catalogUrl}/people/${ada.id}`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { router, queryClient } = renderApp(`/people/${ada.id}`);

    await userEvent.click(await screen.findByRole('button', { name: 'Ada Kaya: sil' }));
    const dialog = screen.getByRole('dialog', { name: '“Ada Kaya” silinsin mi?' });
    expect(dialog).toHaveTextContent('Bu kişi kalıcı olarak silinir.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sil' }));

    await screen.findByRole('heading', { name: 'Kişiler' });
    expect(deleted).toBe(true);
    expect(locationOf(router)).toBe('/people');
    expect(queryClient.getQueryData(['admin', 'catalog', 'person', ada.id])).toBeUndefined();
  });

  it('keeps the question open with the reason when titles credit the person', async () => {
    signInWith();
    answerPerson();
    server.use(http.delete(`${catalogUrl}/people/${ada.id}`, () => problem(409, 'Person.InUse')));
    renderApp(`/people/${ada.id}`);

    await userEvent.click(await screen.findByRole('button', { name: 'Ada Kaya: sil' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sil' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Bu kişi başlıklarda yer alıyor; önce oradan çıkar.',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Vazgeç' }));
    await userEvent.click(screen.getByRole('button', { name: 'Ada Kaya: sil' }));
    expect(within(screen.getByRole('dialog')).queryByRole('alert')).not.toBeInTheDocument();
  });
});
