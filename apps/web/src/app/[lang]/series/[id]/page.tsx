import { isLocale } from '@netboxplus/i18n';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isTitleId, TitlePage, titleMetadata } from '../../../../features/titles/title-page';
import { loadSeries } from '../../../../server/catalog';

async function find(params: PageProps<'/[lang]/series/[id]'>['params']) {
  const { lang, id } = await params;
  if (!isLocale(lang) || !isTitleId(id)) {
    return undefined;
  }
  const series = await loadSeries(id, lang);
  return series ? { lang, details: { kind: 'Series', item: series } as const } : undefined;
}

export async function generateMetadata({ params }: PageProps<'/[lang]/series/[id]'>): Promise<Metadata> {
  const found = await find(params);
  return found ? titleMetadata(found.lang, found.details) : {};
}

export default async function SeriesPage({ params }: PageProps<'/[lang]/series/[id]'>) {
  const found = await find(params);
  if (!found) {
    notFound();
  }
  return <TitlePage lang={found.lang} details={found.details} />;
}
