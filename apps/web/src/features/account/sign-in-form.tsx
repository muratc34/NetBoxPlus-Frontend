'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { safeNextPath, useSession, useSignIn } from '@netboxplus/core';
import { Button } from '@netboxplus/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormAlert, TextField } from '../../components/form';
import { useLocale } from '../../i18n/translator';
import { profilesPath, routes } from '../../routes';
import { email, messageOf, showProblem } from './form-rules';

// Any non-empty password is sent: the backend says whether it is right, never which part was wrong.
const schema = z.object({ email, password: z.string().min(1, 'validation.required') });
type Values = z.infer<typeof schema>;

export function SignInForm() {
  const { locale, t } = useLocale();
  const router = useRouter();
  // After signing in comes "Who's watching?", then the page that asked for signing in.
  const next = profilesPath(locale, safeNextPath(useSearchParams().get('next')));
  const session = useSession();
  const signIn = useSignIn();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });
  const { errors, isSubmitting } = form.formState;

  // Already signed in (another tab, the back button): go on.
  useEffect(() => {
    if (session.data) {
      router.replace(next);
    }
  }, [session.data, router, next]);

  const submit = form.handleSubmit(async (values) => {
    try {
      await signIn.mutateAsync(values);
      router.replace(next);
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
        autoComplete="current-password"
        error={messageOf(t, errors.password?.message)}
        {...form.register('password')}
      />
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? t('auth.working') : t('auth.signIn.submit')}
      </Button>
      <div className="flex flex-col gap-3 text-sm text-ink-muted">
        <Link href={routes.forgotPassword(locale)} className="text-ink hover:underline">
          {t('auth.signIn.forgot')}
        </Link>
        <p>
          {t('auth.signIn.noAccount')}{' '}
          <Link href={routes.signUp(locale)} className="font-semibold text-ink-strong hover:underline">
            {t('auth.signIn.toSignUp')}
          </Link>
        </p>
      </div>
    </form>
  );
}
