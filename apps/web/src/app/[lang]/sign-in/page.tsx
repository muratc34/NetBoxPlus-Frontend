import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SignInForm } from '../../../features/account/sign-in-form';
import { AuthCard } from '../../../components/form';
import { pageTitle, translatorFor } from '../../../i18n/server';

export async function generateMetadata({ params }: PageProps<'/[lang]/sign-in'>): Promise<Metadata> {
  return { title: await pageTitle(params, 'auth.signIn.title'), robots: { index: false } };
}

export default async function Page({ params }: PageProps<'/[lang]/sign-in'>) {
  const t = await translatorFor(params);
  return (
    <AuthCard title={t('auth.signIn.title')}>
      {/* The form reads the query string, which is only known in the browser for a static page. */}
      <Suspense>
        <SignInForm />
      </Suspense>
    </AuthCard>
  );
}
