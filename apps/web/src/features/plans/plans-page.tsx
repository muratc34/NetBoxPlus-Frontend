'use client';

import {
  formatPrice,
  isLive,
  problemMessageKey,
  useEmailVerification,
  useSession,
  useStartCheckout,
  useSubscription,
  type PlanOffer,
} from '@netboxplus/core';
import { Button, classNames } from '@netboxplus/ui';
import Link from 'next/link';
import { useId } from 'react';
import { useLocale } from '../../i18n/translator';
import { leaveSiteFor } from '../../leave-site';
import { routes, signUpPath } from '../../routes';

const linkButton =
  'inline-flex h-11 items-center justify-center rounded-md px-5 text-[15px] font-semibold ' +
  'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus';

/**
 * The plans on sale side by side. What a plan's button does depends on the visitor: signing up first
 * (coming back here afterwards), verifying the e-mail address first, or going to the payment provider's
 * checkout. An account with a subscription sees its plan marked and is sent to its account page, where
 * the plan is changed.
 */
export function PlansPage({ plans }: Readonly<{ plans: readonly PlanOffer[] }>) {
  const { locale, t } = useLocale();
  const ids = { verify: useId() };
  const session = useSession();
  const signedIn = Boolean(session.data);
  const verification = useEmailVerification(signedIn);
  const subscription = useSubscription(locale, signedIn);
  const checkout = useStartCheckout();

  const current = isLive(subscription.data) ? subscription.data : undefined;
  const unverified = signedIn && !current && verification.data?.verified === false;
  const deciding = signedIn && subscription.isPending;
  const leaving = checkout.isPending || checkout.isSuccess;

  const choose = (planId: string) => {
    checkout.mutate(planId, {
      onSuccess: (url) => {
        leaveSiteFor(url);
      },
      onError: () => {
        // A subscription started or the address was verified in another tab: show the page as it is now.
        void subscription.refetch();
        void verification.refetch();
      },
    });
  };

  return (
    <main className="flex flex-col gap-8 px-4 pt-6 pb-16 sm:px-8">
      <header className="flex max-w-2xl flex-col gap-2">
        <h1 className="font-display text-3xl font-bold text-ink-strong sm:text-4xl">{t('plans.heading')}</h1>
        <p className="text-ink-muted">{t('plans.cancelAnytime')}</p>
      </header>

      {current && (
        <p className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-surface px-5 py-4">
          <span>
            {t('plans.current')}: <strong className="text-ink-strong">{current.plan.name}</strong>
          </span>
          <Link
            href={routes.account(locale)}
            className={classNames(linkButton, 'bg-white/15 text-white hover:bg-white/25')}
          >
            {t('plans.manage')}
          </Link>
        </p>
      )}
      {unverified && (
        <p id={ids.verify} className="max-w-2xl rounded-lg bg-surface px-5 py-4">
          {t('plans.verifyFirst')}
        </p>
      )}
      {checkout.isError && (
        <p role="alert" className="max-w-2xl rounded-lg bg-surface px-5 py-4 text-ink-strong">
          {t(problemMessageKey(checkout.error))}
        </p>
      )}

      {plans.length === 0 ? (
        <p className="py-16 text-center text-ink-muted">{t('plans.none')}</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = current?.plan.id === plan.id;
            const choosing = leaving && checkout.variables === plan.id;
            return (
              <li
                key={plan.id}
                aria-current={isCurrent || undefined}
                className={classNames(
                  'flex flex-col gap-5 rounded-lg border bg-surface p-6',
                  isCurrent ? 'border-brand' : 'border-line',
                )}
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-3">
                    <h2 lang={plan.language} className="font-display text-2xl font-bold text-ink-strong">
                      {plan.name}
                    </h2>
                    {isCurrent && (
                      <span className="rounded-full bg-brand-strong px-3 py-1 text-xs font-semibold text-white">
                        {t('plans.current')}
                      </span>
                    )}
                  </div>
                  {plan.description && (
                    <p lang={plan.language} className="text-ink-muted">
                      {plan.description}
                    </p>
                  )}
                </div>
                <p>
                  <span className="font-display text-3xl font-bold text-ink-strong">
                    {formatPrice(plan.amountMinor, plan.currency, locale)}
                  </span>
                  <span className="text-ink-muted">{t('plans.perMonth')}</span>
                </p>
                <dl className="flex flex-col gap-2 border-t border-line pt-4 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-muted">{t('plans.quality')}</dt>
                    <dd className="font-semibold text-ink-strong">{t(`plans.quality.${plan.quality}`)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-muted">{t('plans.screens')}</dt>
                    <dd className="font-semibold text-ink-strong">
                      {plan.maxScreens === 1
                        ? t('plans.screens.one')
                        : t('plans.screens.many').replace('{count}', String(plan.maxScreens))}
                    </dd>
                  </div>
                </dl>
                <div className="mt-auto">
                  {current ? null : !signedIn ? (
                    <Link
                      href={signUpPath(locale, routes.plans(locale))}
                      aria-label={t('plans.chooseNamed').replace('{plan}', plan.name)}
                      className={classNames(
                        linkButton,
                        'w-full bg-brand-strong text-white hover:bg-brand-strong-hover',
                      )}
                    >
                      {t('plans.choose')}
                    </Link>
                  ) : (
                    <Button
                      className="w-full"
                      aria-label={choosing ? undefined : t('plans.chooseNamed').replace('{plan}', plan.name)}
                      aria-describedby={unverified ? ids.verify : undefined}
                      aria-busy={deciding || choosing || undefined}
                      disabled={deciding || unverified || leaving}
                      onClick={() => {
                        choose(plan.id);
                      }}
                    >
                      {choosing ? t('plans.opening') : t('plans.choose')}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
