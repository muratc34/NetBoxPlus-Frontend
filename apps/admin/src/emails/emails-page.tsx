import { problemMessageKey } from '@netboxplus/core';
import { SelectField } from '@netboxplus/ui';
import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router';
import { pageOf } from '../components/address-search';
import { buttonClass } from '../components/buttons';
import { Pagination } from '../components/pagination';
import { emailKinds, emailsPageSize, emailStatuses, useEmails } from '../data/emails';
import { useLocale } from '../i18n';
import { paths } from '../paths';
import { useDateTime } from '../videos/video-format';
import { EmailStatusBadge } from './email-status';

/**
 * The e-mail queue, newest first, by status, kind and, from a user's page, by user; the filters live in
 * the address. The list asks again while an e-mail is still waiting to go.
 */
export function EmailsPage() {
  const { t } = useLocale();
  const [params, setParams] = useSearchParams();
  const status = emailStatuses.find((value) => value === params.get('status'));
  const kind = emailKinds.find((value) => value === params.get('kind'));
  const userId = params.get('userId') ?? undefined;
  const page = pageOf(params.get('page'));
  const emails = useEmails({ status, kind, userId, page });
  const dateTime = useDateTime();

  useEffect(() => {
    document.title = t('admin.emails.title');
  }, [t]);

  function change(name: string, value: string) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (name !== 'page') {
        next.delete('page');
      }
      if (value) {
        next.set(name, value);
      } else {
        next.delete(name);
      }
      return next;
    });
  }

  return (
    <>
      <h1 className="font-display text-3xl font-bold text-ink-strong">{t('admin.emails.title')}</h1>
      <div className="flex flex-wrap items-end gap-4">
        <SelectField
          className="w-48"
          label={t('admin.filter.status')}
          value={status ?? ''}
          options={[
            { value: '', label: t('admin.filter.all') },
            ...emailStatuses.map((value) => ({ value, label: t(`admin.emails.status.${value}`) })),
          ]}
          onChange={(event) => {
            change('status', event.target.value);
          }}
        />
        <SelectField
          className="w-72"
          label={t('admin.emails.kind')}
          value={kind ?? ''}
          options={[
            { value: '', label: t('admin.filter.all') },
            ...emailKinds.map((value) => ({ value, label: t(`admin.emails.kind.${value}`) })),
          ]}
          onChange={(event) => {
            change('kind', event.target.value);
          }}
        />
        {userId && (
          <p className="flex items-center gap-3 text-sm text-ink">
            {t('admin.emails.oneUser')}
            <button
              type="button"
              className={buttonClass('ghost', 'sm')}
              onClick={() => {
                change('userId', '');
              }}
            >
              {t('admin.subscriptions.allUsers')}
            </button>
          </p>
        )}
      </div>
      {emails.isPending ? (
        <p aria-busy="true" className="text-ink-muted">
          {t('browse.loading')}
        </p>
      ) : emails.isError ? (
        <p role="alert" className="text-ink-muted">
          {t(problemMessageKey(emails.error))}
        </p>
      ) : emails.data.items.length === 0 ? (
        <p className="text-ink-muted">{t('admin.emails.empty')}</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="text-ink-muted">
                <tr className="border-b border-line">
                  {[
                    t('admin.emails.subject'),
                    t('admin.emails.kind'),
                    t('admin.content.status'),
                    t('admin.emails.attempts'),
                    t('admin.emails.created'),
                  ].map((header) => (
                    <th key={header} scope="col" className="px-4 py-3 font-normal">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {emails.data.items.map((email) => (
                  <tr key={email.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        to={paths.email(email.id)}
                        className="font-semibold text-ink-strong hover:underline focus-visible:outline-3 focus-visible:outline-focus"
                      >
                        {email.subject}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{t(`admin.emails.kind.${email.kind}`)}</td>
                    <td className="px-4 py-3">
                      <EmailStatusBadge status={email.status} />
                    </td>
                    <td className="px-4 py-3 tabular-nums">{email.attempts}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{dateTime(email.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={emailsPageSize}
            total={emails.data.totalCount}
            onPage={(next) => {
              change('page', String(next));
            }}
          />
        </>
      )}
    </>
  );
}
