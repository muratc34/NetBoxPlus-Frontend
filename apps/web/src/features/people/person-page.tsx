import type { PublicPerson, TitleFilter } from '@netboxplus/core/reads';
import { createTranslator, locales, type Locale } from '@netboxplus/i18n';
import type { Metadata } from 'next';
import Image from 'next/image';
import { mediaSource } from '../../components/catalog/media';
import { TitleGrid } from '../../components/catalog/title-grid';
import { routes } from '../../routes';
import { loadTitles, viewerAgeLimit } from '../../server/catalog';
import { metaDescription } from '../titles/format';

export function personMetadata(lang: Locale, person: PublicPerson): Metadata {
  const path = (locale: Locale) => routes.person(locale, person.id);
  const description = person.biography ? metaDescription(person.biography) : undefined;
  return {
    title: person.name,
    ...(description ? { description } : {}),
    alternates: {
      canonical: path(lang),
      languages: Object.fromEntries(locales.map((other) => [other, path(other)])),
    },
    openGraph: {
      type: 'profile',
      title: person.name,
      url: path(lang),
      ...(description ? { description } : {}),
      ...(person.photoUrl ? { images: [{ url: person.photoUrl }] } : {}),
    },
  };
}

/** Someone credited on published content: photo, name, biography and the titles they are in. */
export async function PersonPage({
  lang,
  person,
  page,
}: Readonly<{ lang: Locale; person: PublicPerson; page: number }>) {
  const t = createTranslator(lang);
  const maxAgeRating = await viewerAgeLimit();
  const filter: TitleFilter = { lang, personId: person.id, ...(maxAgeRating ? { maxAgeRating } : {}) };
  const titles = await loadTitles(filter, page);

  return (
    <main className="flex flex-col gap-8 pt-6">
      <section className="flex flex-col gap-6 px-4 sm:flex-row sm:px-8">
        {person.photoUrl ? (
          <Image
            src={mediaSource(person.photoUrl) ?? person.photoUrl}
            alt=""
            width={240}
            height={360}
            unoptimized={mediaSource(person.photoUrl) === undefined}
            sizes="(min-width: 640px) 224px, 160px"
            preload
            className="aspect-[2/3] w-40 shrink-0 rounded-md bg-surface-raised object-cover sm:w-56"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex aspect-[2/3] w-40 shrink-0 items-center justify-center rounded-md bg-surface-raised font-display text-6xl font-bold text-ink-muted sm:w-56"
          >
            {Array.from(person.name)[0]?.toLocaleUpperCase(lang)}
          </span>
        )}
        <div className="flex max-w-3xl flex-col gap-4">
          <h1 className="font-display text-3xl font-bold text-ink-strong sm:text-4xl">{person.name}</h1>
          {person.biography && (
            <p className="leading-relaxed whitespace-pre-line text-ink">{person.biography}</p>
          )}
        </div>
      </section>
      <section aria-labelledby="person-titles" className="flex flex-col">
        <h2 id="person-titles" className="px-4 font-display text-xl font-bold text-ink-strong sm:px-8">
          {t('person.titles')}
        </h2>
        <TitleGrid filter={filter} firstPage={titles} pathname={routes.person(lang, person.id)} query={{}} />
      </section>
    </main>
  );
}
