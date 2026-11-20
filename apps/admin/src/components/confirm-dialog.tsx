import { FormAlert } from '@netboxplus/ui';
import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { useLocale } from '../i18n';
import { buttonClass } from './buttons';

/** A question before something that cannot be undone, with its error if it failed. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  busy,
  error,
  onConfirm,
  onOpenChange,
}: Readonly<{
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  error?: string | undefined;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}>) {
  const { t } = useLocale();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/75" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg bg-surface p-6 shadow-xl">
          <Dialog.Title className="font-display text-xl font-bold text-ink-strong">{title}</Dialog.Title>
          <Dialog.Description className="text-ink">{body}</Dialog.Description>
          {error && <FormAlert tone="error">{error}</FormAlert>}
          <div className="flex flex-wrap gap-3">
            <button type="button" className={buttonClass('danger')} disabled={busy} onClick={onConfirm}>
              {busy ? t('auth.working') : confirmLabel}
            </button>
            <Dialog.Close asChild>
              <button type="button" className={buttonClass('ghost')}>
                {t('admin.cancel')}
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
