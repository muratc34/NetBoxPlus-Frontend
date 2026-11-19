'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRequestPasswordReset } from '@netboxplus/core';
import { Button } from '@netboxplus/ui';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormAlert, TextField } from '../../components/form';
import { useLocale } from '../../i18n/translator';
import { routes } from '../../routes';
import { email, messageOf, showProblem } from './form-rules';

const schema = z.object({ email });
type Values = z.infer<typeof schema>;

/** The answer is the same whether the address has an account or not, so the page never tells. */
export function ForgotPasswordForm() {
  const { locale, t } = useLocale();
  const request = useRequestPasswordReset();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '' } });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    try {
      await request.mutateAsync(values.email);
    } catch (error) {
      showProblem(error, ['email'], form.setError);
    }
  });

  if (request.isSuccess) {
    return (
      <div className="flex flex-col gap-5">
        <FormAlert tone="success">{t('auth.forgot.sent')}</FormAlert>
        <Link href={routes.signIn(locale)} className="font-semibold text-ink-strong hover:underline">
          {t('auth.forgot.back')}
        </Link>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-5">
      <p className="text-ink-muted">{t('auth.forgot.body')}</p>
      {errors.root && <FormAlert tone="error">{messageOf(t, errors.root.message)}</FormAlert>}
      <TextField
        label={t('auth.email')}
        type="email"
        autoComplete="email"
        error={messageOf(t, errors.email?.message)}
        {...form.register('email')}
      />
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? t('auth.working') : t('auth.forgot.submit')}
      </Button>
      <Link href={routes.signIn(locale)} className="text-sm text-ink hover:underline">
        {t('auth.forgot.back')}
      </Link>
    </form>
  );
}
