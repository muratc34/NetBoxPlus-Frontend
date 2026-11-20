'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  problemMessageKey,
  useChangePassword,
  useEmailVerification,
  useRequestEmailChange,
  useResendVerification,
} from '@netboxplus/core';
import { Button } from '@netboxplus/ui';
import { useEffect, useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormAlert, TextField } from '../../components/form';
import { useLocale } from '../../i18n/translator';
import { email, messageOf, password, showProblem } from './form-rules';

const required = z.string().min(1, 'validation.required');

const emailSchema = z.object({ newEmail: email, password: required });
type EmailValues = z.infer<typeof emailSchema>;

const passwordSchema = z
  .object({ currentPassword: required, newPassword: password, confirm: z.string() })
  .refine((values) => values.newPassword === values.confirm, {
    path: ['confirm'],
    error: 'validation.passwordMismatch',
  });
type PasswordValues = z.infer<typeof passwordSchema>;

type Open = 'email' | 'password' | null;
type Done = { readonly kind: 'email'; readonly email: string } | { readonly kind: 'password' } | null;

/**
 * The account's e-mail address and whether it is verified (with a new link when it is not), and the
 * forms to change the address or the password, one open at a time. A new address takes effect only once
 * the link sent to it is opened.
 */
export function SignInDetails({ address }: Readonly<{ address: string }>) {
  const { t } = useLocale();
  const ids = { email: useId(), password: useId() };
  const verification = useEmailVerification(true);
  const resend = useResendVerification();
  const [open, setOpen] = useState<Open>(null);
  const [done, setDone] = useState<Done>(null);

  const toggle = (form: Exclude<Open, null>) => {
    setDone(null);
    setOpen((current) => (current === form ? null : form));
  };

  return (
    <section aria-labelledby="details-heading" className="flex flex-col gap-4 rounded-lg bg-surface p-6">
      <h2 id="details-heading" className="font-display text-xl font-bold text-ink-strong">
        {t('account.details')}
      </h2>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[max-content_1fr]">
        <dt className="text-ink-muted">{t('account.email')}</dt>
        <dd className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="font-semibold text-ink-strong">{address}</span>
          {verification.data && (
            <span
              className={
                verification.data.verified
                  ? 'rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-ink'
                  : 'rounded-full bg-red-950/60 px-2.5 py-0.5 text-xs font-semibold text-red-100'
              }
            >
              {verification.data.verified ? t('account.emailVerified') : t('account.emailUnverified')}
            </span>
          )}
          {verification.data?.verified === false &&
            (resend.isSuccess ? (
              <span role="status" className="text-sm font-semibold text-brand">
                {t('auth.banner.sent')}
              </span>
            ) : (
              <Button
                variant="secondary"
                className="h-9 px-3 text-sm"
                disabled={resend.isPending}
                onClick={() => {
                  resend.mutate();
                }}
              >
                {t('auth.banner.resend')}
              </Button>
            ))}
        </dd>
      </dl>
      {resend.isError && <FormAlert tone="error">{t(problemMessageKey(resend.error))}</FormAlert>}

      <div className="flex flex-wrap gap-3">
        <Button
          variant="secondary"
          aria-expanded={open === 'email'}
          aria-controls={ids.email}
          onClick={() => {
            toggle('email');
          }}
        >
          {t('account.changeEmail')}
        </Button>
        <Button
          variant="secondary"
          aria-expanded={open === 'password'}
          aria-controls={ids.password}
          onClick={() => {
            toggle('password');
          }}
        >
          {t('account.changePassword')}
        </Button>
      </div>

      {done && (
        <FormAlert tone="success">
          {done.kind === 'email'
            ? t('account.emailSent').replace('{email}', done.email)
            : t('account.passwordChanged')}
        </FormAlert>
      )}
      <div id={ids.email}>
        {open === 'email' && (
          <EmailChangeForm
            onDone={(newEmail) => {
              setOpen(null);
              setDone({ kind: 'email', email: newEmail });
            }}
            onCancel={() => {
              setOpen(null);
            }}
          />
        )}
      </div>
      <div id={ids.password}>
        {open === 'password' && (
          <PasswordChangeForm
            onDone={() => {
              setOpen(null);
              setDone({ kind: 'password' });
            }}
            onCancel={() => {
              setOpen(null);
            }}
          />
        )}
      </div>
    </section>
  );
}

function FormButtons({
  busy,
  submit,
  onCancel,
}: Readonly<{ busy: boolean; submit: string; onCancel: () => void }>) {
  const { t } = useLocale();
  return (
    <div className="flex flex-wrap gap-3">
      <Button type="submit" disabled={busy}>
        {busy ? t('auth.working') : submit}
      </Button>
      <Button variant="ghost" onClick={onCancel}>
        {t('account.cancel')}
      </Button>
    </div>
  );
}

function EmailChangeForm({
  onDone,
  onCancel,
}: Readonly<{ onDone: (newEmail: string) => void; onCancel: () => void }>) {
  const { t } = useLocale();
  const change = useRequestEmailChange();
  const form = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { newEmail: '', password: '' },
  });
  const { errors, isSubmitting } = form.formState;

  useEffect(() => {
    form.setFocus('newEmail');
  }, [form]);

  const submit = form.handleSubmit(async (values) => {
    try {
      await change.mutateAsync(values);
      onDone(values.newEmail);
    } catch (error) {
      showProblem(error, ['newEmail', 'password'], form.setError, {
        'User.PasswordIncorrect': 'password',
        'User.EmailTaken': 'newEmail',
        'User.EmailUnchanged': 'newEmail',
      });
    }
  });

  return (
    <form
      noValidate
      aria-label={t('account.changeEmail')}
      onSubmit={(event) => void submit(event)}
      className="flex max-w-md flex-col gap-4"
    >
      {errors.root && <FormAlert tone="error">{messageOf(t, errors.root.message)}</FormAlert>}
      <TextField
        label={t('account.newEmail')}
        type="email"
        autoComplete="email"
        error={messageOf(t, errors.newEmail?.message)}
        {...form.register('newEmail')}
      />
      <TextField
        label={t('account.currentPassword')}
        type="password"
        autoComplete="current-password"
        error={messageOf(t, errors.password?.message)}
        {...form.register('password')}
      />
      <FormButtons busy={isSubmitting} submit={t('account.sendLink')} onCancel={onCancel} />
    </form>
  );
}

function PasswordChangeForm({ onDone, onCancel }: Readonly<{ onDone: () => void; onCancel: () => void }>) {
  const { t } = useLocale();
  const change = useChangePassword();
  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });
  const { errors, isSubmitting } = form.formState;

  useEffect(() => {
    form.setFocus('currentPassword');
  }, [form]);

  const submit = form.handleSubmit(async (values) => {
    try {
      await change.mutateAsync({ currentPassword: values.currentPassword, newPassword: values.newPassword });
      onDone();
    } catch (error) {
      showProblem(error, ['currentPassword', 'newPassword'], form.setError, {
        'User.PasswordIncorrect': 'currentPassword',
      });
    }
  });

  return (
    <form
      noValidate
      aria-label={t('account.changePassword')}
      onSubmit={(event) => void submit(event)}
      className="flex max-w-md flex-col gap-4"
    >
      {errors.root && <FormAlert tone="error">{messageOf(t, errors.root.message)}</FormAlert>}
      <TextField
        label={t('account.currentPassword')}
        type="password"
        autoComplete="current-password"
        error={messageOf(t, errors.currentPassword?.message)}
        {...form.register('currentPassword')}
      />
      <TextField
        label={t('auth.newPassword')}
        type="password"
        autoComplete="new-password"
        hint={t('auth.passwordHint')}
        error={messageOf(t, errors.newPassword?.message)}
        {...form.register('newPassword')}
      />
      <TextField
        label={t('account.newPasswordConfirm')}
        type="password"
        autoComplete="new-password"
        error={messageOf(t, errors.confirm?.message)}
        {...form.register('confirm')}
      />
      <FormButtons busy={isSubmitting} submit={t('account.save')} onCancel={onCancel} />
    </form>
  );
}
