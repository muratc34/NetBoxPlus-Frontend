import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PersonRoute, { generateMetadata } from '../../app/[lang]/people/[id]/page';
import { loadPerson, loadTitles, viewerAgeLimit } from '../../server/catalog';
import { title, titlePage } from '../../test/catalog';
import { renderPage, serverRendered, server, signedOut } from '../../test/render';

vi.mock('../../server/catalog', () => ({
  loadPerson: vi.fn(),
  loadTitles: vi.fn(),
  viewerAgeLimit: vi.fn(),
}));

const id = '0195f0e0-0000-7000-8000-00000000b001';
const person = {
  id,
  name: 'Defne Aksoy',
  biography: 'İstanbul doğumlu oyuncu.',
  language: 'tr',
  photoUrl: 'http://storage.test/defne.png',
};
const params = (lang: string, personId = id, search: Record<string, string> = {}) => ({
  params: Promise.resolve({ lang, id: personId }),
  searchParams: Promise.resolve(search),
});

beforeEach(() => {
  server.use(signedOut);
  vi.mocked(loadPerson).mockResolvedValue(person);
  vi.mocked(viewerAgeLimit).mockResolvedValue('Age13');
  vi.mocked(loadTitles).mockResolvedValue(titlePage([title(1), title(2)], 1, 25, 20));
});

describe('PersonRoute', () => {
  it("shows the person and the titles they are in, within the profile's limit", async () => {
    const { container } = renderPage(await serverRendered(PersonRoute(params('tr', id, { page: '2' }))));

    expect(screen.getByRole('heading', { level: 1, name: 'Defne Aksoy' })).toBeInTheDocument();
    expect(screen.getByText('İstanbul doğumlu oyuncu.')).toBeInTheDocument();
    expect(container.querySelector('img')).toHaveAttribute('src', 'http://storage.test/defne.png');
    expect(screen.getByRole('region', { name: 'Yer aldığı yapımlar' })).toHaveTextContent('Title 2');
    expect(loadTitles).toHaveBeenCalledWith({ lang: 'tr', personId: id, maxAgeRating: 'Age13' }, 2);
    expect(screen.getByRole('link', { name: 'Daha fazla göster' })).toHaveAttribute(
      'href',
      `/tr/people/${id}?page=2`,
    );
  });

  it("has a Catalog photo resized through the web app's /media route", async () => {
    const name = '01a1d602b78a700baf02a83be30c9a09.jpg';
    vi.mocked(loadPerson).mockResolvedValue({
      ...person,
      photoUrl: `http://127.0.0.1:10000/devstoreaccount1/images/${name}`,
    });

    const { container } = renderPage(await serverRendered(PersonRoute(params('tr'))));

    const photo = container.querySelector('img');
    expect(photo?.getAttribute('src')?.startsWith(`/_next/image?url=%2Fmedia%2F${name}&w=`)).toBe(true);
    expect(photo).toHaveAttribute('sizes', '(min-width: 640px) 224px, 160px');
  });

  it('shows an initial without a photo', async () => {
    vi.mocked(loadPerson).mockResolvedValue({ ...person, photoUrl: null, biography: null });

    renderPage(await serverRendered(PersonRoute(params('en'))), 'en');

    const header = screen.getByRole('heading', { level: 1 }).closest('section');
    expect(header?.querySelector('img')).toBeNull();
    expect(screen.getByText('D')).toBeInTheDocument();
  });

  it('is a 404 for someone unknown or a malformed id', async () => {
    vi.mocked(loadPerson).mockResolvedValue(null);
    await expect(PersonRoute(params('tr'))).rejects.toThrow();

    vi.mocked(loadPerson).mockClear();
    await expect(PersonRoute(params('tr', 'nobody'))).rejects.toThrow();
    expect(loadPerson).not.toHaveBeenCalled();
  });

  it('describes the person to search engines', async () => {
    expect(await generateMetadata(params('en'))).toMatchObject({
      title: 'Defne Aksoy',
      description: 'İstanbul doğumlu oyuncu.',
      alternates: { canonical: `/en/people/${id}`, languages: { tr: `/tr/people/${id}` } },
      openGraph: { type: 'profile', images: [{ url: 'http://storage.test/defne.png' }] },
    });
  });
});
