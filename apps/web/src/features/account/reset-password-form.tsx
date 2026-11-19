'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { isApiError } from '@netboxplus/api';
import { useResetPassword } from '@netboxplus/core';
import { Button } from '@netboxplus/ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormAlert, TextField } from '../../components/form';
import { useLocale } from '../../i18n/translator';
import { routes } from '../../routes';
import { messageOf, password, showProblem } from './form-rules';

const schema = z
  .object({ newPassword: password, confirm: z.string() })
  .refine((values) => values.newPassword === values.confirm, {
    path: ['confirm'],
    error: 'validation.passwordMismatch',
  });
type Values = z.infer<typeof schema>;

/** The page the reset e-mail links to. Success signs nobody in: the new password does that. */
export function ResetPasswordForm() {
  const { locale, t } = useLocale();
  const token = useSearchParams().get('token') ?? '';
  const reset = useResetPassword();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: '', confirm: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    try {
      await reset.mutateAsync({ token, newPassword: values.newPassword });
    } catch (error) {
      showProblem(error, ['newPassword'], form.setError);
    }
  });

  if (token === '') {
    return <LinkProblem message={t('auth.link.missing')} />;
  }

  if (reset.isSuccess) {
    return (
      <div className="flex flex-col gap-5">
        <FormAlert tone="success">{t('auth.reset.done')}</FormAlert>
        <Link href={routes.signIn(locale)} className="font-semibold text-ink-strong hover:underline">
          {t('nav.signIn')}
        </Link>
      </div>
    );
  }

  if (isApiError(reset.error, 'PasswordReset.TokenInvalid')) {
    return <LinkProblem message={t('error.PasswordReset.TokenInvalid')} />;
  }

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-5">
      {errors.root && <FormAlert tone="error">{messageOf(t, errors.root.message)}</FormAlert>}
      <TextField
        label={t('auth.newPassword')}
        type="password"
        autoComplete="new-password"
        hint={t('auth.passwordHint')}
        error={messageOf(t, errors.newPassword?.message)}
        {...form.register('newPassword')}
      />
      <TextField
        label={t('auth.passwordConfirm')}
        type="password"
        autoComplete="new-password"
        error={messageOf(t, errors.confirm?.message)}
        {...form.register('confirm')}
      />
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? t('auth.working') : t('auth.reset.submit')}
      </Button>
    </form>
  );
}

function LinkProblem({ message }: Readonly<{ message: string }>) {
  const { locale, t } = useLocale();
  return (
    <div className="flex flex-col gap-5">
      <FormAlert tone="error">{message}</FormAlert>
      <Link href={routes.forgotPassword(locale)} className="font-semibold text-ink-strong hover:underline">
        {t('auth.reset.again')}
      </Link>
    </div>
  );
}
