import { isLocale } from '@netboxplus/i18n';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { browseMetadata, BrowsePage } from '../../../features/browse/browse-page';

export async function generateMetadata({ params }: PageProps<'/[lang]/movies'>): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? browseMetadata(lang, 'Movie') : {};
}

export default async function MoviesPage({ params, searchParams }: PageProps<'/[lang]/movies'>) {
  const { lang } = await params;
  if (!isLocale(lang)) {
    notFound();
  }
  return <BrowsePage lang={lang} kind="Movie" searchParams={await searchParams} />;
}
