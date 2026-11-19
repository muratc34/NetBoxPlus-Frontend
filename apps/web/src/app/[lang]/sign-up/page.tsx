import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SignUpForm } from '../../../features/account/sign-up-form';
import { AuthCard } from '../../../components/form';
import { pageTitle, translatorFor } from '../../../i18n/server';

export async function generateMetadata({ params }: PageProps<'/[lang]/sign-up'>): Promise<Metadata> {
  return { title: await pageTitle(params, 'auth.signUp.title'), robots: { index: false } };
}

export default async function Page({ params }: PageProps<'/[lang]/sign-up'>) {
  const t = await translatorFor(params);
  return (
    <AuthCard title={t('auth.signUp.title')}>
      {/* The form reads the query string, which is only known in the browser for a static page. */}
      <Suspense>
        <SignUpForm />
      </Suspense>
    </AuthCard>
  );
}
