import { classNames } from '@netboxplus/ui';
import type { EmailStatus } from '../data/emails';
import { useLocale } from '../i18n';

const tones: Record<EmailStatus, string> = {
  Pending: 'bg-amber-900/70 text-amber-100',
  Sent: 'bg-emerald-900/70 text-emerald-100',
  Failed: 'bg-red-900/70 text-red-100',
};

/** An e-mail's state, in words (the colour only repeats them). */
export function EmailStatusBadge({ status }: Readonly<{ status: EmailStatus }>) {
  const { t } = useLocale();
  return (
    <span
      className={classNames('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold', tones[status])}
    >
      {t(`admin.emails.status.${status}`)}
    </span>
  );
}
