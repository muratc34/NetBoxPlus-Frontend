import { urls } from '../support/environment';
import { expect, test } from '../support/catalog-fixture';

/**
 * Catalog pages come from the server: with JavaScript off the content and the meta tags are there
 * (Phase 8 exit criterion 4). The movie is the run's own; the series is any published one.
 */
test.use({ javaScriptEnabled: false });

const meta = (name: string) => `meta[name="${name}"], meta[property="${name}"]`;

/** A published series, from Catalog itself. */
async function anySeries(): Promise<{ id: string; title: string }> {
  const response = await fetch(`${urls.gateway}/catalog/titles?lang=tr&kind=Series&pageSize=1`);
  const page = (await response.json()) as { items: { id: string; title: string }[] };
  const series = page.items[0];
  if (!series) {
    throw new Error('The catalog has no published series.');
  }
  return series;
}

test('the home page has its rows and meta tags without JavaScript', async ({ page }) => {
  await page.goto('/tr');
  await expect(page).toHaveTitle(/NetBoxPlus/);
  await expect(page.locator(meta('description'))).toHaveAttribute('content', /.+/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/tr$/);
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', /\/en$/);
  await expect(page.getByRole('region', { name: 'Yeni eklenenler' }).getByRole('link').first()).toBeVisible();
});

test('the server draws the welcome for a visitor without a chosen profile, and not for one with it', async ({
  page,
  context,
}) => {
  // Drawn with the page, so nothing under it moves when the browser learns there is no session.
  await page.goto('/tr');
  await expect(page.getByRole('link', { name: 'Planları gör' })).toBeVisible();

  const { hostname } = new URL(page.url());
  await context.addCookies([
    { name: 'nbp-profile', value: '0195f0e0-0000-7000-8000-000000000001.Age18', domain: hostname, path: '/' },
  ]);
  await page.goto('/tr');
  await expect(page.getByRole('region', { name: 'Yeni eklenenler' }).getByRole('link').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Planları gör' })).toHaveCount(0);
});

test('a movie page has its content and Open Graph tags without JavaScript', async ({ page, dubbedMovie }) => {
  await page.goto(dubbedMovie.path);
  await expect(page.getByRole('heading', { level: 1, name: dubbedMovie.title })).toBeVisible();
  await expect(page.getByText(dubbedMovie.synopsis)).toBeVisible();
  await expect(page).toHaveTitle(new RegExp(dubbedMovie.title));
  await expect(page.locator(meta('description'))).toHaveAttribute('content', dubbedMovie.synopsis);
  await expect(page.locator(meta('og:type'))).toHaveAttribute('content', 'video.movie');
  await expect(page.locator(meta('og:title'))).toHaveAttribute('content', new RegExp(dubbedMovie.title));
  await expect(page.locator(meta('og:image'))).toHaveAttribute('content', /^https?:\/\//);
});

test('a series page and search work without JavaScript', async ({ page, dubbedMovie }) => {
  const series = await anySeries();
  await page.goto(`/tr/series/${series.id}`);
  await expect(page.getByRole('heading', { level: 1, name: series.title })).toBeVisible();
  await expect(page.locator(meta('og:type'))).toHaveAttribute('content', 'video.tv_show');

  // The search index takes the new movie a moment after it is published. Asked of Catalog itself first: the
  // web app keeps a result for a minute, so asking the page too early would keep the empty one.
  const word = dubbedMovie.title.split(' ').at(-1) ?? '';
  await expect
    .poll(
      async () => {
        const response = await fetch(`${urls.gateway}/catalog/search?q=${encodeURIComponent(word)}&lang=tr`);
        return ((await response.json()) as { totalCount: number }).totalCount;
      },
      { timeout: 60_000, intervals: [1000] },
    )
    .toBeGreaterThan(0);
  await page.goto(`/tr/search?q=${encodeURIComponent(word)}`);
  await expect(page.getByRole('link', { name: dubbedMovie.title }).first()).toBeVisible();
});
