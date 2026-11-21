import { problemMessageKey } from '@netboxplus/core';
import { useEffect } from 'react';
import { Link } from 'react-router';
import { buttonClass } from '../components/buttons';
import { can, useAdminSession } from '../data/session';
import { useRoles } from '../data/users';
import { useLocale } from '../i18n';
import { paths } from '../paths';

/** Every role: its name, whether it is the system's, how many permissions it gives and to how many users. */
export function RolesPage() {
  const { t } = useLocale();
  const session = useAdminSession();
  const roles = useRoles();

  useEffect(() => {
    document.title = t('admin.roles.title');
  }, [t]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold text-ink-strong">{t('admin.roles.title')}</h1>
        {can(session.data, 'auth:roles:write') && (
          <Link to={paths.newRole} className={buttonClass('primary')}>
            {t('admin.roles.new')}
          </Link>
        )}
      </div>
      {roles.isPending ? (
        <p aria-busy="true" className="text-ink-muted">
          {t('browse.loading')}
        </p>
      ) : roles.isError ? (
        <p role="alert" className="text-ink-muted">
          {t(problemMessageKey(roles.error))}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="text-ink-muted">
              <tr className="border-b border-line">
                {[t('admin.roles.name'), t('admin.roles.permissions'), t('admin.roles.users')].map(
                  (header) => (
                    <th key={header} scope="col" className="px-4 py-3 font-normal">
                      {header}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {[...roles.data]
                .sort(
                  (left, right) =>
                    Number(right.isSystem) - Number(left.isSystem) || left.name.localeCompare(right.name),
                )
                .map((role) => (
                  <tr key={role.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        to={paths.role(role.id)}
                        className="font-semibold text-ink-strong hover:underline focus-visible:outline-3 focus-visible:outline-focus"
                      >
                        {role.name}
                      </Link>
                      {role.isSystem && (
                        <span className="ml-2 inline-flex rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-ink">
                          {t('admin.roles.system')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{role.permissions.length}</td>
                    <td className="px-4 py-3 tabular-nums">{role.userCount}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
