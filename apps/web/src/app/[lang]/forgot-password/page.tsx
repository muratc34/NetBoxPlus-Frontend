import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ForgotPasswordForm } from '../../../features/account/forgot-password-form';
import { AuthCard } from '../../../components/form';
import { pageTitle, translatorFor } from '../../../i18n/server';

export async function generateMetadata({ params }: PageProps<'/[lang]/forgot-password'>): Promise<Metadata> {
  return { title: await pageTitle(params, 'auth.forgot.title'), robots: { index: false } };
}

export default async function Page({ params }: PageProps<'/[lang]/forgot-password'>) {
  const t = await translatorFor(params);
  return (
    <AuthCard title={t('auth.forgot.title')}>
      {/* The form reads the query string, which is only known in the browser for a static page. */}
      <Suspense>
        <ForgotPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
