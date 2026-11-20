'use client';

import {
  billingKeys,
  formatPrice,
  problemMessageKey,
  useInvoices,
  useOpenPortal,
  useSubscription,
  type InvoiceSummary,
  type MySubscription,
} from '@netboxplus/core';
import type { Locale } from '@netboxplus/i18n';
import { Button } from '@netboxplus/ui';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { useLocale } from '../../i18n/translator';
import { leaveSiteFor } from '../../leave-site';
import { routes } from '../../routes';

/** After the checkout, how long the page keeps asking for the subscription the payment starts. */
export const checkoutWaitMs = 30_000;
export const checkoutPollMs = 2_000;

export function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(iso));
}

const brandNames: Readonly<Record<string, string>> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  troy: 'Troy',
  discover: 'Discover',
  jcb: 'JCB',
  unionpay: 'UnionPay',
  diners: 'Diners Club',
};

/** The card an invoice was paid with as people name it: "Visa •••• 4242". */
export function cardLabel(invoice: Pick<InvoiceSummary, 'cardBrand' | 'cardLast4'>): string | undefined {
  if (!invoice.cardBrand || !invoice.cardLast4) {
    return undefined;
  }
  const brand =
    brandNames[invoice.cardBrand.toLowerCase()] ??
    invoice.cardBrand.charAt(0).toUpperCase() + invoice.cardBrand.slice(1);
  return `${brand} •••• ${invoice.cardLast4}`;
}

const section = 'flex flex-col gap-4 rounded-lg bg-surface p-6';
const heading = 'font-display text-xl font-bold text-ink-strong';
const action =
  'inline-flex h-11 items-center justify-center rounded-md bg-brand-strong px-5 text-[15px] font-semibold text-white ' +
  'hover:bg-brand-strong-hover focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus';

/**
 * The membership and its invoices. Coming back from a successful checkout (`checkoutReturned`), the
 * subscription is asked again every couple of seconds until it is active: the payment provider tells
 * Billing a moment later, by webhook. After `waitMs` the page says it will show up soon and stops asking.
 */
export function Membership({
  checkoutReturned,
  waitMs = checkoutWaitMs,
  pollMs = checkoutPollMs,
}: Readonly<{ checkoutReturned: boolean; waitMs?: number; pollMs?: number }>) {
  const { locale, t } = useLocale();
  const queryClient = useQueryClient();
  const [waitedOut, setWaitedOut] = useState(false);
  const waiting = checkoutReturned && !waitedOut;
  const subscription = useSubscription(locale, true, (current) =>
    waiting && current?.status !== 'Active' ? pollMs : false,
  );
  const active = subscription.data?.status === 'Active';

  useEffect(() => {
    if (!checkoutReturned) {
      return;
    }
    const timer = window.setTimeout(() => {
      setWaitedOut(true);
    }, waitMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [checkoutReturned, waitMs]);

  useEffect(() => {
    // The first invoice comes with the subscription.
    if (checkoutReturned && active) {
      void queryClient.invalidateQueries({ queryKey: billingKeys.invoices });
    }
  }, [checkoutReturned, active, queryClient]);

  return (
    <>
      <section aria-labelledby="membership-heading" className={section}>
        <h2 id="membership-heading" className={heading}>
          {t('account.membership')}
        </h2>
        {checkoutReturned && (
          <p role="status" className="rounded-md bg-surface-raised px-4 py-3 text-ink-strong">
            {active
              ? t('account.checkout.done')
              : waitedOut
                ? t('account.checkout.slow')
                : t('account.checkout.waiting')}
          </p>
        )}
        {subscription.isPending ? (
          <p aria-busy="true" className="text-ink-muted">
            {t('browse.loading')}
          </p>
        ) : subscription.isError ? (
          <p role="alert" className="text-ink-muted">
            {t(problemMessageKey(subscription.error))}
          </p>
        ) : subscription.data === null ? (
          // Just back from paying: the status above says the subscription is on its way.
          checkoutReturned ? null : (
            <div className="flex flex-col items-start gap-3">
              <p>{t('account.noMembership')}</p>
              <Link href={routes.plans(locale)} className={action}>
                {t('account.seePlans')}
              </Link>
            </div>
          )
        ) : (
          <SubscriptionDetails subscription={subscription.data} />
        )}
      </section>
      <Invoices />
    </>
  );
}

function SubscriptionDetails({ subscription }: Readonly<{ subscription: MySubscription }>) {
  const { locale, t } = useLocale();
  const portal = useOpenPortal();
  const hintId = useId();
  const { plan, status, currentPeriodEnd, cancelAtPeriodEnd, canceledAt, startedAt } = subscription;
  const leaving = portal.isPending || portal.isSuccess;

  const period =
    status === 'Canceled'
      ? canceledAt && t('account.endedOn').replace('{date}', formatDate(canceledAt, locale))
      : currentPeriodEnd &&
        (cancelAtPeriodEnd
          ? t('account.endsOn').replace('{date}', formatDate(currentPeriodEnd, locale))
          : status === 'Active'
            ? t('account.renews').replace('{date}', formatDate(currentPeriodEnd, locale))
            : null);

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[max-content_1fr]">
        <dt className="text-ink-muted">{t('account.plan')}</dt>
        <dd>
          <span lang={plan.language} className="font-semibold text-ink-strong">
            {plan.name}
          </span>
          <span className="text-ink-muted">
            {' · '}
            {t(`plans.quality.${plan.quality}`)}
            {' · '}
            {plan.maxScreens === 1
              ? t('plans.screens.one')
              : t('plans.screens.many').replace('{count}', String(plan.maxScreens))}
          </span>
        </dd>
        <dt className="text-ink-muted">{t('account.status')}</dt>
        <dd>
          <span className="font-semibold text-ink-strong">{t(`account.status.${status}`)}</span>
          {period && <span className="block text-sm text-ink-muted">{period}</span>}
          <span className="block text-sm text-ink-muted">
            {t('account.since').replace('{date}', formatDate(startedAt, locale))}
          </span>
        </dd>
      </dl>

      {status === 'PastDue' && (
        <p className="rounded-md bg-surface-raised px-4 py-3 text-ink-strong">{t('account.pastDue')}</p>
      )}
      {status === 'Incomplete' && (
        <p className="rounded-md bg-surface-raised px-4 py-3 text-ink-strong">{t('account.incomplete')}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {status === 'Canceled' && (
          <Link href={routes.plans(locale)} className={action}>
            {t('account.resubscribe')}
          </Link>
        )}
        <Button
          variant={status === 'Canceled' ? 'secondary' : 'primary'}
          aria-describedby={hintId}
          aria-busy={leaving || undefined}
          disabled={leaving}
          onClick={() => {
            portal.mutate(undefined, {
              onSuccess: (url) => {
                leaveSiteFor(url);
              },
            });
          }}
        >
          {leaving ? t('account.portalOpening') : t('account.portal')}
        </Button>
      </div>
      <p id={hintId} className="text-sm text-ink-muted">
        {t('account.portalHint')}
      </p>
      {portal.isError && (
        <p role="alert" className="text-ink-strong">
          {t(problemMessageKey(portal.error))}
        </p>
      )}
    </div>
  );
}

function Invoices() {
  const { locale, t } = useLocale();
  const invoices = useInvoices(true);
  const items = invoices.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <section aria-labelledby="invoices-heading" className={section}>
      <h2 id="invoices-heading" className={heading}>
        {t('account.invoices')}
      </h2>
      {invoices.isPending ? (
        <p aria-busy="true" className="text-ink-muted">
          {t('browse.loading')}
        </p>
      ) : invoices.isError ? (
        <p role="alert" className="text-ink-muted">
          {t(problemMessageKey(invoices.error))}
        </p>
      ) : items.length === 0 ? (
        <p className="text-ink-muted">{t('account.invoices.none')}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-ink-muted">
                <tr className="border-b border-line">
                  <th scope="col" className="py-2 pr-4 font-normal">
                    {t('account.invoices.date')}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-normal">
                    {t('account.invoices.amount')}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-normal">
                    {t('account.invoices.status')}
                  </th>
                  <th scope="col" className="py-2 font-normal">
                    {t('account.invoices.card')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-line last:border-0">
                    <td className="py-3 pr-4 whitespace-nowrap">{formatDate(invoice.issuedAt, locale)}</td>
                    <td className="py-3 pr-4 whitespace-nowrap text-ink-strong">
                      {formatPrice(invoice.amountMinor, invoice.currency, locale)}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">{t(`account.invoice.${invoice.status}`)}</td>
                    <td className="py-3 whitespace-nowrap">{cardLabel(invoice) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {invoices.hasNextPage && (
            <Button
              variant="secondary"
              className="self-start"
              aria-busy={invoices.isFetchingNextPage || undefined}
              disabled={invoices.isFetchingNextPage}
              onClick={() => {
                void invoices.fetchNextPage();
              }}
            >
              {invoices.isFetchingNextPage ? t('browse.loading') : t('browse.loadMore')}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
