import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ResetPasswordForm } from '../../../features/account/reset-password-form';
import { AuthCard } from '../../../components/form';
import { pageTitle, translatorFor } from '../../../i18n/server';

export async function generateMetadata({ params }: PageProps<'/[lang]/reset-password'>): Promise<Metadata> {
  return { title: await pageTitle(params, 'auth.reset.title'), robots: { index: false } };
}

export default async function Page({ params }: PageProps<'/[lang]/reset-password'>) {
  const t = await translatorFor(params);
  return (
    <AuthCard title={t('auth.reset.title')}>
      {/* The form reads the query string, which is only known in the browser for a static page. */}
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
