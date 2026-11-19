'use client';

import type { MessageKey } from '@netboxplus/i18n';
import { problemMessageKey, useConfirmEmail, useConfirmEmailChange, useSession } from '@netboxplus/core';
import type { UseMutationResult } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { FormAlert } from '../../components/form';
import { useLocale } from '../../i18n/translator';
import { routes } from '../../routes';

interface TokenConfirmationProps {
  readonly useConfirm: () => UseMutationResult<unknown, Error, string>;
  readonly working: MessageKey;
  readonly done: MessageKey;
}

/**
 * The page an e-mail link opens: it sends the link's token once and shows how that went. The token is
 * single-use, so a second send (a re-render, React's development double effects) would only fail.
 */
export function TokenConfirmation({ useConfirm, working, done }: TokenConfirmationProps) {
  const { locale, t } = useLocale();
  const token = useSearchParams().get('token') ?? '';
  const session = useSession();
  const confirm = useConfirm();
  const { mutate } = confirm;
  const sent = useRef(false);

  useEffect(() => {
    // A signed-in tab sends its session cookie, and a change with a cookie needs the session's CSRF
    // token: wait until the session is known.
    if (token === '' || session.isPending || sent.current) {
      return;
    }
    sent.current = true;
    mutate(token);
  }, [token, session.isPending, mutate]);

  if (token === '') {
    return <FormAlert tone="error">{t('auth.link.missing')}</FormAlert>;
  }

  if (confirm.isError) {
    return <FormAlert tone="error">{t(problemMessageKey(confirm.error))}</FormAlert>;
  }

  if (confirm.isSuccess) {
    return (
      <div className="flex flex-col gap-5">
        <FormAlert tone="success">{t(done)}</FormAlert>
        <Link href={routes.home(locale)} className="font-semibold text-ink-strong hover:underline">
          {t('auth.continue')}
        </Link>
      </div>
    );
  }

  return (
    <p role="status" className="text-ink-muted">
      {t(working)}
    </p>
  );
}

/** `/verify-email?token=…`, from the e-mail sent after registering or on asking again. */
export function EmailVerification() {
  return (
    <TokenConfirmation useConfirm={useConfirmEmail} working="auth.verify.working" done="auth.verify.done" />
  );
}

/** `/change-email?token=…`, from the e-mail sent to the new address. */
export function EmailChangeConfirmation() {
  return (
    <TokenConfirmation
      useConfirm={useConfirmEmailChange}
      working="auth.change.working"
      done="auth.change.done"
    />
  );
}
