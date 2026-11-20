import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AccountPage } from '../../../features/account/account-page';
import { pageTitle } from '../../../i18n/server';

export async function generateMetadata({ params }: PageProps<'/[lang]/account'>): Promise<Metadata> {
  return { title: await pageTitle(params, 'account.title'), robots: { index: false } };
}

export default function AccountRoute() {
  return (
    // The page reads the query string (the checkout's return), known only in the browser.
    <Suspense>
      <AccountPage />
    </Suspense>
  );
}
