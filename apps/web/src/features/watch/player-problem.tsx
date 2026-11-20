'use client';

import { isApiError } from '@netboxplus/api';
import { problemMessageKey } from '@netboxplus/core';
import { Button, classNames } from '@netboxplus/ui';
import * as Dialog from '@radix-ui/react-dialog';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { useLocale } from '../../i18n/translator';
import { profilesPath, routes } from '../../routes';

/**
 * Why playing stopped, as a dialog over the player, with what helps: the plans without a membership,
 * another profile for one too young or gone, trying again for the rest. Closing it goes back. It opens
 * inside `container` (the player), which may be the full-screen element.
 */
export function PlaybackProblem({
  failure,
  backHref,
  container,
  onRetry,
}: Readonly<{
  /** The request's error, or `media` when the video itself could not be played. */
  failure: unknown;
  backHref: string;
  container: HTMLElement | null;
  onRetry: () => void;
}>) {
  const { locale, t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const here = search ? `${pathname}?${search}` : pathname;
  const code = isApiError(failure) ? failure.code : undefined;
  const message = failure === 'media' ? t('player.error.media') : t(problemMessageKey(failure));

  const link = (href: string, label: string, primary: boolean): ReactNode => (
    <Link
      href={href}
      className={classNames(
        'inline-flex h-11 items-center justify-center rounded-md px-5 font-semibold text-white',
        'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus',
        primary ? 'bg-brand-strong hover:bg-brand-strong-hover' : 'bg-white/15 hover:bg-white/25',
      )}
    >
      {label}
    </Link>
  );
  const retryButton = <Button onClick={onRetry}>{t('player.retry')}</Button>;

  const actions =
    code === 'Playback.SubscriptionRequired' ? (
      link(routes.plans(locale), t('player.seePlans'), true)
    ) : code === 'Playback.AgeRestricted' || code === 'Playback.ProfileNotFound' ? (
      link(profilesPath(locale, here), t('player.switchProfile'), true)
    ) : code === 'Playback.NotAvailable' ? null : code === 'Playback.TooManyScreens' ? (
      <>
        {retryButton}
        {link(routes.account(locale), t('player.account'), false)}
      </>
    ) : (
      retryButton
    );

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) {
          router.push(backHref);
        }
      }}
    >
      <Dialog.Portal container={container}>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/75" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-[60] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg bg-surface p-6 text-ink shadow-xl sm:p-8">
          <Dialog.Title className="font-display text-2xl font-bold text-ink-strong">
            {t('player.error.title')}
          </Dialog.Title>
          <Dialog.Description className="text-ink">{message}</Dialog.Description>
          <div className="flex flex-wrap gap-3">
            {actions}
            {link(backHref, t('player.back'), false)}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
