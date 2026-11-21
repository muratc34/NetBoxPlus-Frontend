import { writeFileSync } from 'node:fs';
import { chromium, expect, test, type TestInfo } from '@playwright/test';
import lighthouse from 'lighthouse';
import desktop from 'lighthouse/core/config/desktop-config.js';
import { urls } from '../support/environment';

/**
 * Lighthouse on the catalog pages (Phase 8 exit criterion 5), against the web app's production build only
 * (a development server is slow by design). The criterion is Lighthouse's desktop preset: performance,
 * accessibility and SEO at least 90. The mobile preset (slow 4G, 4x CPU) is measured and reported but not
 * held to it: Catalog keeps one size per image and the web app serves it as stored, so a throttled phone
 * fetches more image bytes than it draws. The reports go to the test's output folder.
 */
const pages = [
  { name: 'home', path: '/tr' },
  { name: 'movies', path: '/tr/movies' },
  { name: 'movie', path: '/tr/movies/01a1def6-c6b6-7861-8e7b-ff96b7664cf0' },
  { name: 'series', path: '/tr/series/01a1def7-8fdc-76e7-9d41-6d5e2628c2bf' },
  // Kept out of search engines on purpose (noindex), which Lighthouse's SEO score counts against it.
  { name: 'search', path: '/tr/search?q=deniz', indexed: false },
];
const categories = ['performance', 'accessibility', 'seo'] as const;
type Scores = Record<(typeof categories)[number], number>;
const port = 9333;

async function measure(
  path: string,
  preset: 'desktop' | 'mobile',
  name: string,
  info: TestInfo,
): Promise<Scores> {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: [`--remote-debugging-port=${String(port)}`],
  });
  try {
    const result = await lighthouse(
      `${urls.web}${path}`,
      { port, output: ['html', 'json'], onlyCategories: [...categories], logLevel: 'error' },
      preset === 'desktop' ? desktop : undefined,
    );
    if (!result) {
      throw new Error('Lighthouse returned no result.');
    }
    const [html, json] = result.report as string[];
    writeFileSync(info.outputPath(`${name}-${preset}.html`), html ?? '');
    writeFileSync(info.outputPath(`${name}-${preset}.json`), json ?? '');
    const scores = Object.fromEntries(
      categories.map((category) => [
        category,
        Math.round((result.lhr.categories[category]?.score ?? 0) * 100),
      ]),
    ) as Scores;
    await info.attach(`${preset} scores`, { body: JSON.stringify(scores), contentType: 'application/json' });
    console.log(`${name} ${preset}: ${JSON.stringify(scores)}`);
    return scores;
  } finally {
    await browser.close();
  }
}

for (const target of pages) {
  test(`${target.name} scores at least 90 on desktop`, async ({ request }, info) => {
    // A development build answers with its hot-reload client; Lighthouse would measure that.
    const html = await (await request.get(`${urls.web}/tr`)).text();
    expect(html.includes('hmr-client'), 'the web app runs its production build').toBe(false);

    const scores = await measure(target.path, 'desktop', target.name, info);
    for (const category of categories) {
      if (category === 'seo' && target.indexed === false) {
        continue;
      }
      expect.soft(scores[category], `${target.name} ${category}`).toBeGreaterThanOrEqual(90);
    }
    await measure(target.path, 'mobile', target.name, info);
  });
}
