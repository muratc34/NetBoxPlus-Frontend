'use client';

import { useMyList, useSession, useTitlesByIds } from '@netboxplus/core';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { TitleCard } from '../../components/catalog/title-card';
import { useLocale } from '../../i18n/translator';
import { useWatchingProfile } from '../../profiles/profile-selection';
import { signInPath } from '../../routes';

/**
 * The watching profile's list, most recently added first. It is the profile's own, so it is asked in the
 * browser; a visitor without a session signs in first (choosing a profile is asked by the provider).
 */
export function MyListPage() {
  const { locale, t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();
  const profileId = useWatchingProfile();
  const list = useMyList(profileId);
  const ids = (list.data ?? []).map((item) => item.titleId);
  const titles = useTitlesByIds(ids, locale);

  useEffect(() => {
    if (session.data === null) {
      router.replace(signInPath(locale, pathname));
    }
  }, [session.data, router, locale, pathname]);

  const loading = !profileId || list.isPending || (ids.length > 0 && titles.isPending);

  return (
    <main className="flex flex-col gap-4 px-4 pt-4 pb-12 sm:px-8">
      <h1 className="font-display text-3xl font-bold text-ink-strong">{t('myList.title')}</h1>
      {loading ? (
        <p aria-busy="true" className="py-16 text-center text-ink-muted">
          {t('browse.loading')}
        </p>
      ) : (titles.data ?? []).length === 0 ? (
        <p className="py-16 text-center text-ink-muted">{t('myList.empty')}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-6 py-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {(titles.data ?? []).map((title) => (
            <li key={title.id}>
              <TitleCard title={title} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
