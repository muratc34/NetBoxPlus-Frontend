import { formatPrice, problemMessageKey } from '@netboxplus/core';
import { useEffect } from 'react';
import { Link, useParams } from 'react-router';
import { useSubscription, type SubscriptionDetails } from '../data/billing';
import { can, useAdminSession } from '../data/session';
import { useLocale } from '../i18n';
import { paths } from '../paths';
import { useDateTime } from '../videos/video-format';
import { SubscriptionStatusBadge } from './subscription-status';

/** One subscription as Billing mirrors it from Stripe: who, which plan, the period and the invoices. */
export function SubscriptionPage() {
  const { t } = useLocale();
  const id = useParams().id ?? '';
  const subscription = useSubscription(id);

  useEffect(() => {
    document.title = subscription.data
      ? `${subscription.data.plan.name} · ${subscription.data.email ?? t('admin.subscriptions.noEmail')}`
      : t('admin.subscriptions.title');
  }, [subscription.data, t]);

  if (subscription.isPending) {
    return (
      <p aria-busy="true" className="text-ink-muted">
        {t('browse.loading')}
      </p>
    );
  }
  if (subscription.isError) {
    return (
      <p role="alert" className="text-ink-muted">
        {t(problemMessageKey(subscription.error))}
      </p>
    );
  }
  return <SubscriptionView subscription={subscription.data} />;
}

function SubscriptionView({ subscription }: Readonly<{ subscription: SubscriptionDetails }>) {
  const { locale, t } = useLocale();
  const session = useAdminSession();
  const dateTime = useDateTime();
  const email = subscription.email ?? t('admin.subscriptions.noEmail');

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold text-ink-strong">{subscription.plan.name}</h1>
        <SubscriptionStatusBadge status={subscription.status} />
      </div>
      <section className="rounded-lg bg-surface p-6">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Fact term={t('admin.subscriptions.user')}>
            {can(session.data, 'auth:users:read') ? (
              <Link
                to={paths.user(subscription.userId)}
                className="break-all underline focus-visible:outline-3 focus-visible:outline-focus"
              >
                {email}
              </Link>
            ) : (
              <span className="break-all">{email}</span>
            )}
          </Fact>
          <Fact term={t('admin.subscriptions.plan')}>
            {can(session.data, 'billing:plans:read') ? (
              <Link
                to={paths.plan(subscription.plan.id)}
                className="underline focus-visible:outline-3 focus-visible:outline-focus"
              >
                {subscription.plan.name}
              </Link>
            ) : (
              subscription.plan.name
            )}
          </Fact>
          <Fact term={t('admin.subscriptions.periodEnd')}>
            {subscription.currentPeriodEnd ? dateTime(subscription.currentPeriodEnd) : '—'}
          </Fact>
          <Fact term={t('admin.subscriptions.renewal')}>
            {subscription.canceledAt
              ? t('admin.subscriptions.canceledAt').replace('{date}', dateTime(subscription.canceledAt))
              : subscription.cancelAtPeriodEnd
                ? t('admin.subscriptions.ending')
                : t('admin.subscriptions.renews')}
          </Fact>
          <Fact term={t('admin.subscriptions.started')}>{dateTime(subscription.createdAt)}</Fact>
          <Fact term={t('admin.subscriptions.stripeId')}>
            <code className="text-sm break-all">{subscription.providerSubscriptionId}</code>
          </Fact>
        </dl>
      </section>
      <section aria-labelledby="invoices" className="flex flex-col gap-4 rounded-lg bg-surface p-6">
        <h2 id="invoices" className="font-display text-xl font-bold text-ink-strong">
          {t('account.invoices')}
        </h2>
        {subscription.invoices.length === 0 ? (
          <p className="text-ink-muted">{t('account.invoices.none')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-ink-muted">
                <tr className="border-b border-line">
                  {[
                    t('account.invoices.date'),
                    t('account.invoices.amount'),
                    t('account.invoices.status'),
                    t('admin.subscriptions.paidAt'),
                    t('account.invoices.card'),
                  ].map((header) => (
                    <th key={header} scope="col" className="py-2 pr-4 font-normal">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subscription.invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-line last:border-0">
                    <td className="py-2 pr-4 whitespace-nowrap">{dateTime(invoice.issuedAt)}</td>
                    <td className="py-2 pr-4 tabular-nums whitespace-nowrap">
                      {formatPrice(invoice.amountMinor, invoice.currency, locale)}
                    </td>
                    <td className="py-2 pr-4">{t(`account.invoice.${invoice.status}`)}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {invoice.paidAt ? dateTime(invoice.paidAt) : '—'}
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {invoice.cardLast4
                        ? `${invoice.cardBrand ?? ''} •••• ${invoice.cardLast4}`.trim()
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function Fact({ term, children }: Readonly<{ term: string; children: React.ReactNode }>) {
  return (
    <div>
      <dt className="text-sm text-ink-muted">{term}</dt>
      <dd className="font-semibold text-ink-strong">{children}</dd>
    </div>
  );
}
