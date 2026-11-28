'use client';

import { problemMessageKey, useSession, useUnsubscribe } from '@netboxplus/core';
import { Button } from '@netboxplus/ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormAlert } from '../../components/form';
import { useLocale } from '../../i18n/translator';
import { routes } from '../../routes';

/**
 * `/unsubscribe?token=…`, from the link at the foot of a sign-in alert. Opening it changes nothing (mail scanners
 * open links): the visitor turns the alerts off with the button. Mail programs post to the gateway themselves.
 */
export function Unsubscribe() {
  const { locale, t } = useLocale();
  const token = useSearchParams().get('token') ?? '';
  const session = useSession();
  const unsubscribe = useUnsubscribe();

  if (token === '') {
    return <FormAlert tone="error">{t('auth.link.missing')}</FormAlert>;
  }

  if (unsubscribe.isSuccess) {
    return (
      <div className="flex flex-col gap-5">
        <FormAlert tone="success">{t('unsubscribe.done')}</FormAlert>
        <Link href={routes.accountSecurity(locale)} className="font-semibold text-ink-strong hover:underline">
          {t('unsubscribe.toSecurity')}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-ink">{t('unsubscribe.body')}</p>
      {unsubscribe.isError && <FormAlert tone="error">{t(problemMessageKey(unsubscribe.error))}</FormAlert>}
      <Button
        className="self-start"
        // A signed-in tab sends its cookie, and a change with a cookie needs the session's CSRF token.
        disabled={unsubscribe.isPending || session.isPending}
        onClick={() => {
          unsubscribe.mutate(token);
        }}
      >
        {unsubscribe.isPending ? t('auth.working') : t('unsubscribe.submit')}
      </Button>
    </div>
  );
}
