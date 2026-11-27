import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { required, urls } from '../support/environment';
import { linkTo, waitForEmail } from '../support/mailpit';

/**
 * The README's pictures, from the running system with its catalog as it is. The web app is seen by the
 * first prepared load-test account (load-user-01, subscribed in Stripe's test mode), the admin panel by the
 * seeded administrator. Nothing shows a real address: the administrator's is hidden. The player is left out:
 * its video is a synthetic test pattern.
 */
test.describe.configure({ mode: 'serial' });

const folder = resolve(import.meta.dirname, '../../../docs/screenshots');
const file = (name: string, extension = 'jpg') => join(folder, `${name}.${extension}`);
const viewer = { email: 'load-user-01@load.netboxplus.test' };
const profiles = [
  { name: 'Deniz', maxAgeRating: 'Age16' },
  { name: 'Ece', maxAgeRating: 'Age18' },
  { name: 'Çocuk', maxAgeRating: 'Age7' },
] as const;
const featured = { movie: 'The Dark Knight', series: 'Breaking Bad' };
const myList = ['Interstellar', 'Arcane', 'Spirited Away', 'Parasite', 'Better Call Saul', 'Inception'];

interface Title {
  readonly id: string;
  readonly kind: 'Movie' | 'Series';
  readonly title: string;
}

let titles: Title[] = [];
const titleNamed = (name: string): Title => {
  const found = titles.find((item) => item.title === name);
  if (!found) {
    throw new Error(`${name} is not in the catalog.`);
  }
  return found;
};

test.beforeAll(async ({ request }) => {
  mkdirSync(folder, { recursive: true });
  for (let page = 1; ; page++) {
    const response = await request.get(
      `${urls.gateway}/catalog/titles?lang=en&pageSize=100&page=${String(page)}`,
    );
    const list = (await response.json()) as { items: Title[]; totalCount: number };
    titles = [...titles, ...list.items];
    if (page * 100 >= list.totalCount) {
      break;
    }
  }
});

/** Hides the administrator's address in the admin panel's header. */
const hiddenAddress = 'header .truncate { visibility: hidden !important; }';

/** Waits until the images on screen have arrived, then takes the picture. */
async function shot(page: Page, name: string, style?: string) {
  await page.mouse.move(0, 0);
  await page
    .waitForFunction(
      () =>
        [...document.images]
          .filter((image) => {
            const box = image.getBoundingClientRect();
            return box.bottom > 0 && box.top < window.innerHeight && box.width > 0;
          })
          .every((image) => image.complete && image.naturalWidth > 0),
      undefined,
      { timeout: 20_000 },
    )
    .catch(() => undefined);
  await page.waitForTimeout(600);
  await page.screenshot({
    path: file(name),
    type: 'jpeg',
    quality: 82,
    animations: 'disabled',
    caret: 'hide',
    ...(style ? { style } : {}),
  });
}

async function csrf(page: Page): Promise<string> {
  const session = (await (await page.request.get(`${urls.gateway}/session`)).json()) as { csrfToken: string };
  return session.csrfToken;
}

/** Signs the viewer in, gives the account a few profiles and the main one a list, and chooses it. */
async function signInViewer(browser: Browser, viewport = { width: 1440, height: 900 }): Promise<Page> {
  const page = await browser.newPage({ viewport, deviceScaleFactor: viewport.width < 600 ? 2 : 1 });
  await page.goto('/tr/sign-in');
  await page.getByLabel('E-posta').fill(viewer.email);
  await page.getByLabel('Şifre').fill(required('LOAD_USER_PASSWORD'));
  await page.getByRole('main').getByRole('button', { name: 'Giriş yap' }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/sign-in'));

  const headers = { 'X-CSRF-Token': await csrf(page) };
  // Verified, so the pages carry no reminder to verify the address.
  const status = (await (await page.request.get(`${urls.gateway}/auth/email-verification`)).json()) as {
    verified: boolean;
  };
  if (!status.verified) {
    const asked = new Date();
    await page.request.post(`${urls.gateway}/auth/email-verification`, { headers });
    await page.goto(linkTo(await waitForEmail(viewer.email, /doğrula/i, asked), '/verify-email'));
    await expect(page.getByText('E-posta adresin doğrulandı.')).toBeVisible();
  }
  const existing = (await (await page.request.get(`${urls.gateway}/auth/profiles`)).json()) as {
    id: string;
    name: string;
  }[];
  for (const profile of profiles.filter((wanted) => !existing.some((item) => item.name === wanted.name))) {
    const created = await page.request.post(`${urls.gateway}/auth/profiles`, { headers, data: profile });
    expect(created.ok(), `profile ${profile.name}`).toBe(true);
  }
  const main = existing[0];
  if (!main) {
    throw new Error('The viewer has no profile.');
  }
  for (const name of myList) {
    await page.request.put(`${urls.gateway}/streaming/profiles/${main.id}/my-list/${titleNamed(name).id}`, {
      headers,
    });
  }

  await page.goto('/tr/profiles');
  await expect(page.getByRole('heading', { name: 'Kim izliyor?' })).toBeVisible();
  return page;
}

async function chooseMain(page: Page) {
  await page.getByRole('button', { name: 'Main', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/profiles'));
}

test('the web app', async ({ browser }) => {
  const page = await signInViewer(browser);
  await shot(page, 'web-profiles');
  await chooseMain(page);

  await page.goto('/tr');
  await expect(page.getByRole('region', { name: 'İzlemeye devam et' })).toBeVisible();
  await shot(page, 'web-home');

  const movie = titleNamed(featured.movie);
  await page.goto(`/tr/movies/${movie.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await shot(page, 'web-movie');

  await page.goto(`/tr/series/${titleNamed(featured.series).id}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('heading', { level: 1 }).scrollIntoViewIfNeeded();
  await shot(page, 'web-series');

  await page.goto('/tr/search?q=y%C3%BCz%C3%BCk');
  await expect(page.getByText(/sonuç/).first()).toBeVisible();
  await shot(page, 'web-search');

  await page.goto('/tr/plans');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await shot(page, 'web-plans');

  await page.close();

  const phone = await signInViewer(browser, { width: 390, height: 844 });
  await chooseMain(phone);
  await phone.goto('/tr');
  await expect(phone.getByRole('region', { name: 'İzlemeye devam et' })).toBeVisible();
  await shot(phone, 'web-phone');
  await phone.close();
});

test('the admin panel', async ({ browser }) => {
  const page = await browser.newPage({ baseURL: urls.admin });
  await page.goto('/sign-in');
  await page.getByLabel('E-posta').fill(required('AUTH_ADMIN_EMAIL'));
  await page.getByLabel('Şifre').fill(required('AUTH_ADMIN_PASSWORD'));
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page.getByRole('navigation', { name: 'Yönetim menüsü' })).toBeVisible();

  const movie = titleNamed(featured.movie);
  await page.goto(`/movies/${movie.id}`);
  await expect(page.getByRole('form', { name: 'Film bilgileri' })).toBeVisible();
  await shot(page, 'admin-movie', hiddenAddress);

  const videos = (await (
    await page.request.get(
      `${urls.gateway}/admin/streaming/videos?contentId=${movie.id}&purpose=Feature&status=Ready`,
    )
  ).json()) as { items: { id: string }[] };
  const video = videos.items[0];
  if (video) {
    await page.goto(`/videos/${video.id}`);
    await expect(page.getByText(/^Hazır$/).first()).toBeVisible();
    await shot(page, 'admin-video', hiddenAddress);
  }

  await page.close();
});

test('the demo', async ({ browser }) => {
  const recordings = join(test.info().outputDir, 'recording');
  const context = await browser.newContext({
    baseURL: urls.web,
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: recordings, size: { width: 1280, height: 720 } },
    locale: 'tr-TR',
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.goto('/tr');
  await page.waitForTimeout(1500);
  await page.mouse.wheel(0, 650);
  await page.waitForTimeout(1500);
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(1200);
  await page.mouse.wheel(0, -1350);
  await page.waitForTimeout(800);
  await page.getByRole('link', { name: 'Ara', exact: true }).first().click();
  await page.waitForURL(/\/search/);
  await page.getByRole('searchbox').pressSequentially('yüzük', { delay: 140 });
  await expect(page.getByText(/sonuç/).first()).toBeVisible();
  await page.waitForTimeout(1500);
  await page
    .getByRole('main')
    .getByRole('link')
    .filter({ hasText: /Kralın Dönüşü/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.waitForTimeout(1500);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(1800);
  const recorded = page.video();
  await context.close();

  const source = await recorded?.path();
  if (!source) {
    throw new Error('Nothing was recorded.');
  }
  const ffmpeg = process.env.FFMPEG_DIRECTORY ? join(process.env.FFMPEG_DIRECTORY, 'ffmpeg') : 'ffmpeg';
  execFileSync(
    ffmpeg,
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      // The first moment is the empty page before the first paint.
      '-ss',
      '0.7',
      '-i',
      source,
      '-vf',
      'fps=12,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
      file('demo', 'gif'),
    ],
    { stdio: 'pipe' },
  );
  rmSync(recordings, { recursive: true, force: true });
});
