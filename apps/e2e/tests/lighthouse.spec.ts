import { writeFileSync } from 'node:fs';
import { chromium, expect, test, type TestInfo } from '@playwright/test';
import lighthouse from 'lighthouse';
import desktop from 'lighthouse/core/config/desktop-config.js';
import { urls } from '../support/environment';

/**
 * Lighthouse on the catalog pages (Phase 8 exit criterion 5), against the web app's production build only
 * (a development server is slow by design). The criterion is Lighthouse's desktop preset: performance,
 * accessibility and SEO at least 90. The mobile preset (slow 4G, 4x CPU) is measured and reported but not
 * held to it (it is held back by JavaScript, not by images). The movie and series measured are the catalog's
 * most watched ones, whatever it holds. The reports go to the test's output folder.
 */
async function mostWatched(kind: 'Movie' | 'Series'): Promise<{ id: string; title: string }> {
  const response = await fetch(`${urls.gateway}/catalog/titles?lang=tr&kind=${kind}&sort=Popular&pageSize=1`);
  const found = ((await response.json()) as { items: { id: string; title: string }[] }).items[0];
  if (!found) {
    throw new Error(`The catalog has no published ${kind.toLowerCase()} to measure.`);
  }
  return found;
}

const movie = await mostWatched('Movie');
const series = await mostWatched('Series');
const pages = [
  { name: 'home', path: '/tr' },
  { name: 'movies', path: '/tr/movies' },
  { name: 'movie', path: `/tr/movies/${movie.id}` },
  { name: 'series', path: `/tr/series/${series.id}` },
  // Kept out of search engines on purpose (noindex), which Lighthouse's SEO score counts against it.
  {
    name: 'search',
    path: `/tr/search?q=${encodeURIComponent(movie.title.split(' ')[0] ?? '')}`,
    indexed: false,
  },
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
