import { problemMessageKey } from '@netboxplus/core';
import { FormAlert } from '@netboxplus/ui';
import { useEffect, useId, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { buttonClass } from '../components/buttons';
import { useEmail, useRetryEmail, type EmailDetails } from '../data/emails';
import { can, useAdminSession } from '../data/session';
import { useLocale } from '../i18n';
import { paths } from '../paths';
import { useDateTime } from '../videos/video-format';
import { EmailStatusBadge } from './email-status';

/**
 * One e-mail of the queue: its kind, state, attempts and last error, and sending a failed one again while
 * its content is kept. The address it went to is not shown: Notification keeps it with the recipient.
 */
export function EmailPage() {
  const { t } = useLocale();
  const id = useParams().id ?? '';
  const email = useEmail(id);

  useEffect(() => {
    document.title = email.data?.subject ?? t('admin.emails.title');
  }, [email.data?.subject, t]);

  if (email.isPending) {
    return (
      <p aria-busy="true" className="text-ink-muted">
        {t('browse.loading')}
      </p>
    );
  }
  if (email.isError) {
    return (
      <p role="alert" className="text-ink-muted">
        {t(problemMessageKey(email.error))}
      </p>
    );
  }
  return <EmailView email={email.data} />;
}

function EmailView({ email }: Readonly<{ email: EmailDetails }>) {
  const { t } = useLocale();
  const session = useAdminSession();
  const dateTime = useDateTime();

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold text-ink-strong">{email.subject}</h1>
        <EmailStatusBadge status={email.status} />
      </div>
      <section className="rounded-lg bg-surface p-6">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Fact term={t('admin.emails.kind')}>{t(`admin.emails.kind.${email.kind}`)}</Fact>
          <Fact term={t('admin.subscriptions.user')}>
            {can(session.data, 'auth:users:read') ? (
              <Link
                to={paths.user(email.userId)}
                className="underline focus-visible:outline-3 focus-visible:outline-focus"
              >
                {t('admin.emails.openUser')}
              </Link>
            ) : (
              <code className="text-sm break-all">{email.userId}</code>
            )}
          </Fact>
          <Fact term={t('admin.emails.attempts')}>{String(email.attempts)}</Fact>
          <Fact term={t('admin.emails.created')}>{dateTime(email.createdAt)}</Fact>
          <Fact term={t('admin.emails.sent')}>{email.sentAt ? dateTime(email.sentAt) : '—'}</Fact>
          {email.status === 'Pending' && (
            <Fact term={t('admin.emails.nextAttempt')}>{dateTime(email.nextAttemptAt)}</Fact>
          )}
          <Fact term={t('admin.emails.content')}>
            {email.hasContent ? t('admin.emails.contentKept') : t('admin.emails.contentGone')}
          </Fact>
          <Fact term={t('admin.emails.source')}>
            <code className="text-sm break-all">{email.sourceKey}</code>
          </Fact>
        </dl>
        {email.lastError && (
          <div className="mt-4">
            <p className="text-sm text-ink-muted">{t('admin.emails.lastError')}</p>
            <pre className="mt-1 overflow-x-auto rounded-md bg-black/30 p-3 text-sm whitespace-pre-wrap text-red-200">
              {email.lastError}
            </pre>
          </div>
        )}
      </section>
      {email.status === 'Failed' && can(session.data, 'notification:emails:write') && (
        <EmailRetry email={email} />
      )}
    </>
  );
}

/** Sending a failed e-mail again, from its first attempt; not once its content is gone. */
function EmailRetry({ email }: Readonly<{ email: EmailDetails }>) {
  const { t } = useLocale();
  const id = useId();
  const retry = useRetryEmail(email.id);

  return (
    <section aria-labelledby={id} className="flex flex-col items-start gap-3 rounded-lg bg-surface p-6">
      <h2 id={id} className="font-display text-xl font-bold text-ink-strong">
        {t('admin.emails.retry')}
      </h2>
      {email.hasContent ? (
        <>
          <p className="text-ink-muted">{t('admin.emails.retryNote')}</p>
          {retry.isError && <FormAlert tone="error">{t(problemMessageKey(retry.error))}</FormAlert>}
          <button
            type="button"
            className={buttonClass('primary')}
            disabled={retry.isPending}
            onClick={() => {
              retry.mutate();
            }}
          >
            {retry.isPending ? t('auth.working') : t('admin.emails.retry')}
          </button>
        </>
      ) : (
        <p className="text-ink-muted">{t('admin.emails.retryGone')}</p>
      )}
    </section>
  );
}

function Fact({ term, children }: Readonly<{ term: string; children: ReactNode }>) {
  return (
    <div>
      <dt className="text-sm text-ink-muted">{term}</dt>
      <dd className="font-semibold text-ink-strong">{children}</dd>
    </div>
  );
}
