import { problemMessageKey } from '@netboxplus/core';
import { useEffect, useId } from 'react';
import { Link, useSearchParams } from 'react-router';
import { pageOf, useAddressSearch } from '../components/address-search';
import { Pagination } from '../components/pagination';
import { usersPageSize, useUsers } from '../data/users';
import { useLocale } from '../i18n';
import { paths } from '../paths';
import { useDateTime } from '../videos/video-format';
import { UserStatus } from './user-status';

/**
 * The accounts, newest first, searched by part of the e-mail address; the search and the page live in the
 * address, so the list can be linked and comes back the same.
 */
export function UsersPage() {
  const { t } = useLocale();
  const searchId = useId();
  const [params, setParams] = useSearchParams();
  const { text, setText, search } = useAddressSearch();
  const page = pageOf(params.get('page'));
  const users = useUsers(search, page);
  const dateTime = useDateTime();

  useEffect(() => {
    document.title = t('admin.users.title');
  }, [t]);

  return (
    <>
      <h1 className="font-display text-3xl font-bold text-ink-strong">{t('admin.users.title')}</h1>
      <div className="flex max-w-md flex-col gap-1.5">
        <label htmlFor={searchId} className="text-sm font-semibold text-ink-strong">
          {t('admin.users.search')}
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

      {users.isPending ? (
        <p aria-busy="true" className="text-ink-muted">
          {t('browse.loading')}
        </p>
      ) : users.isError ? (
        <p role="alert" className="text-ink-muted">
          {t(problemMessageKey(users.error))}
        </p>
      ) : users.data.items.length === 0 ? (
        <p className="text-ink-muted">{t('admin.users.empty')}</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="text-ink-muted">
                <tr className="border-b border-line">
                  {[
                    t('admin.users.email'),
                    t('admin.users.roles'),
                    t('admin.content.status'),
                    t('admin.users.joined'),
                  ].map((header) => (
                    <th key={header} scope="col" className="px-4 py-3 font-normal">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.data.items.map((user) => (
                  <tr key={user.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        to={paths.user(user.id)}
                        className="font-semibold text-ink-strong hover:underline focus-visible:outline-3 focus-visible:outline-focus"
                      >
                        {user.email}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{user.roles.length > 0 ? user.roles.join(', ') : '—'}</td>
                    <td className="px-4 py-3">
                      <UserStatus disabled={user.isDisabled} lockedOutUntil={user.lockedOutUntil} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{dateTime(user.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={usersPageSize}
            total={users.data.totalCount}
            onPage={(next) => {
              setParams({ ...(search ? { search } : {}), page: String(next) });
            }}
          />
        </>
      )}
    </>
  );
}
