import { randomBytes } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { urls } from '../support/environment';
import { linkTo, waitForEmail } from '../support/mailpit';
import { payForPlan } from '../support/stripe';

/**
 * One customer from sign-up to deletion, through the web app as a visitor uses it: Phase 7's E1 flows in a
 * browser. Each step builds on the one before, so they run in order on one page.
 */
test.describe.configure({ mode: 'serial' });

const run = Date.now().toString(36);
const account = {
  email: `e2e-${run}@example.test`,
  newEmail: `e2e-${run}-new@example.test`,
  // Made for the run and never shown; the account is deleted at the end.
  password: randomBytes(18).toString('base64url'),
};

/** Seeded by `./deploy/dev.ps1 seed`: dubbed in en-US, subtitled in tr-TR and en-US, rated 13+. */
const dubbed = { title: 'Kuzey Işığı', path: '/tr/movies/01a1def6-c6b6-7861-8e7b-ff96b7664cf0' };
/** The seeder's Premium plan and the Stripe price it sells at. */
const premium = { name: 'Premium', lookupKey: 'netboxplus-demo-premium' };

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
});

test.afterAll(async () => {
  await page.close();
});

/** What the gateway says of the browser's session: the user's id. */
async function sessionUserId(): Promise<string> {
  const response = await page.request.get(`${urls.gateway}/session`);
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { userId: string }).userId;
}

async function chooseProfile(name: string) {
  await page.goto('/tr/profiles');
  await expect(page.getByRole('heading', { name: 'Kim izliyor?' })).toBeVisible();
  await page.getByRole('button', { name, exact: true }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/profiles'));
}

test('signs up and verifies the e-mail address', async () => {
  const startedAt = new Date();
  await page.goto('/tr/sign-up');
  await page.getByLabel('E-posta').fill(account.email);
  await page.getByLabel('Şifre', { exact: true }).fill(account.password);
  await page.getByLabel('Şifre (tekrar)').fill(account.password);
  await page.getByRole('button', { name: 'Kayıt ol' }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/sign-up'));

  const email = await waitForEmail(account.email, /doğrula/i, startedAt);
  await page.goto(linkTo(email, '/verify-email'));
  await expect(page.getByText('E-posta adresin doğrulandı.')).toBeVisible();
});

test('subscribes to Premium: checkout goes to Stripe, the paid subscription shows on the account', async () => {
  // Stripe's hosted page is not driven: the redirect to it is the web app's part.
  let checkout: URL | undefined;
  await page.route('https://checkout.stripe.com/**', async (route) => {
    checkout = new URL(route.request().url());
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Stripe Checkout</p>' });
  });
  // The verification reaches Billing through an event: until it has, checkout asks to verify first.
  const verifyFirst = page.getByText('Abonelik başlatmak için önce e-posta adresini doğrula.');
  await expect
    .poll(
      async () => {
        await page.goto('/tr/plans');
        await page.getByRole('button', { name: `${premium.name} planını seç` }).click();
        await expect(verifyFirst.or(page.getByText('Stripe Checkout'))).toBeVisible();
        return checkout?.hostname;
      },
      { timeout: 60_000, intervals: [2000] },
    )
    .toBe('checkout.stripe.com');
  await page.unroute('https://checkout.stripe.com/**');

  const plans = (await (await page.request.get(`${urls.gateway}/billing/plans?lang=tr`)).json()) as {
    id: string;
    name: string;
  }[];
  const planId = plans.find((plan) => plan.name === premium.name)?.id ?? '';
  await payForPlan(account.email, await sessionUserId(), planId, premium.lookupKey);

  await expect
    .poll(
      async () => {
        await page.goto('/tr/account');
        return page.getByRole('region', { name: 'Üyelik' }).textContent();
      },
      { timeout: 60_000, intervals: [2000] },
    )
    .toContain('Aktif');
  await expect(page.getByRole('region', { name: 'Üyelik' })).toContainText(premium.name);
});

test('adds a 7+ profile that cannot watch a 13+ title', async () => {
  await page.goto('/tr/profiles');
  await page.getByRole('button', { name: 'Profil ekle' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Profil adı').fill('Çocuk');
  await dialog.getByLabel('İzleyebileceği içerikler').selectOption({ label: '7+ ve altı' });
  await dialog.getByRole('button', { name: 'Kaydet' }).click();
  await expect(page.getByRole('button', { name: 'Çocuk', exact: true })).toBeVisible();

  await chooseProfile('Çocuk');
  await page.goto(dubbed.path);
  await page.getByRole('link', { name: 'Oynat' }).first().click();
  await expect(page.getByText('Bu başlık bu profilin yaş sınırının üstünde.')).toBeVisible();
});

test('watches the dubbed title, switches audio and subtitles, and finds it to continue', async () => {
  await chooseProfile('Main');
  await page.goto(dubbed.path);
  await page.getByRole('link', { name: 'Oynat' }).first().click();
  await page.waitForURL(/\/watch\//);

  const video = page.locator('video');
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime), { timeout: 30_000 })
    .toBeGreaterThan(2);

  await page.getByRole('button', { name: 'Ses, altyazı ve kalite' }).click();
  await page.getByRole('menuitemradio', { name: 'İngilizce' }).first().click();
  await page.getByRole('button', { name: 'Ses, altyazı ve kalite' }).click();
  await page.getByRole('menuitemradio', { name: 'Türkçe' }).last().click();
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime), { timeout: 30_000 })
    .toBeGreaterThan(6);

  // The choice is the profile's: the next session starts in it.
  await page.reload();
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime), { timeout: 30_000 })
    .toBeGreaterThan(1);
  await page.getByRole('button', { name: 'Ses, altyazı ve kalite' }).click();
  await expect(page.getByRole('menuitemradio', { name: 'İngilizce' }).first()).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByRole('menuitemradio', { name: 'Türkçe' }).last()).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.keyboard.press('Escape');

  await page.getByRole('link', { name: 'Geri dön' }).click();
  await page.goto('/tr');
  const continuing = page.getByRole('region', { name: 'İzlemeye devam et' });
  await expect(continuing.getByRole('link', { name: new RegExp(dubbed.title) }).first()).toBeVisible({
    timeout: 30_000,
  });
});

test('keeps a title on My List once, and takes it off', async () => {
  await page.goto(dubbed.path);
  await page.getByRole('button', { name: 'Listeme ekle', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Listemden çıkar', exact: true })).toBeVisible();

  await page.goto('/tr/my-list');
  await expect(page.getByRole('link', { name: new RegExp(dubbed.title) })).toHaveCount(1);

  await page.goto(dubbed.path);
  await page.getByRole('button', { name: 'Listemden çıkar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Listeme ekle', exact: true })).toBeVisible();
  await page.goto('/tr/my-list');
  await expect(page.getByText(/Listende henüz bir şey yok/)).toBeVisible();
});

test('changes the e-mail address with a link sent to the new one', async () => {
  await page.goto('/tr/account');
  await page.getByRole('button', { name: 'E-postayı değiştir' }).click();
  const form = page.getByRole('form', { name: 'E-postayı değiştir' });
  await form.getByLabel('Yeni e-posta').fill(account.newEmail);
  await form.getByLabel('Mevcut şifre').fill(`${account.password}-wrong`);
  await form.getByRole('button', { name: 'Onay bağlantısı gönder' }).click();
  await expect(form.getByText('Şifre hatalı.')).toBeVisible();

  const startedAt = new Date();
  await form.getByLabel('Mevcut şifre').fill(account.password);
  await form.getByRole('button', { name: 'Onay bağlantısı gönder' }).click();
  await expect(page.getByRole('status').filter({ hasText: account.newEmail })).toBeVisible();

  const email = await waitForEmail(account.newEmail, /onayla/i, startedAt);
  await page.goto(linkTo(email, '/change-email'));
  await expect(page.getByText('E-posta adresin değişti.')).toBeVisible();
  // The old address heard of it.
  await waitForEmail(account.email, /değiştirildi/i, startedAt);

  // Signing in takes the new address, not the old one.
  await page.goto('/tr');
  await page.getByRole('button', { name: /Profil menüsü/ }).click();
  await page.getByRole('menuitem', { name: 'Çıkış yap' }).click();
  await signIn(account.email);
  await expect(page.getByText('E-posta ya da şifre hatalı.')).toBeVisible();
  await signIn(account.newEmail);
  await page.waitForURL((url) => !url.pathname.endsWith('/sign-in'));
  await page.goto('/tr/account');
  await expect(page.getByRole('region', { name: 'Giriş bilgileri' })).toContainText(account.newEmail);
});

async function signIn(address: string) {
  await page.goto('/tr/sign-in');
  await page.getByLabel('E-posta').fill(address);
  await page.getByLabel('Şifre').fill(account.password);
  await page.getByRole('main').getByRole('button', { name: 'Giriş yap' }).click();
}

test('deletes the account, after which it cannot sign in', async () => {
  await page.goto('/tr/account');
  await page.getByRole('button', { name: 'Hesabı sil' }).click();
  const dialog = page.getByRole('dialog', { name: 'Hesabın kalıcı olarak silinsin mi?' });
  await expect(dialog).toContainText('Aktif üyeliğin hemen ve iadesiz iptal edilir.');
  await dialog.getByLabel('Mevcut şifre').fill(account.password);
  await dialog.getByRole('button', { name: 'Hesabı kalıcı olarak sil' }).click();
  await expect(page.getByRole('heading', { name: 'Hesabın silindi.' })).toBeVisible();

  await signIn(account.newEmail);
  await expect(page.getByText('E-posta ya da şifre hatalı.')).toBeVisible();
});
