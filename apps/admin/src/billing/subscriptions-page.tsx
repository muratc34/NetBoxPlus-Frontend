import { problemMessageKey } from '@netboxplus/core';
import { SelectField } from '@netboxplus/ui';
import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router';
import { pageOf } from '../components/address-search';
import { buttonClass } from '../components/buttons';
import { Pagination } from '../components/pagination';
import { billingPageSize, subscriptionStatuses, useSubscriptions } from '../data/billing';
import { useLocale } from '../i18n';
import { paths } from '../paths';
import { useDateTime } from '../videos/video-format';
import { SubscriptionStatusBadge } from './subscription-status';

/**
 * Every subscription, newest first, by status and, from a user's page, by user; both live in the address.
 * Stripe is where subscriptions change: this only reads Billing's mirror of them.
 */
export function SubscriptionsPage() {
  const { t } = useLocale();
  const [params, setParams] = useSearchParams();
  const status = subscriptionStatuses.find((value) => value === params.get('status'));
  const userId = params.get('userId') ?? undefined;
  const page = pageOf(params.get('page'));
  const subscriptions = useSubscriptions({ status, userId, page });
  const dateTime = useDateTime();

  useEffect(() => {
    document.title = t('admin.subscriptions.title');
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
      <h1 className="font-display text-3xl font-bold text-ink-strong">{t('admin.subscriptions.title')}</h1>
      <div className="flex flex-wrap items-end gap-4">
        <SelectField
          className="w-60"
          label={t('admin.filter.status')}
          value={status ?? ''}
          options={[
            { value: '', label: t('admin.filter.all') },
            ...subscriptionStatuses.map((value) => ({ value, label: t(`account.status.${value}`) })),
          ]}
          onChange={(event) => {
            change('status', event.target.value);
          }}
        />
        {userId && (
          <p className="flex items-center gap-3 text-sm text-ink">
            {t('admin.subscriptions.oneUser')}
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
      {subscriptions.isPending ? (
        <p aria-busy="true" className="text-ink-muted">
          {t('browse.loading')}
        </p>
      ) : subscriptions.isError ? (
        <p role="alert" className="text-ink-muted">
          {t(problemMessageKey(subscriptions.error))}
        </p>
      ) : subscriptions.data.items.length === 0 ? (
        <p className="text-ink-muted">{t('admin.subscriptions.empty')}</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="text-ink-muted">
                <tr className="border-b border-line">
                  {[
                    t('admin.users.email'),
                    t('admin.subscriptions.plan'),
                    t('admin.content.status'),
                    t('admin.subscriptions.periodEnd'),
                    t('admin.subscriptions.started'),
                  ].map((header) => (
                    <th key={header} scope="col" className="px-4 py-3 font-normal">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subscriptions.data.items.map((subscription) => (
                  <tr key={subscription.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        to={paths.subscription(subscription.id)}
                        className="font-semibold break-all text-ink-strong hover:underline focus-visible:outline-3 focus-visible:outline-focus"
                      >
                        {subscription.email ?? t('admin.subscriptions.noEmail')}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{subscription.planName}</td>
                    <td className="px-4 py-3">
                      <SubscriptionStatusBadge status={subscription.status} />
                      {subscription.cancelAtPeriodEnd && (
                        <span className="block text-xs text-ink-muted">
                          {t('admin.subscriptions.ending')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {subscription.currentPeriodEnd ? dateTime(subscription.currentPeriodEnd) : '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{dateTime(subscription.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={billingPageSize}
            total={subscriptions.data.totalCount}
            onPage={(next) => {
              change('page', String(next));
            }}
          />
        </>
      )}
    </>
  );
}
