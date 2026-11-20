'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { isLive, queryKeys, useDeleteAccount, useSubscription } from '@netboxplus/core';
import { Button } from '@netboxplus/ui';
import * as Dialog from '@radix-ui/react-dialog';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormAlert, TextField } from '../../components/form';
import { useLocale } from '../../i18n/translator';
import { useProfileSelection } from '../../profiles/profile-selection';
import { routes } from '../../routes';
import { messageOf, showProblem } from './form-rules';

const danger =
  'inline-flex h-11 items-center justify-center rounded-md bg-red-700 px-5 text-[15px] font-semibold text-white ' +
  'hover:bg-red-600 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

const schema = z.object({ password: z.string().min(1, 'validation.required') });
type Values = z.infer<typeof schema>;

/**
 * Deleting the account, behind a dialog that asks for the password and says what goes with it (a live
 * membership ends at once, without a refund). Once it is gone the dialog says so; leaving it forgets the
 * account in this tab and goes home.
 */
export function DeleteAccount({
  onLeave,
}: Readonly<{
  /** Said first when the visitor leaves after the deletion, before the account is forgotten. */
  onLeave?: () => void;
}>) {
  const { locale, t } = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { clear } = useProfileSelection();
  const subscription = useSubscription(locale, true);
  const remove = useDeleteAccount();
  const [open, setOpen] = useState(false);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: '' } });
  const { errors, isSubmitting } = form.formState;

  const leave = () => {
    onLeave?.();
    // Signed out for everything showing it now; the account's other data goes from the cache.
    queryClient.setQueryData(queryKeys.session, null);
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== queryKeys.session[0] });
    clear();
    router.replace(routes.home(locale));
  };

  const submit = form.handleSubmit(async (values) => {
    try {
      await remove.mutateAsync(values.password);
    } catch (error) {
      showProblem(error, ['password'], form.setError, { 'User.PasswordIncorrect': 'password' });
    }
  });

  return (
    <section
      aria-labelledby="delete-heading"
      className="flex flex-col items-start gap-3 rounded-lg bg-surface p-6"
    >
      <h2 id="delete-heading" className="font-display text-xl font-bold text-ink-strong">
        {t('account.delete.title')}
      </h2>
      <p className="text-ink-muted">{t('account.delete.body')}</p>
      <Dialog.Root
        open={open}
        onOpenChange={(next) => {
          if (remove.isSuccess) {
            leave();
            return;
          }
          setOpen(next);
          if (!next) {
            form.reset();
          }
        }}
      >
        <Dialog.Trigger asChild>
          <button type="button" className={danger}>
            {t('account.delete.open')}
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/75" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg bg-surface p-6 shadow-xl sm:p-8">
            {remove.isSuccess ? (
              <>
                <Dialog.Title className="font-display text-2xl font-bold text-ink-strong">
                  {t('account.delete.done')}
                </Dialog.Title>
                <Dialog.Description className="sr-only">{t('account.delete.done')}</Dialog.Description>
                <Button className="self-start" onClick={leave}>
                  {t('account.delete.home')}
                </Button>
              </>
            ) : (
              <>
                <Dialog.Title className="font-display text-2xl font-bold text-ink-strong">
                  {t('account.delete.confirmTitle')}
                </Dialog.Title>
                <Dialog.Description className="text-ink">
                  {t('account.delete.confirmBody')}
                </Dialog.Description>
                {isLive(subscription.data) && (
                  <p className="rounded-md bg-red-950/60 px-4 py-3 text-sm text-red-100">
                    {t('account.delete.membership')}
                  </p>
                )}
                <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
                  {errors.root && <FormAlert tone="error">{messageOf(t, errors.root.message)}</FormAlert>}
                  <TextField
                    label={t('account.currentPassword')}
                    type="password"
                    autoComplete="current-password"
                    error={messageOf(t, errors.password?.message)}
                    {...form.register('password')}
                  />
                  <div className="flex flex-wrap gap-3">
                    <button type="submit" disabled={isSubmitting} className={danger}>
                      {isSubmitting ? t('auth.working') : t('account.delete.confirm')}
                    </button>
                    <Dialog.Close asChild>
                      <Button variant="ghost">{t('account.cancel')}</Button>
                    </Dialog.Close>
                  </div>
                </form>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
