import { unstable_cache } from 'next/cache';

interface Stamped<T> {
  readonly storedAt: number;
  readonly value: T;
}

function isStamped(entry: unknown): entry is Stamped<unknown> {
  return (
    typeof entry === 'object' && entry !== null && 'storedAt' in entry && typeof entry.storedAt === 'number'
  );
}

export interface BoundedCacheOptions {
  /** After this many seconds an entry is refreshed in the background, as `unstable_cache` does. */
  readonly revalidate: number;
  /**
   * The oldest an entry may be and still be shown, in seconds. Next answers an expired entry once more while it
   * refreshes it, however old: a page nobody opened for days showed days-old lists (titles taken down since
   * included). An entry older than this is not shown: the visitor waits for a fresh read.
   */
  readonly maxAge: number;
  readonly tags?: string[];
}

/**
 * `unstable_cache` with a limit on how stale an answer can be. The entry carries the time it was read; a too old one
 * is read again for this visitor, and Next's own background refresh replaces it for the next.
 */
export async function boundedCache<T>(
  load: () => Promise<T>,
  key: string[],
  options: BoundedCacheOptions,
): Promise<T> {
  const entry: unknown = await unstable_cache(
    async (): Promise<Stamped<T>> => ({ storedAt: Date.now(), value: await load() }),
    key,
    {
      revalidate: options.revalidate,
      ...(options.tags ? { tags: options.tags } : {}),
    },
  )();
  // An entry kept before entries were stamped counts as too old.
  if (isStamped(entry) && Date.now() - entry.storedAt <= options.maxAge * 1000) {
    return entry.value as T;
  }
  return load();
}
