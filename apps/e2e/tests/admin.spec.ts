import { expect, test, type Page } from '@playwright/test';
import { required, urls } from '../support/environment';
import { makeMedia, type Media } from '../support/media';

/**
 * What the demo seeder does, done through the admin panel instead: a movie with images, a feature video
 * with dubbing and subtitles, a trailer, published; then seen on the web app. The movie is deleted at the
 * end (its videos stay in Streaming, which has no way to delete one).
 */
test.describe.configure({ mode: 'serial' });

const run = Date.now().toString(36);
const movie = {
  title: `Uçtan Uca ${run}`,
  english: `End to End ${run}`,
  synopsis: 'Uçtan uca testin filmi.',
};

let page: Page;
let media: Media;
let movieId = '';

test.beforeAll(async ({ browser }, info) => {
  media = makeMedia(info.outputPath('media'));
  page = await browser.newPage({ baseURL: urls.admin });
});

test.afterAll(async () => {
  // Through the gateway, so the movie goes even when a step failed halfway.
  if (movieId) {
    const session = (await (await page.request.get(`${urls.gateway}/admin/session`)).json()) as {
      csrfToken: string;
    };
    const headers = { 'X-CSRF-Token': session.csrfToken };
    await page.request.post(`${urls.gateway}/admin/catalog/movies/${movieId}/unpublish`, { headers });
    const deleted = await page.request.delete(`${urls.gateway}/admin/catalog/movies/${movieId}`, { headers });
    expect(deleted.status(), 'the run’s movie is deleted').toBe(204);
  }
  await page.close();
});

/** Waits on the video page until the transcoder is done with what it shows; the page asks again itself. */
async function waitUntilReady(text: RegExp) {
  await expect(page.getByText(text).first()).toBeVisible({ timeout: 4 * 60_000 });
}

test('signs in to the admin panel', async () => {
  await page.goto('/sign-in');
  await page.getByLabel('E-posta').fill(required('AUTH_ADMIN_EMAIL'));
  await page.getByLabel('Şifre').fill(required('AUTH_ADMIN_PASSWORD'));
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page.getByRole('navigation', { name: 'Yönetim menüsü' })).toBeVisible();
});

test('makes a movie with a genre and its images', async () => {
  await page.goto('/movies/new');
  const turkish = page.getByRole('group', { name: 'Türkçe' });
  await turkish.getByLabel('Başlık').fill(movie.title);
  await turkish.getByLabel('Özet').fill(movie.synopsis);
  await page.getByRole('group', { name: 'İngilizce' }).getByLabel('Başlık').fill(movie.english);
  await page
    .getByRole('group', { name: 'İngilizce' })
    .getByLabel('Özet')
    .fill('The end-to-end test’s movie.');
  await page.getByLabel('Orijinal başlık').fill(movie.title);
  await page.getByLabel('Yapım yılı').fill('2026');
  await page.getByLabel('Yaş sınırı').selectOption({ label: '7+' });
  await page.getByLabel('Süre (dakika)').fill('90');
  await page.getByRole('checkbox', { name: 'Dram', exact: true }).check();
  await page.getByRole('form', { name: 'Film bilgileri' }).getByRole('button', { name: 'Kaydet' }).click();
  await page.waitForURL(/\/movies\/[0-9a-f-]{36}$/);
  movieId = new URL(page.url()).pathname.split('/').pop() ?? '';

  await page.getByLabel('Afiş yükle').setInputFiles(media.poster);
  await expect(page.getByRole('img', { name: movie.title }).first()).toBeVisible({ timeout: 60_000 });
  await page.getByLabel('Arka plan yükle').setInputFiles(media.backdrop);
  await expect(page.getByLabel('Arka planı değiştir')).toBeAttached({ timeout: 60_000 });
});

test('uploads the feature, waits for it, and adds dubbing and subtitles', async () => {
  await page.getByRole('region', { name: 'Videolar' }).getByRole('button', { name: 'Video yükle' }).click();
  const upload = page.getByRole('form', { name: 'Video yükle' });
  await upload.getByLabel('Dosya').setInputFiles(media.feature);
  await upload.getByRole('button', { name: 'Yükle' }).click();
  await page.waitForURL(/\/videos\/[0-9a-f-]{36}$/, { timeout: 2 * 60_000 });
  await waitUntilReady(/^Hazır$/);

  const dubbing = page.getByRole('form', { name: 'Dublaj ekle' });
  await dubbing.getByLabel('Dil').selectOption({ label: 'Amerikan İngilizcesi' });
  await dubbing.getByLabel('Ses dosyası').setInputFiles(media.dub);
  await dubbing.getByRole('button', { name: 'Yükle' }).click();

  const subtitles = page.getByRole('form', { name: 'Altyazı ekle' });
  await subtitles.getByLabel('Dil').selectOption({ label: 'Türkçe (Türkiye)' });
  await subtitles.getByLabel('Altyazı dosyası').setInputFiles(media.subtitle);
  await subtitles.getByRole('button', { name: 'Yükle' }).click();

  const audio = page.getByRole('region', { name: 'Ses izleri' });
  await expect(audio.getByRole('row', { name: /Amerikan İngilizcesi.*Hazır/ })).toBeVisible({
    timeout: 4 * 60_000,
  });
  await expect(
    page.getByRole('region', { name: 'Altyazılar' }).getByRole('row', { name: /Türkçe.*Hazır/ }),
  ).toBeVisible();
});

test('uploads a trailer and publishes the movie', async () => {
  await page.goto(`/movies/${movieId}`);
  await page.getByRole('region', { name: 'Videolar' }).getByRole('button', { name: 'Fragman yükle' }).click();
  const upload = page.getByRole('form', { name: 'Fragman yükle' });
  await upload.getByLabel('Dosya').setInputFiles(media.trailer);
  await upload.getByRole('button', { name: 'Yükle' }).click();
  await page.waitForURL(/\/videos\/[0-9a-f-]{36}$/, { timeout: 2 * 60_000 });
  await waitUntilReady(/^Hazır$/);

  await page.goto(`/movies/${movieId}`);
  const publication = page.getByRole('region', { name: 'Yayın' });
  await publication.getByRole('button', { name: 'Yayınla' }).click();
  await expect(publication.getByText(/Yayın tarihi/)).toBeVisible();
});

test('the published movie shows on the web app with its languages and plays its trailer', async ({
  browser,
}) => {
  const visitor = await browser.newPage();
  try {
    await expect
      .poll(
        async () => {
          const response = await visitor.goto(`${urls.web}/tr/movies/${movieId}`);
          return response?.status();
        },
        { timeout: 60_000, intervals: [2000] },
      )
      .toBe(200);
    await expect(visitor.getByRole('heading', { level: 1, name: movie.title })).toBeVisible();
    await expect(visitor.getByRole('definition').filter({ hasText: 'İngilizce' }).first()).toBeVisible();
    // Streaming learns that the movie is out through an event; until then the page finds no trailer and
    // keeps its image, so it is opened again until the trailer plays.
    const trailerPlays = async () => {
      // Not waiting for the load event: a page that is still fetching would hold the next try.
      await visitor.goto(`${urls.web}/tr/movies/${movieId}`, {
        waitUntil: 'domcontentloaded',
        timeout: 15_000,
      });
      const trailer = visitor.locator('video');
      await trailer.waitFor({ timeout: 8000 }).catch(() => undefined);
      await visitor.waitForTimeout(2000);
      return trailer.evaluate((element: HTMLVideoElement) => element.currentTime).catch(() => 0);
    };
    await expect.poll(trailerPlays, { timeout: 90_000, intervals: [1000] }).toBeGreaterThan(0.5);
  } finally {
    await visitor.close();
  }
});
