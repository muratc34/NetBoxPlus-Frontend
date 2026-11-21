import { formatPrice, problemMessageKey } from '@netboxplus/core';
import { SelectField } from '@netboxplus/ui';
import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router';
import { pageOf } from '../components/address-search';
import { buttonClass } from '../components/buttons';
import { Pagination } from '../components/pagination';
import { billingPageSize, usePlans } from '../data/billing';
import { can, useAdminSession } from '../data/session';
import { useLocale } from '../i18n';
import { paths } from '../paths';
import { SaleBadge } from './sale-badge';

const sales = { onSale: true, offSale: false } as const;

/** Every plan, on sale or not, filtered in the address: price, quality, screens and whether it is sold. */
export function PlansPage() {
  const { locale, t } = useLocale();
  const session = useAdminSession();
  const [params, setParams] = useSearchParams();
  const sale = params.get('sale');
  const active = sale === 'onSale' || sale === 'offSale' ? sales[sale] : undefined;
  const page = pageOf(params.get('page'));
  const plans = usePlans(active, page);

  useEffect(() => {
    document.title = t('admin.plans.title');
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold text-ink-strong">{t('admin.plans.title')}</h1>
        {can(session.data, 'billing:plans:write') && (
          <Link to={paths.newPlan} className={buttonClass('primary')}>
            {t('admin.plans.new')}
          </Link>
        )}
      </div>
      <div className="max-w-xs">
        <SelectField
          label={t('admin.plans.sale')}
          value={active === undefined ? '' : active ? 'onSale' : 'offSale'}
          options={[
            { value: '', label: t('admin.filter.all') },
            { value: 'onSale', label: t('admin.plans.onSale') },
            { value: 'offSale', label: t('admin.plans.offSale') },
          ]}
          onChange={(event) => {
            change('sale', event.target.value);
          }}
        />
      </div>
      {plans.isPending ? (
        <p aria-busy="true" className="text-ink-muted">
          {t('browse.loading')}
        </p>
      ) : plans.isError ? (
        <p role="alert" className="text-ink-muted">
          {t(problemMessageKey(plans.error))}
        </p>
      ) : plans.data.items.length === 0 ? (
        <p className="text-ink-muted">{t('admin.plans.empty')}</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="text-ink-muted">
                <tr className="border-b border-line">
                  {[
                    t('admin.plans.name'),
                    t('admin.plans.price'),
                    t('plans.quality'),
                    t('plans.screens'),
                    t('admin.plans.sale'),
                  ].map((header) => (
                    <th key={header} scope="col" className="px-4 py-3 font-normal">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plans.data.items.map((plan) => (
                  <tr key={plan.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        to={paths.plan(plan.id)}
                        className="font-semibold text-ink-strong hover:underline focus-visible:outline-3 focus-visible:outline-focus"
                      >
                        {plan.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                      {formatPrice(plan.amountMinor, plan.currency, locale)}
                    </td>
                    <td className="px-4 py-3">{t(`plans.quality.${plan.quality}`)}</td>
                    <td className="px-4 py-3 tabular-nums">{plan.maxScreens}</td>
                    <td className="px-4 py-3">
                      <SaleBadge onSale={plan.isActive} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={billingPageSize}
            total={plans.data.totalCount}
            onPage={(next) => {
              change('page', String(next));
            }}
          />
        </>
      )}
    </>
  );
}
