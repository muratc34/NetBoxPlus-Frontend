import { classNames } from '@netboxplus/ui';
import { useState } from 'react';
import { isLockedOut } from '../data/users';
import { useLocale } from '../i18n';
import { useDateTime } from '../videos/video-format';

/** Open, closed by an administrator, or locked after failed sign-ins (until when), in words. */
export function UserStatus({
  disabled,
  lockedOutUntil,
}: Readonly<{ disabled: boolean; lockedOutUntil: string | null }>) {
  const { t } = useLocale();
  const dateTime = useDateTime();
  // The moment of drawing: a lockout that ends while the page is open shows until the next load.
  const [now] = useState(() => Date.now());
  const locked = isLockedOut(lockedOutUntil, now);
  const label = disabled
    ? t('admin.users.status.disabled')
    : locked && lockedOutUntil !== null
      ? t('admin.users.status.locked').replace('{until}', dateTime(lockedOutUntil))
      : t('admin.users.status.active');
  return (
    <span
      className={classNames(
        'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
        disabled || locked ? 'bg-red-900/70 text-red-100' : 'bg-emerald-900/70 text-emerald-100',
      )}
    >
      {label}
    </span>
  );
}
