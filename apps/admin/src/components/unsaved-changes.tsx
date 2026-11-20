import { useLocale } from '../i18n';
import { LeaveGuard } from './leave-guard';

/** Asks before leaving a form with changes not saved; staying keeps them. */
export function UnsavedChanges({ dirty }: Readonly<{ dirty: boolean }>) {
  const { t } = useLocale();
  return <LeaveGuard active={dirty} title={t('admin.unsaved.title')} body={t('admin.unsaved.body')} />;
}
