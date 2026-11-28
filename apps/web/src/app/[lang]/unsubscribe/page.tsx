import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthCard } from '../../../components/form';
import { Unsubscribe } from '../../../features/account/unsubscribe';
import { pageTitle, translatorFor } from '../../../i18n/server';

export async function generateMetadata({ params }: PageProps<'/[lang]/unsubscribe'>): Promise<Metadata> {
  return { title: await pageTitle(params, 'unsubscribe.title'), robots: { index: false } };
}

export default async function Page({ params }: PageProps<'/[lang]/unsubscribe'>) {
  const t = await translatorFor(params);
  return (
    <AuthCard title={t('unsubscribe.title')}>
      {/* The page reads the query string, which is only known in the browser for a static page. */}
      <Suspense>
        <Unsubscribe />
      </Suspense>
    </AuthCard>
  );
}
