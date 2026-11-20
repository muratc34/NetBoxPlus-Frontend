import { isLocale } from '@netboxplus/i18n';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { browseMetadata, BrowsePage } from '../../../features/browse/browse-page';

export async function generateMetadata({ params }: PageProps<'/[lang]/series'>): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? browseMetadata(lang, 'Series') : {};
}

export default async function SeriesPage({ params, searchParams }: PageProps<'/[lang]/series'>) {
  const { lang } = await params;
  if (!isLocale(lang)) {
    notFound();
  }
  return <BrowsePage lang={lang} kind="Series" searchParams={await searchParams} />;
}
