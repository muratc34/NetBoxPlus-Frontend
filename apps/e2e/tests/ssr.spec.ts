import { expect, test } from '@playwright/test';

/**
 * Catalog pages come from the server: with JavaScript off the content and the meta tags are there
 * (Phase 8 exit criterion 4). Seeded titles only.
 */
test.use({ javaScriptEnabled: false });

const meta = (name: string) => `meta[name="${name}"], meta[property="${name}"]`;

test('the home page has its rows and meta tags without JavaScript', async ({ page }) => {
  await page.goto('/tr');
  await expect(page).toHaveTitle(/NetBoxPlus/);
  await expect(page.locator(meta('description'))).toHaveAttribute('content', /.+/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/tr$/);
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', /\/en$/);
  await expect(page.getByRole('link', { name: /Kuzey Işığı/ }).first()).toBeVisible();
});

test('a movie page has its content and Open Graph tags without JavaScript', async ({ page }) => {
  await page.goto('/tr/movies/01a1def6-c6b6-7861-8e7b-ff96b7664cf0');
  await expect(page.getByRole('heading', { level: 1, name: 'Kuzey Işığı' })).toBeVisible();
  await expect(page.getByText(/deniz fenerinde/)).toBeVisible();
  await expect(page).toHaveTitle(/Kuzey Işığı/);
  await expect(page.locator(meta('description'))).toHaveAttribute('content', /deniz fenerinde/);
  await expect(page.locator(meta('og:type'))).toHaveAttribute('content', 'video.movie');
  await expect(page.locator(meta('og:title'))).toHaveAttribute('content', /Kuzey Işığı/);
  await expect(page.locator(meta('og:image'))).toHaveAttribute('content', /^https?:\/\//);
});

test('a series page and search work without JavaScript', async ({ page }) => {
  await page.goto('/tr/series');
  const series = page.getByRole('link', { name: /Rüzgarın Kızı/ }).first();
  await expect(series).toBeVisible();
  await page.goto((await series.getAttribute('href')) ?? '');
  await expect(page.getByRole('heading', { level: 1, name: 'Rüzgarın Kızı' })).toBeVisible();
  await expect(page.locator(meta('og:type'))).toHaveAttribute('content', 'video.tv_show');

  await page.goto('/tr/search?q=deniz');
  await expect(page.getByRole('link', { name: /Kuzey Işığı/ }).first()).toBeVisible();
});
