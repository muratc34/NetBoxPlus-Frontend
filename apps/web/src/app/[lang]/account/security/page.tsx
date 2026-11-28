import type { Metadata } from 'next';
import { SecurityPage } from '../../../../features/account/security-page';
import { pageTitle } from '../../../../i18n/server';

export async function generateMetadata({ params }: PageProps<'/[lang]/account/security'>): Promise<Metadata> {
  return { title: await pageTitle(params, 'security.title'), robots: { index: false } };
}

export default function SecurityRoute() {
  return <SecurityPage />;
}
