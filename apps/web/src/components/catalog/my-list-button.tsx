'use client';

import { problemMessageKey, useChangeMyList, useMyList, useSession, type TitleKind } from '@netboxplus/core';
import { classNames } from '@netboxplus/ui';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from '../../i18n/translator';
import { useWatchingProfile } from '../../profiles/profile-selection';
import { signInPath } from '../../routes';

/**
 * Puts the title on the watching profile's list or takes it off. On a card it is a round icon button that
 * appears only for a signed-in profile; on a title's page a labelled button that sends a visitor without a
 * session to sign in first. Streaming's refusal (full list, age, not watchable) is said under it.
 */
export function MyListButton({
  titleId,
  kind,
  title,
  variant,
}: Readonly<{ titleId: string; kind: TitleKind; title: string; variant: 'card' | 'hero' }>) {
  const { locale, t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();
  const profileId = useWatchingProfile();
  const list = useMyList(profileId);
  const change = useChangeMyList(profileId);
  const onList = list.data?.some((item) => item.titleId === titleId) ?? false;

  if (!profileId) {
    if (variant === 'card' || session.data !== null) {
      return null;
    }
    return (
      <button
        type="button"
        onClick={() => {
          router.push(signInPath(locale, pathname));
        }}
        className={heroClass}
      >
        <span aria-hidden="true">＋</span>
        {t('myList.add')}
      </button>
    );
  }

  const toggle = () => {
    change.mutate({ titleId, kind, onList: !onList });
  };
  const error = change.isError ? t(problemMessageKey(change.error)) : undefined;

  if (variant === 'card') {
    return (
      <span className="relative">
        <button
          type="button"
          aria-pressed={onList}
          aria-label={(onList ? t('myList.removeNamed') : t('myList.addNamed')).replace('{title}', title)}
          disabled={list.isPending || change.isPending}
          onClick={toggle}
          className="flex size-9 items-center justify-center rounded-full border-2 border-white/70 bg-black/60 text-lg text-white hover:border-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60"
        >
          <span aria-hidden="true">{onList ? '✓' : '＋'}</span>
        </button>
        {error && (
          <span
            role="alert"
            className="absolute top-full right-0 z-20 mt-2 w-56 rounded-md bg-surface-raised p-2 text-xs text-ink shadow-lg"
          >
            {error}
          </span>
        )}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-pressed={onList}
        disabled={list.isPending || change.isPending}
        onClick={toggle}
        className={heroClass}
      >
        <span aria-hidden="true">{onList ? '✓' : '＋'}</span>
        {onList ? t('myList.remove') : t('myList.add')}
      </button>
      {error && (
        <p role="alert" className="text-sm text-ink">
          {error}
        </p>
      )}
    </div>
  );
}

const heroClass = classNames(
  'inline-flex h-12 w-fit items-center gap-2 rounded-md bg-white/20 px-6 font-semibold text-white backdrop-blur-sm',
  'hover:bg-white/30 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus',
  'disabled:opacity-60',
);
