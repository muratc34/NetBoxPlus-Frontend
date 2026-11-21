import { classNames } from '@netboxplus/ui';
import { useLocale } from '../i18n';

/** Whether a plan is on sale, in words (the colour only repeats them). */
export function SaleBadge({ onSale }: Readonly<{ onSale: boolean }>) {
  const { t } = useLocale();
  return (
    <span
      className={classNames(
        'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
        onSale ? 'bg-emerald-900/70 text-emerald-100' : 'bg-white/10 text-ink',
      )}
    >
      {onSale ? t('admin.plans.onSale') : t('admin.plans.offSale')}
    </span>
  );
}
