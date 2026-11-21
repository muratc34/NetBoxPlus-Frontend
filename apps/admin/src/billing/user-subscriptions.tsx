import { problemMessageKey } from '@netboxplus/core';
import { useId } from 'react';
import { Link } from 'react-router';
import { useSubscriptions } from '../data/billing';
import { useLocale } from '../i18n';
import { paths } from '../paths';
import { useDateTime } from '../videos/video-format';
import { SubscriptionStatusBadge } from './subscription-status';

/** How many of a user's subscriptions their page shows; the list has the rest. */
export const userSubscriptionCount = 5;

/** A user's subscriptions on their page, read beside the account (the user page starts the request). */
export function useUserSubscriptions(userId: string, enabled: boolean) {
  return useSubscriptions({ userId, page: 1, pageSize: userSubscriptionCount }, enabled);
}

/** The user's latest subscriptions, each opening its page, and the way to all of them. */
export function UserSubscriptions({ userId }: Readonly<{ userId: string }>) {
  const { t } = useLocale();
  const id = useId();
  const subscriptions = useUserSubscriptions(userId, true);
  const dateTime = useDateTime();

  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 rounded-lg bg-surface p-6">
      <h2 id={id} className="font-display text-xl font-bold text-ink-strong">
        {t('admin.subscriptions.title')}
      </h2>
      {subscriptions.isPending ? (
        <p aria-busy="true" className="text-ink-muted">
          {t('browse.loading')}
        </p>
      ) : subscriptions.isError ? (
        <p role="alert" className="text-ink-muted">
          {t(problemMessageKey(subscriptions.error))}
        </p>
      ) : subscriptions.data.items.length === 0 ? (
        <p className="text-ink-muted">{t('admin.subscriptions.none')}</p>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-line">
            {subscriptions.data.items.map((subscription) => (
              <li key={subscription.id} className="flex flex-wrap items-center gap-3 py-2">
                <Link
                  to={paths.subscription(subscription.id)}
                  className="font-semibold text-ink-strong hover:underline focus-visible:outline-3 focus-visible:outline-focus"
                >
                  {subscription.planName}
                </Link>
                <SubscriptionStatusBadge status={subscription.status} />
                <span className="text-sm text-ink-muted">{dateTime(subscription.createdAt)}</span>
              </li>
            ))}
          </ul>
          {subscriptions.data.totalCount > subscriptions.data.items.length && (
            <Link
              to={`${paths.subscriptions}?${new URLSearchParams({ userId }).toString()}`}
              className="self-start text-sm underline focus-visible:outline-3 focus-visible:outline-focus"
            >
              {t('admin.subscriptions.seeAll').replace('{count}', String(subscriptions.data.totalCount))}
            </Link>
          )}
        </>
      )}
    </section>
  );
}
