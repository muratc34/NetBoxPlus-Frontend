import { useEffect, useRef } from 'react';
import { useBlocker } from 'react-router';
import { useLocale } from '../i18n';
import { ConfirmDialog } from './confirm-dialog';

/**
 * Asks before leaving for another page while `active`, and lets the browser ask before the tab closes.
 * `holds`, when given, is asked at the moment of leaving instead: work that ends and moves on in the same
 * step (an upload going on to its result) lets go before the page has drawn again.
 */
export function LeaveGuard({
  active,
  holds,
  title,
  body,
  leaveLabel,
}: Readonly<{ active: boolean; holds?: () => boolean; title: string; body: string; leaveLabel?: string }>) {
  const { t } = useLocale();
  const current = useRef(active);
  useEffect(() => {
    current.current = active;
  });
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      (holds ? holds() : current.current) && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!active) {
      return;
    }
    const ask = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', ask);
    return () => {
      window.removeEventListener('beforeunload', ask);
    };
  }, [active]);

  return (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      title={title}
      body={body}
      confirmLabel={leaveLabel ?? t('admin.unsaved.leave')}
      onConfirm={() => {
        blocker.proceed?.();
      }}
      onOpenChange={(open) => {
        if (!open) {
          blocker.reset?.();
        }
      }}
    />
  );
}
