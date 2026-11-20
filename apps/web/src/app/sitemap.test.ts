// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadPublishedTitles } from '../server/catalog';
import robots from './robots';
import sitemap from './sitemap';

vi.mock('../server/catalog', () => ({ loadPublishedTitles: vi.fn() }));

beforeEach(() => {
  vi.stubEnv('SITE_URL', 'https://app.netboxplus.test');
});

describe('sitemap', () => {
  it('lists the catalog pages, the plans and every published title in both languages, each naming its twin', async () => {
    vi.mocked(loadPublishedTitles).mockResolvedValue([
      { id: 'm1', kind: 'Movie' },
      { id: 's1', kind: 'Series' },
    ]);

    const entries = await sitemap();

    expect(entries.map((entry) => entry.url)).toEqual([
      'https://app.netboxplus.test/tr',
      'https://app.netboxplus.test/en',
      'https://app.netboxplus.test/tr/movies',
      'https://app.netboxplus.test/en/movies',
      'https://app.netboxplus.test/tr/series',
      'https://app.netboxplus.test/en/series',
      'https://app.netboxplus.test/tr/plans',
      'https://app.netboxplus.test/en/plans',
      'https://app.netboxplus.test/tr/movies/m1',
      'https://app.netboxplus.test/en/movies/m1',
      'https://app.netboxplus.test/tr/series/s1',
      'https://app.netboxplus.test/en/series/s1',
    ]);
    expect(entries[9]?.alternates?.languages).toEqual({
      tr: 'https://app.netboxplus.test/tr/movies/m1',
      en: 'https://app.netboxplus.test/en/movies/m1',
    });
  });
});

describe('robots', () => {
  it('lets crawlers in and points them to the sitemap', () => {
    expect(robots()).toEqual({
      rules: { userAgent: '*', allow: '/' },
      sitemap: 'https://app.netboxplus.test/sitemap.xml',
    });
  });
});
