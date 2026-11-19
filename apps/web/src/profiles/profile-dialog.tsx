'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  ageRatings,
  problemMessageKey,
  useCreateProfile,
  useRemoveProfile,
  useUpdateProfile,
  type Profile,
} from '@netboxplus/core';
import type { MessageKey } from '@netboxplus/i18n';
import { Button } from '@netboxplus/ui';
import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormAlert, SelectField, TextField } from '../components/form';
import { messageOf, showProblem } from '../features/account/form-rules';
import { useLocale } from '../i18n/translator';

// Auth's Profile.NameMaxLength.
export const profileNameMaxLength = 32;

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'validation.required')
    .max(profileNameMaxLength, 'validation.profileNameTooLong'),
  maxAgeRating: z.enum(ageRatings),
});
type Values = z.infer<typeof schema>;

const ageLabels: Record<(typeof ageRatings)[number], MessageKey> = {
  All: 'profiles.age.All',
  Age7: 'profiles.age.Age7',
  Age13: 'profiles.age.Age13',
  Age16: 'profiles.age.Age16',
  Age18: 'profiles.age.Age18',
};

/** Adding a profile, or editing and deleting one. Deleting asks first: it cannot be undone. */
export function ProfileDialog({
  profile,
  onClose,
}: Readonly<{ profile: Profile | undefined; onClose: () => void }>) {
  const { t } = useLocale();
  const create = useCreateProfile();
  const update = useUpdateProfile();
  const remove = useRemoveProfile();
  const [confirming, setConfirming] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: profile?.name ?? '', maxAgeRating: profile?.maxAgeRating ?? 'All' },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    try {
      await (profile ? update.mutateAsync({ id: profile.id, ...values }) : create.mutateAsync(values));
      onClose();
    } catch (error) {
      showProblem(error, ['name', 'maxAgeRating'], form.setError);
    }
  });

  const deleteProfile = async (id: string) => {
    try {
      await remove.mutateAsync(id);
      onClose();
    } catch {
      // Shown from the mutation's state below.
    }
  };

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/75" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface p-6 shadow-xl sm:p-8"
        >
          {confirming && profile ? (
            <div className="flex flex-col gap-5">
              <Dialog.Title className="font-display text-2xl font-bold text-ink-strong">
                {t('profiles.deleteTitle')}
              </Dialog.Title>
              <p className="text-ink-muted">{t('profiles.deleteBody')}</p>
              {remove.isError && <FormAlert tone="error">{t(problemMessageKey(remove.error))}</FormAlert>}
              <div className="flex flex-wrap justify-end gap-3">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setConfirming(false);
                  }}
                >
                  {t('profiles.cancel')}
                </Button>
                <Button
                  className="bg-red-700 hover:bg-red-600"
                  disabled={remove.isPending}
                  onClick={() => void deleteProfile(profile.id)}
                >
                  {t('profiles.deleteConfirm')}
                </Button>
              </div>
            </div>
          ) : (
            <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-5">
              <Dialog.Title className="font-display text-2xl font-bold text-ink-strong">
                {t(profile ? 'profiles.edit' : 'profiles.add')}
              </Dialog.Title>
              {errors.root && <FormAlert tone="error">{messageOf(t, errors.root.message)}</FormAlert>}
              <TextField
                label={t('profiles.name')}
                autoComplete="off"
                maxLength={profileNameMaxLength}
                error={messageOf(t, errors.name?.message)}
                {...form.register('name')}
              />
              <SelectField
                label={t('profiles.age')}
                hint={t('profiles.ageHint')}
                options={ageRatings.map((rating) => ({ value: rating, label: t(ageLabels[rating]) }))}
                error={messageOf(t, errors.maxAgeRating?.message)}
                {...form.register('maxAgeRating')}
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                {profile ? (
                  <Button
                    variant="ghost"
                    className="text-red-300"
                    onClick={() => {
                      setConfirming(true);
                    }}
                  >
                    {t('profiles.delete')}
                  </Button>
                ) : (
                  <span />
                )}
                <div className="flex gap-3">
                  <Dialog.Close asChild>
                    <Button variant="ghost">{t('profiles.cancel')}</Button>
                  </Dialog.Close>
                  <Button type="submit" disabled={isSubmitting}>
                    {t('profiles.save')}
                  </Button>
                </div>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
