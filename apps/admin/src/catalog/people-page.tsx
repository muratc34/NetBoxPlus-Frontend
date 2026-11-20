import { problemMessageKey } from '@netboxplus/core';
import { useEffect, useId } from 'react';
import { Link, useSearchParams } from 'react-router';
import { pageOf, useAddressSearch } from '../components/address-search';
import { buttonClass } from '../components/buttons';
import { Pagination } from '../components/pagination';
import { peoplePageSize, usePeople } from '../data/catalog';
import { can, useAdminSession } from '../data/session';
import { useLocale } from '../i18n';
import { paths } from '../paths';

/**
 * The people, a page at a time, searched by name; the search and the page live in the address, so the
 * list can be linked and comes back the same.
 */
export function PeoplePage() {
  const { t } = useLocale();
  const searchId = useId();
  const session = useAdminSession();
  const [params, setParams] = useSearchParams();
  const { text, setText, search } = useAddressSearch();
  const page = pageOf(params.get('page'));
  const people = usePeople(search, page);

  useEffect(() => {
    document.title = t('admin.people.title');
  }, [t]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold text-ink-strong">{t('admin.people.title')}</h1>
        {can(session.data, 'catalog:people:write') && (
          <Link to={paths.newPerson} className={buttonClass('primary')}>
            {t('admin.people.new')}
          </Link>
        )}
      </div>
      <div className="flex max-w-md flex-col gap-1.5">
        <label htmlFor={searchId} className="text-sm font-semibold text-ink-strong">
          {t('admin.people.search')}
        </label>
        <input
          id={searchId}
          type="search"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
          }}
          className="h-11 rounded-md border border-line bg-surface-raised px-3 text-ink-strong focus-visible:outline-3 focus-visible:outline-focus"
        />
      </div>

      {people.isPending ? (
        <p aria-busy="true" className="text-ink-muted">
          {t('browse.loading')}
        </p>
      ) : people.isError ? (
        <p role="alert" className="text-ink-muted">
          {t(problemMessageKey(people.error))}
        </p>
      ) : people.data.items.length === 0 ? (
        <p className="text-ink-muted">{t('admin.people.empty')}</p>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-line rounded-lg bg-surface">
            {people.data.items.map((person) => (
              <li key={person.id}>
                <Link
                  to={paths.person(person.id)}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-white/5 focus-visible:outline-3 focus-visible:outline-focus"
                >
                  {person.photoUrl ? (
                    <img src={person.photoUrl} alt="" className="size-10 rounded-full object-cover" />
                  ) : (
                    <span aria-hidden="true" className="size-10 rounded-full bg-white/10" />
                  )}
                  <span className="font-semibold text-ink-strong">{person.name}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination
            page={page}
            pageSize={peoplePageSize}
            total={people.data.totalCount}
            onPage={(next) => {
              setParams({ ...(search ? { search } : {}), page: String(next) });
            }}
          />
        </>
      )}
    </>
  );
}
