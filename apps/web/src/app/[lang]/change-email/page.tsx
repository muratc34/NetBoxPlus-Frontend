import type { Metadata } from 'next';
import { Suspense } from 'react';
import { EmailChangeConfirmation } from '../../../features/account/token-confirmation';
import { AuthCard } from '../../../components/form';
import { pageTitle, translatorFor } from '../../../i18n/server';

export async function generateMetadata({ params }: PageProps<'/[lang]/change-email'>): Promise<Metadata> {
  return { title: await pageTitle(params, 'auth.change.title'), robots: { index: false } };
}

export default async function Page({ params }: PageProps<'/[lang]/change-email'>) {
  const t = await translatorFor(params);
  return (
    <AuthCard title={t('auth.change.title')}>
      {/* The form reads the query string, which is only known in the browser for a static page. */}
      <Suspense>
        <EmailChangeConfirmation />
      </Suspense>
    </AuthCard>
  );
}
