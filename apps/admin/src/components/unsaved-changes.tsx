import { useBlocker } from 'react-router';
import { useLocale } from '../i18n';
import { ConfirmDialog } from './confirm-dialog';

/** Asks before leaving a form with changes not saved; staying keeps them. */
export function UnsavedChanges({ dirty }: Readonly<{ dirty: boolean }>) {
  const { t } = useLocale();
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname,
  );
  return (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      title={t('admin.unsaved.title')}
      body={t('admin.unsaved.body')}
      confirmLabel={t('admin.unsaved.leave')}
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
