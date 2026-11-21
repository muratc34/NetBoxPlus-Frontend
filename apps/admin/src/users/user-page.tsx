import { problemMessageKey } from '@netboxplus/core';
import { FormAlert, SelectField } from '@netboxplus/ui';
import { useEffect, useId, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { UserSubscriptions, useUserSubscriptions } from '../billing/user-subscriptions';
import { buttonClass } from '../components/buttons';
import { UserEmails, useUserEmails } from '../emails/user-emails';
import { ConfirmDialog } from '../components/confirm-dialog';
import { can, useAdminSession } from '../data/session';
import {
  holdsAll,
  useChangeUserRole,
  useDeleteUser,
  useRoles,
  useSetUserDisabled,
  useUser,
  type UserDetails,
} from '../data/users';
import { useLocale } from '../i18n';
import { paths } from '../paths';
import { useDateTime } from '../videos/video-format';
import { UserStatus } from './user-status';

/**
 * One account: its address and state, closing and opening it, its roles, and deleting it for good. One's
 * own account cannot be closed, deleted or lose a role here.
 */
export function UserPage() {
  const { t } = useLocale();
  const id = useParams().id ?? '';
  const session = useAdminSession();
  const user = useUser(id);
  // Asked beside the account, not after it: the panels read the same queries.
  useUserSubscriptions(id, can(session.data, 'billing:subscriptions:read'));
  useUserEmails(id, can(session.data, 'notification:emails:read'));

  useEffect(() => {
    document.title = user.data?.email ?? t('admin.users.title');
  }, [user.data?.email, t]);

  if (user.isPending) {
    return (
      <p aria-busy="true" className="text-ink-muted">
        {t('browse.loading')}
      </p>
    );
  }
  if (user.isError) {
    return (
      <p role="alert" className="text-ink-muted">
        {t(problemMessageKey(user.error))}
      </p>
    );
  }
  return <UserView user={user.data} />;
}

function UserView({ user }: Readonly<{ user: UserDetails }>) {
  const { t } = useLocale();
  const session = useAdminSession();
  const dateTime = useDateTime();
  const self = session.data?.userId === user.id;
  const writable = can(session.data, 'auth:users:write');

  const facts: [string, string][] = [
    [t('admin.users.verified'), user.emailVerified ? t('admin.yes') : t('admin.no')],
    [t('admin.users.failedSignIns'), String(user.failedSignInCount)],
    [t('admin.users.joined'), dateTime(user.createdAt)],
    [t('admin.users.modified'), user.modifiedAt ? dateTime(user.modifiedAt) : '—'],
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold break-all text-ink-strong">{user.email}</h1>
        <UserStatus disabled={user.isDisabled} lockedOutUntil={user.lockedOutUntil} />
      </div>
      {self && <p className="text-ink-muted">{t('admin.users.self')}</p>}
      <section className="rounded-lg bg-surface p-6">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {facts.map(([term, value]) => (
            <div key={term}>
              <dt className="text-sm text-ink-muted">{term}</dt>
              <dd className="font-semibold text-ink-strong">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      {writable && !self && <AccessSection user={user} />}
      <RolesSection user={user} self={self} />
      {can(session.data, 'billing:subscriptions:read') && <UserSubscriptions userId={user.id} />}
      {can(session.data, 'notification:emails:read') && <UserEmails userId={user.id} />}
      {can(session.data, 'auth:users:delete') && !self && <DeleteSection user={user} />}
    </>
  );
}

/** Closing the account (after asking) or opening it again. */
function AccessSection({ user }: Readonly<{ user: UserDetails }>) {
  const { t } = useLocale();
  const id = useId();
  const change = useSetUserDisabled(user.id);
  const [asking, setAsking] = useState(false);

  return (
    <section aria-labelledby={id} className="flex flex-col items-start gap-3 rounded-lg bg-surface p-6">
      <h2 id={id} className="font-display text-xl font-bold text-ink-strong">
        {t('admin.users.access')}
      </h2>
      {user.isDisabled ? (
        <>
          <p className="text-ink-muted">{t('admin.users.disabledNote')}</p>
          {change.isError && <FormAlert tone="error">{t(problemMessageKey(change.error))}</FormAlert>}
          <button
            type="button"
            className={buttonClass('secondary')}
            disabled={change.isPending}
            onClick={() => {
              change.mutate(false);
            }}
          >
            {change.isPending ? t('auth.working') : t('admin.users.enable')}
          </button>
        </>
      ) : (
        <>
          <p className="text-ink-muted">{t('admin.users.enabledNote')}</p>
          <button
            type="button"
            className={buttonClass('danger')}
            onClick={() => {
              change.reset();
              setAsking(true);
            }}
          >
            {t('admin.users.disable')}
          </button>
        </>
      )}
      <ConfirmDialog
        open={asking}
        title={t('admin.users.disableTitle').replace('{email}', user.email)}
        body={t('admin.users.disableBody')}
        confirmLabel={t('admin.users.disable')}
        busy={change.isPending}
        error={change.isError ? t(problemMessageKey(change.error)) : undefined}
        onConfirm={() => {
          change.mutate(true, {
            onSuccess: () => {
              setAsking(false);
            },
          });
        }}
        onOpenChange={setAsking}
      />
    </section>
  );
}

/**
 * The user's roles; a role is given or taken only by someone holding all of its permissions, so the
 * choice offers just those roles, and one's own roles are not taken here.
 */
function RolesSection({ user, self }: Readonly<{ user: UserDetails; self: boolean }>) {
  const { t } = useLocale();
  const id = useId();
  const session = useAdminSession();
  const writable = can(session.data, 'auth:users:write');
  const roles = useRoles(writable);
  const change = useChangeUserRole(user.id);
  const [chosen, setChosen] = useState('');
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);

  const permissionsOf = (roleId: string) => roles.data?.find((role) => role.id === roleId)?.permissions;
  const mayChange = (roleId: string) => {
    const permissions = permissionsOf(roleId);
    return permissions !== undefined && holdsAll(session.data, permissions);
  };
  const assigned = new Set(user.roles.map((role) => role.id));
  const offered = (roles.data ?? []).filter(
    (role) => !assigned.has(role.id) && holdsAll(session.data, role.permissions),
  );
  const someWithheld = (roles.data ?? []).some(
    (role) => !assigned.has(role.id) && !holdsAll(session.data, role.permissions),
  );
  const roleId = offered.some((role) => role.id === chosen) ? chosen : (offered[0]?.id ?? '');

  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 rounded-lg bg-surface p-6">
      <h2 id={id} className="font-display text-xl font-bold text-ink-strong">
        {t('admin.users.roles')}
      </h2>
      {change.isError && removing === null && (
        <FormAlert tone="error">{t(problemMessageKey(change.error))}</FormAlert>
      )}
      {user.roles.length === 0 ? (
        <p className="text-ink-muted">{t('admin.users.noRoles')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {user.roles.map((role) => (
            <li key={role.id} className="flex items-center justify-between gap-3 py-2">
              {can(session.data, 'auth:roles:read') ? (
                <Link
                  to={paths.role(role.id)}
                  className="font-semibold text-ink-strong hover:underline focus-visible:outline-3 focus-visible:outline-focus"
                >
                  {role.name}
                </Link>
              ) : (
                <span className="font-semibold text-ink-strong">{role.name}</span>
              )}
              {writable && !self && mayChange(role.id) && (
                <button
                  type="button"
                  className={buttonClass('ghost', 'sm')}
                  aria-label={t('admin.users.removeRoleNamed').replace('{name}', role.name)}
                  onClick={() => {
                    change.reset();
                    setRemoving(role);
                  }}
                >
                  {t('admin.tracks.removeLabel')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {writable &&
        (offered.length > 0 ? (
          <form
            aria-label={t('admin.users.addRole')}
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              change.mutate({ roleId, assign: true });
            }}
          >
            <SelectField
              label={t('admin.users.addRole')}
              value={roleId}
              options={offered.map((role) => ({ value: role.id, label: role.name }))}
              onChange={(event) => {
                setChosen(event.target.value);
              }}
            />
            <button type="submit" className={buttonClass('secondary')} disabled={change.isPending}>
              {change.isPending && removing === null ? t('auth.working') : t('admin.users.assign')}
            </button>
          </form>
        ) : (
          roles.isSuccess && !someWithheld && <p className="text-ink-muted">{t('admin.users.allRoles')}</p>
        ))}
      {writable && someWithheld && <p className="text-sm text-ink-muted">{t('admin.users.rolesWithheld')}</p>}
      <ConfirmDialog
        open={removing !== null}
        title={t('admin.users.removeRoleTitle').replace('{name}', removing?.name ?? '')}
        body={t('admin.users.removeRoleBody')}
        confirmLabel={t('admin.tracks.removeLabel')}
        busy={change.isPending}
        error={change.isError ? t(problemMessageKey(change.error)) : undefined}
        onConfirm={() => {
          if (removing) {
            change.mutate(
              { roleId: removing.id, assign: false },
              {
                onSuccess: () => {
                  setRemoving(null);
                },
              },
            );
          }
        }}
        onOpenChange={(open) => {
          if (!open) {
            setRemoving(null);
            change.reset();
          }
        }}
      />
    </section>
  );
}

/** Deleting the account for good, after asking. */
function DeleteSection({ user }: Readonly<{ user: UserDetails }>) {
  const { t } = useLocale();
  const id = useId();
  const navigate = useNavigate();
  const remove = useDeleteUser();
  const [asking, setAsking] = useState(false);

  return (
    <section aria-labelledby={id} className="flex flex-col items-start gap-3 rounded-lg bg-surface p-6">
      <h2 id={id} className="font-display text-xl font-bold text-ink-strong">
        {t('admin.delete')}
      </h2>
      <button
        type="button"
        className={buttonClass('danger')}
        onClick={() => {
          remove.reset();
          setAsking(true);
        }}
      >
        {t('admin.users.delete')}
      </button>
      <ConfirmDialog
        open={asking}
        title={t('admin.users.deleteTitle').replace('{email}', user.email)}
        body={t('admin.users.deleteBody')}
        confirmLabel={t('admin.delete')}
        busy={remove.isPending}
        error={remove.isError ? t(problemMessageKey(remove.error)) : undefined}
        onConfirm={() => {
          remove.mutate(user.id, {
            onSuccess: () => {
              setAsking(false);
              void navigate(paths.users, { replace: true });
            },
          });
        }}
        onOpenChange={setAsking}
      />
    </section>
  );
}
