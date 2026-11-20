import type { Metadata } from 'next';
import { MyListPage } from '../../../features/my-list/my-list-page';
import { pageTitle } from '../../../i18n/server';

export async function generateMetadata({ params }: PageProps<'/[lang]/my-list'>): Promise<Metadata> {
  return { title: await pageTitle(params, 'myList.title'), robots: { index: false } };
}

export default function MyListRoute() {
  return <MyListPage />;
}
