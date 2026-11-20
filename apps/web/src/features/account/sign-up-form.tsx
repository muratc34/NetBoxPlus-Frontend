'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { safeNextPath, useRegister } from '@netboxplus/core';
import { Button } from '@netboxplus/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormAlert, TextField } from '../../components/form';
import { useLocale } from '../../i18n/translator';
import { profilesPath, signInPath } from '../../routes';
import { email, messageOf, password, showProblem } from './form-rules';

const schema = z
  .object({ email, password, confirm: z.string() })
  .refine((values) => values.password === values.confirm, {
    path: ['confirm'],
    error: 'validation.passwordMismatch',
  });
type Values = z.infer<typeof schema>;

/**
 * Registration signs the account in too; the confirmation link arrives by e-mail meanwhile. A safe `next`
 * (the plans page sends one) is where the visitor goes once a profile is chosen.
 */
export function SignUpForm() {
  const { locale, t } = useLocale();
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get('next'));
  const register = useRegister();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', confirm: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    try {
      await register.mutateAsync({ email: values.email, password: values.password });
      router.replace(profilesPath(locale, next));
    } catch (error) {
      showProblem(error, ['email', 'password'], form.setError);
    }
  });

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-5">
      {errors.root && <FormAlert tone="error">{messageOf(t, errors.root.message)}</FormAlert>}
      <TextField
        label={t('auth.email')}
        type="email"
        autoComplete="email"
        error={messageOf(t, errors.email?.message)}
        {...form.register('email')}
      />
      <TextField
        label={t('auth.password')}
        type="password"
        autoComplete="new-password"
        hint={t('auth.passwordHint')}
        error={messageOf(t, errors.password?.message)}
        {...form.register('password')}
      />
      <TextField
        label={t('auth.passwordConfirm')}
        type="password"
        autoComplete="new-password"
        error={messageOf(t, errors.confirm?.message)}
        {...form.register('confirm')}
      />
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? t('auth.working') : t('auth.signUp.submit')}
      </Button>
      <p className="text-sm text-ink-muted">
        {t('auth.signUp.haveAccount')}{' '}
        <Link href={signInPath(locale, next)} className="font-semibold text-ink-strong hover:underline">
          {t('auth.signUp.toSignIn')}
        </Link>
      </p>
    </form>
  );
}
