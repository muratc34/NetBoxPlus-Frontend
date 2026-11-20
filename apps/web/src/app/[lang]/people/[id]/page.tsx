import { isLocale } from '@netboxplus/i18n';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { parseBrowseQuery } from '../../../../features/browse/browse-page';
import { personMetadata, PersonPage } from '../../../../features/people/person-page';
import { isTitleId } from '../../../../features/titles/title-page';
import { loadPerson } from '../../../../server/catalog';

async function find(params: PageProps<'/[lang]/people/[id]'>['params']) {
  const { lang, id } = await params;
  if (!isLocale(lang) || !isTitleId(id)) {
    return undefined;
  }
  const person = await loadPerson(id, lang);
  return person ? { lang, person } : undefined;
}

export async function generateMetadata({ params }: PageProps<'/[lang]/people/[id]'>): Promise<Metadata> {
  const found = await find(params);
  return found ? personMetadata(found.lang, found.person) : {};
}

export default async function PersonRoute({ params, searchParams }: PageProps<'/[lang]/people/[id]'>) {
  const found = await find(params);
  if (!found) {
    notFound();
  }
  const { page } = parseBrowseQuery(await searchParams);
  return <PersonPage lang={found.lang} person={found.person} page={page} />;
}
