'use client';

import type { Credit } from '@netboxplus/core';
import Link from 'next/link';
import { useLocale } from '../../i18n/translator';
import { routes } from '../../routes';

const crewRoles = ['Creator', 'Director', 'Writer'] as const;

const personLink =
  'rounded-sm text-ink-strong hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus';

/** Who made it (by role) and who is in it (with the part they play), each leading to their page. */
export function Credits({ credits }: Readonly<{ credits: readonly Credit[] }>) {
  const { locale, t } = useLocale();
  const ordered = [...credits].sort((a, b) => a.order - b.order);
  const cast = ordered.filter((credit) => credit.role === 'Actor');
  const crew = crewRoles
    .map((role) => ({ role, people: ordered.filter((credit) => credit.role === role) }))
    .filter((group) => group.people.length > 0);

  if (cast.length === 0 && crew.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="credits-title" className="flex flex-col gap-4 px-4 sm:px-8">
      <h2 id="credits-title" className="font-display text-xl font-bold text-ink-strong">
        {t('credits.title')}
      </h2>
      {crew.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {crew.map((group) => (
            <div key={group.role} className="contents">
              <dt className="text-ink-muted">{t(`credits.${group.role}`)}</dt>
              <dd>
                {group.people.map((credit, index) => (
                  <span key={credit.personId}>
                    {index > 0 && ', '}
                    <Link href={routes.person(locale, credit.personId)} className={personLink}>
                      {credit.personName}
                    </Link>
                  </span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {cast.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm text-ink-muted">{t('credits.cast')}</h3>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {cast.map((credit) => (
              <li
                key={`${credit.personId}-${credit.characterName ?? ''}`}
                className="rounded-md bg-surface p-3"
              >
                <Link href={routes.person(locale, credit.personId)} className={personLink}>
                  {credit.personName}
                </Link>
                {credit.characterName && (
                  <p className="mt-1 text-sm text-ink-muted">{credit.characterName}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
