import type { Metadata } from 'next';
import { HistoryPage } from '../../../features/history/history-page';
import { pageTitle } from '../../../i18n/server';

export async function generateMetadata({ params }: PageProps<'/[lang]/history'>): Promise<Metadata> {
  return { title: await pageTitle(params, 'history.title'), robots: { index: false } };
}

export default function HistoryRoute() {
  return <HistoryPage />;
}
