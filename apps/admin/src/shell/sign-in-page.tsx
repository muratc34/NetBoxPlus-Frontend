import { zodResolver } from '@hookform/resolvers/zod';
import { safeNextPath } from '@netboxplus/core';
import { FormAlert, Logo, TextField } from '@netboxplus/ui';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { buttonClass } from '../components/buttons';
import { messageOf, showProblem } from '../components/form-errors';
import { useAdminSession, useAdminSignIn } from '../data/session';
import { useLocale } from '../i18n';
import { paths } from '../paths';

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'validation.required')
    .pipe(z.email({ error: 'validation.emailInvalid' })),
  password: z.string().min(1, 'validation.required'),
});
type Values = z.infer<typeof schema>;

/** Signing in to the panel, then on to the page that asked (`next`, on this site only). */
export function SignInPage() {
  const { t } = useLocale();
  const next = safeNextPath(useSearchParams()[0].get('next')) ?? paths.home;
  const session = useAdminSession();
  const signIn = useAdminSignIn();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });
  const { errors, isSubmitting } = form.formState;

  useEffect(() => {
    document.title = t('admin.signIn.title');
  }, [t]);

  if (session.data) {
    return <Navigate to={next} replace />;
  }

  const submit = form.handleSubmit(async (values) => {
    try {
      // The session it stores sends this page on to `next`.
      await signIn.mutateAsync(values);
    } catch (error) {
      showProblem(error, ['email', 'password'], form.setError);
    }
  });

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
      <section className="flex w-full max-w-md flex-col gap-6 rounded-lg bg-surface p-6 shadow-lg sm:p-10">
        <Logo className="text-2xl" />
        <h1 className="font-display text-2xl font-bold text-ink-strong">{t('admin.signIn.title')}</h1>
        <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-5">
          {errors.root && <FormAlert tone="error">{messageOf(t, errors.root.message)}</FormAlert>}
          <TextField
            label={t('auth.email')}
            type="email"
            autoComplete="username"
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
          <button type="submit" className={buttonClass('primary')} disabled={isSubmitting}>
            {isSubmitting ? t('auth.working') : t('auth.signIn.submit')}
          </button>
        </form>
      </section>
    </main>
  );
}
