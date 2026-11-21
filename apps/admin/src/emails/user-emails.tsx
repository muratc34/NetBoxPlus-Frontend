import { problemMessageKey } from '@netboxplus/core';
import { useId } from 'react';
import { Link } from 'react-router';
import { useEmails } from '../data/emails';
import { useLocale } from '../i18n';
import { paths } from '../paths';
import { useDateTime } from '../videos/video-format';
import { EmailStatusBadge } from './email-status';

/** How many of a user's e-mails their page shows; the queue has the rest. */
export const userEmailCount = 5;

/** A user's e-mails on their page, read beside the account (the user page starts the request). */
export function useUserEmails(userId: string, enabled: boolean) {
  return useEmails({ userId, page: 1, pageSize: userEmailCount }, enabled);
}

/** The user's latest e-mails, each opening its page, and the way to all of them. */
export function UserEmails({ userId }: Readonly<{ userId: string }>) {
  const { t } = useLocale();
  const id = useId();
  const emails = useUserEmails(userId, true);
  const dateTime = useDateTime();

  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 rounded-lg bg-surface p-6">
      <h2 id={id} className="font-display text-xl font-bold text-ink-strong">
        {t('admin.emails.title')}
      </h2>
      {emails.isPending ? (
        <p aria-busy="true" className="text-ink-muted">
          {t('browse.loading')}
        </p>
      ) : emails.isError ? (
        <p role="alert" className="text-ink-muted">
          {t(problemMessageKey(emails.error))}
        </p>
      ) : emails.data.items.length === 0 ? (
        <p className="text-ink-muted">{t('admin.emails.none')}</p>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-line">
            {emails.data.items.map((email) => (
              <li key={email.id} className="flex flex-wrap items-center gap-3 py-2">
                <Link
                  to={paths.email(email.id)}
                  className="font-semibold text-ink-strong hover:underline focus-visible:outline-3 focus-visible:outline-focus"
                >
                  {email.subject}
                </Link>
                <EmailStatusBadge status={email.status} />
                <span className="text-sm text-ink-muted">{dateTime(email.createdAt)}</span>
              </li>
            ))}
          </ul>
          {emails.data.totalCount > emails.data.items.length && (
            <Link
              to={`${paths.emails}?${new URLSearchParams({ userId }).toString()}`}
              className="self-start text-sm underline focus-visible:outline-3 focus-visible:outline-focus"
            >
              {t('admin.subscriptions.seeAll').replace('{count}', String(emails.data.totalCount))}
            </Link>
          )}
        </>
      )}
    </section>
  );
}
