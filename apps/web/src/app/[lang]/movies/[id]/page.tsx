import { isLocale } from '@netboxplus/i18n';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isTitleId, TitlePage, titleMetadata } from '../../../../features/titles/title-page';
import { loadMovie } from '../../../../server/catalog';

async function find(params: PageProps<'/[lang]/movies/[id]'>['params']) {
  const { lang, id } = await params;
  if (!isLocale(lang) || !isTitleId(id)) {
    return undefined;
  }
  const movie = await loadMovie(id, lang);
  return movie ? { lang, details: { kind: 'Movie', item: movie } as const } : undefined;
}

export async function generateMetadata({ params }: PageProps<'/[lang]/movies/[id]'>): Promise<Metadata> {
  const found = await find(params);
  return found ? titleMetadata(found.lang, found.details) : {};
}

export default async function MoviePage({ params }: PageProps<'/[lang]/movies/[id]'>) {
  const found = await find(params);
  if (!found) {
    notFound();
  }
  return <TitlePage lang={found.lang} details={found.details} />;
}
