import { classNames } from '@netboxplus/ui';
import type { PublicationStatus } from '../data/movies';
import { useLocale } from '../i18n';

/** Draft or published, in words (the colour only repeats them). */
export function StatusBadge({ status }: Readonly<{ status: PublicationStatus }>) {
  const { t } = useLocale();
  return (
    <span
      className={classNames(
        'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
        status === 'Published' ? 'bg-emerald-900/70 text-emerald-100' : 'bg-white/10 text-ink',
      )}
    >
      {t(`admin.status.${status}`)}
    </span>
  );
}
