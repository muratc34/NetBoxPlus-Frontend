import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const name = '01a1d602b78a700baf02a83be30c9a09.jpg';

function get(file: string) {
  return GET(new Request(`http://web.test/media/${file}`), { params: Promise.resolve({ name: file }) });
}

function storage(response: Response | Error) {
  const fetch = vi.fn<typeof globalThis.fetch>(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('GET /media/[name]', () => {
  it('passes the image on from storage, cached for good', async () => {
    vi.stubEnv('CATALOG_IMAGES_URL', 'http://azurite:10000/devstoreaccount1/images/');
    const fetch = storage(new Response('jpeg bytes', { headers: { 'Content-Type': 'image/jpeg' } }));

    const response = await get(name);

    expect(fetch).toHaveBeenCalledWith(`http://azurite:10000/devstoreaccount1/images/${name}`, {
      cache: 'no-store',
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/jpeg');
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(await response.text()).toBe('jpeg bytes');
  });

  it.each(['poster.png', `..%2F${name}`, `${name}.html`, 'ABCDEF0123456789ABCDEF0123456789.jpg'])(
    'asks storage for nothing but an image name: %s is 404',
    async (file) => {
      vi.stubEnv('CATALOG_IMAGES_URL', 'http://azurite:10000/devstoreaccount1/images');
      const fetch = storage(new Response('x', { headers: { 'Content-Type': 'image/png' } }));

      expect((await get(file)).status).toBe(404);
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it('is 404 for an image storage does not have', async () => {
    vi.stubEnv('CATALOG_IMAGES_URL', 'http://azurite:10000/devstoreaccount1/images');
    storage(new Response(null, { status: 404 }));

    expect((await get(name)).status).toBe(404);
  });

  it('is 502 when storage fails, cannot be reached or sends something else than an image', async () => {
    vi.stubEnv('CATALOG_IMAGES_URL', 'http://azurite:10000/devstoreaccount1/images');
    storage(new Response(null, { status: 503 }));
    expect((await get(name)).status).toBe(502);

    storage(new Response('error page', { status: 500, headers: { 'Content-Type': 'image/png' } }));
    expect((await get(name)).status).toBe(502);

    storage(new TypeError('fetch failed'));
    expect((await get(name)).status).toBe(502);

    storage(new Response('<svg/>', { headers: { 'Content-Type': 'image/svg+xml' } }));
    expect((await get(name)).status).toBe(502);
  });

  it('is 503 without storage to ask', async () => {
    vi.stubEnv('CATALOG_IMAGES_URL', '');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetch = storage(new Response('x'));

    expect((await get(name)).status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledOnce();
  });
});
