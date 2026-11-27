'use client';

import {
  problemMessageKey,
  useHistory,
  useRemoveFromHistory,
  useSession,
  useTitlesByIds,
  type HistoryItem,
  type TitleSummary,
} from '@netboxplus/core';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { TitleImage } from '../../components/catalog/title-image';
import { useLocale } from '../../i18n/translator';
import { useWatchingProfile } from '../../profiles/profile-selection';
import { routes, signInPath } from '../../routes';
import { formatDate } from '../account/membership';

/**
 * The watching profile's history: the titles it watched, most recently first, page by page. Removing one
 * also takes it out of continue watching and of what the profile's recommendations are drawn from. It is
 * the profile's own, so it is asked in the browser; a visitor without a session signs in first.
 */
export function HistoryPage() {
  const { locale, t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();
  const profileId = useWatchingProfile();
  const history = useHistory(profileId);
  const remove = useRemoveFromHistory(profileId);
  const items = history.data?.pages.flatMap((page) => page.items) ?? [];
  const titles = useTitlesByIds(
    items.map((item) => item.titleId),
    locale,
  );

  useEffect(() => {
    if (session.data === null) {
      router.replace(signInPath(locale, pathname));
    }
  }, [session.data, router, locale, pathname]);

  const loading = !profileId || history.isPending || (items.length > 0 && titles.isPending);
  const byId = new Map((titles.data ?? []).map((title) => [title.id, title]));
  const rows = items.flatMap((item) => {
    const title = byId.get(item.titleId);
    return title ? [{ item, title }] : [];
  });

  return (
    <main className="flex w-full max-w-3xl flex-col gap-4 px-4 pt-6 pb-16 sm:px-8">
      <h1 className="font-display text-3xl font-bold text-ink-strong">{t('history.title')}</h1>
      <p className="text-ink-muted">{t('history.description')}</p>
      {remove.isError && (
        <p role="alert" className="text-sm text-ink">
          {t(problemMessageKey(remove.error))}
        </p>
      )}
      {loading ? (
        <p aria-busy="true" className="py-16 text-center text-ink-muted">
          {t('browse.loading')}
        </p>
      ) : rows.length === 0 ? (
        <p className="py-16 text-center text-ink-muted">{t('history.empty')}</p>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-line">
            {rows.map(({ item, title }) => (
              <HistoryRow
                key={item.titleId}
                item={item}
                title={title}
                removing={remove.isPending && remove.variables === item.titleId}
                onRemove={() => {
                  remove.mutate(item.titleId);
                }}
              />
            ))}
          </ul>
          {history.hasNextPage && (
            <button
              type="button"
              disabled={history.isFetchingNextPage}
              onClick={() => {
                void history.fetchNextPage();
              }}
              className="mx-auto inline-flex h-11 items-center rounded-md bg-white/15 px-5 font-semibold text-white hover:bg-white/25 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60"
            >
              {t('history.more')}
            </button>
          )}
        </>
      )}
    </main>
  );
}

function HistoryRow({
  item,
  title,
  removing,
  onRemove,
}: Readonly<{ item: HistoryItem; title: TitleSummary; removing: boolean; onRemove: () => void }>) {
  const { locale, t } = useLocale();
  return (
    <li className="flex items-center gap-4 py-3">
      <Link
        href={routes.title(locale, title.kind, title.id)}
        className="flex min-w-0 flex-1 items-center gap-4 rounded-md focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <span className="w-32 shrink-0 overflow-hidden rounded-md">
          <TitleImage url={title.backdropUrl ?? title.posterUrl} title={title.title} sizes="128px" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-semibold text-ink-strong">{title.title}</span>
          <span className="text-sm text-ink-muted">
            {t('history.watchedOn').replace('{date}', formatDate(item.watchedAt, locale))}
          </span>
        </span>
      </Link>
      <button
        type="button"
        aria-label={t('history.removeNamed').replace('{title}', title.title)}
        disabled={removing}
        onClick={onRemove}
        className="inline-flex h-9 shrink-0 items-center rounded-md border border-line px-3 text-sm font-semibold text-ink hover:bg-white/10 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60"
      >
        {t('history.remove')}
      </button>
    </li>
  );
}
