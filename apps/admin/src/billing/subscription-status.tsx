import { classNames } from '@netboxplus/ui';
import type { SubscriptionStatus } from '../data/billing';
import { useLocale } from '../i18n';

const tones: Record<SubscriptionStatus, string> = {
  Active: 'bg-emerald-900/70 text-emerald-100',
  PastDue: 'bg-amber-900/70 text-amber-100',
  Incomplete: 'bg-white/10 text-ink',
  Canceled: 'bg-white/10 text-ink',
};

/** A subscription's state, in words (the colour only repeats them). */
export function SubscriptionStatusBadge({ status }: Readonly<{ status: SubscriptionStatus }>) {
  const { t } = useLocale();
  return (
    <span
      className={classNames('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold', tones[status])}
    >
      {t(`account.status.${status}`)}
    </span>
  );
}
