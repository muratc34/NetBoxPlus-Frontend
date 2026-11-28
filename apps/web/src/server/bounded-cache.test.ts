// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { boundedCache } from './bounded-cache';

/** What Next keeps under each key; an entry here is answered as it is, however old, like an expired entry is. */
const kept = new Map<string, unknown>();
const options: { revalidate?: number; tags?: string[] }[] = [];

vi.mock('next/cache', () => ({
  unstable_cache:
    <T>(load: () => Promise<T>, key: string[], given: { revalidate?: number; tags?: string[] }) =>
    async () => {
      options.push(given);
      const name = key.join('|');
      if (!kept.has(name)) {
        kept.set(name, await load());
      }
      return kept.get(name);
    },
}));

const now = new Date('2026-11-28T12:00:00Z');

beforeEach(() => {
  kept.clear();
  options.length = 0;
  vi.useFakeTimers({ now, toFake: ['Date'] });
});

afterEach(() => {
  vi.useRealTimers();
});

function reader() {
  let reads = 0;
  return {
    load: () => Promise.resolve(`read ${String(++reads)}`),
    get reads() {
      return reads;
    },
  };
}

describe('boundedCache', () => {
  it('answers from the cache while the entry is young enough, with Next’s refresh time and tags', async () => {
    const source = reader();
    const settings = { revalidate: 60, maxAge: 300, tags: ['catalog'] };

    expect(await boundedCache(source.load, ['k'], settings)).toBe('read 1');
    vi.setSystemTime(now.getTime() + 300_000);
    expect(await boundedCache(source.load, ['k'], settings)).toBe('read 1');

    expect(source.reads).toBe(1);
    expect(options[0]).toEqual({ revalidate: 60, tags: ['catalog'] });
  });

  it('reads again instead of showing an entry older than its limit', async () => {
    const source = reader();
    await boundedCache(source.load, ['k'], { revalidate: 60, maxAge: 300 });

    // Two days without a visit: Next would answer the old entry once more.
    vi.setSystemTime(now.getTime() + 2 * 24 * 3600_000);

    expect(await boundedCache(source.load, ['k'], { revalidate: 60, maxAge: 300 })).toBe('read 2');
    expect(options[1]).toEqual({ revalidate: 60 });
  });

  it('counts an entry kept before entries were stamped as too old', async () => {
    kept.set('k', 'an old list');
    const source = reader();

    expect(await boundedCache(source.load, ['k'], { revalidate: 60, maxAge: 300 })).toBe('read 1');
  });
});
