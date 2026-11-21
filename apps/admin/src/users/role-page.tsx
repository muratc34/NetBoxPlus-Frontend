import { zodResolver } from '@hookform/resolvers/zod';
import { problemMessageKey } from '@netboxplus/core';
import { FormAlert, TextField } from '@netboxplus/ui';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import { buttonClass } from '../components/buttons';
import { ConfirmDialog } from '../components/confirm-dialog';
import { messageOf, showProblem } from '../components/form-errors';
import { UnsavedChanges } from '../components/unsaved-changes';
import { can, useAdminSession } from '../data/session';
import {
  holdsAll,
  useDeleteRole,
  usePermissions,
  useRole,
  useSaveRole,
  type RoleDetails,
} from '../data/users';
import { useLocale } from '../i18n';
import { paths } from '../paths';
import { groupPermissions, usePermissionLabel, useServiceLabel } from './permissions';

/** A role's name, as long as Auth takes it. */
export const roleNameMaxLength = 64;

const schema = z.object({
  name: z.string().trim().min(1, 'validation.required').max(roleNameMaxLength, 'error.Role.NameTooLong'),
  permissions: z.array(z.string()),
});
type Values = z.infer<typeof schema>;

/**
 * A role: its name and permissions, grouped by service. `/roles/new` makes one and goes on to its page. The
 * system role, and a role with a permission the session does not hold, are read only; a permission the
 * session does not hold cannot be given.
 */
export function RolePage() {
  const { t } = useLocale();
  const id = useParams().id;
  const role = useRole(id);
  const permissions = usePermissions();

  useEffect(() => {
    document.title = role.data?.name ?? t('admin.roles.new');
  }, [role.data?.name, t]);

  if ((id !== undefined && role.isPending) || permissions.isPending) {
    return (
      <p aria-busy="true" className="text-ink-muted">
        {t('browse.loading')}
      </p>
    );
  }
  if (role.isError || permissions.isError) {
    return (
      <p role="alert" className="text-ink-muted">
        {t(problemMessageKey(role.error ?? permissions.error))}
      </p>
    );
  }
  // Keyed by the role, so the form starts again from what Auth has after saving or loading another.
  return <RoleForm key={role.data?.id ?? 'new'} role={role.data} catalog={permissions.data} />;
}

function RoleForm({
  role,
  catalog,
}: Readonly<{ role: RoleDetails | undefined; catalog: readonly string[] }>) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const session = useAdminSession();
  const permissionLabel = usePermissionLabel();
  const serviceLabel = useServiceLabel();
  const save = useSaveRole();
  const remove = useDeleteRole();
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const held = (permission: string) => session.data?.permissions.includes(permission) ?? false;
  const system = role?.isSystem ?? false;
  const beyond = role !== undefined && !holdsAll(session.data, role.permissions);
  const writable = can(session.data, 'auth:roles:write') && !system && !beyond;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: role?.name ?? '', permissions: role ? [...role.permissions] : [] },
  });
  const { errors, isSubmitting, isDirty } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    setSaved(false);
    try {
      const id = await save.mutateAsync({
        ...(role ? { id: role.id } : {}),
        fields: {
          name: values.name,
          permissions: catalog.filter((permission) => values.permissions.includes(permission)),
        },
      });
      form.reset(values);
      if (role) {
        setSaved(true);
      } else {
        void navigate(paths.role(id), { replace: true });
      }
    } catch (error) {
      showProblem(error, ['name'], form.setError, {
        'Role.NameRequired': 'name',
        'Role.NameTooLong': 'name',
        'Role.NameTaken': 'name',
      });
    }
  });

  return (
    <>
      <UnsavedChanges dirty={isDirty && !isSubmitting} />
      <h1 className="font-display text-3xl font-bold text-ink-strong">
        {role?.name ?? t('admin.roles.new')}
      </h1>
      {system && <p className="text-ink-muted">{t('admin.roles.systemNote')}</p>}
      {!system && beyond && can(session.data, 'auth:roles:write') && (
        <p className="text-ink-muted">{t('admin.roles.beyondNote')}</p>
      )}
      <form
        noValidate
        aria-label={t('admin.roles.details')}
        onSubmit={(event) => void submit(event)}
        className="flex max-w-3xl flex-col gap-6 rounded-lg bg-surface p-6"
      >
        {errors.root && <FormAlert tone="error">{messageOf(t, errors.root.message)}</FormAlert>}
        {saved && <FormAlert tone="success">{t('admin.saved')}</FormAlert>}
        <fieldset disabled={!writable} className="flex flex-col gap-6">
          <TextField
            label={t('admin.roles.name')}
            error={messageOf(t, errors.name?.message)}
            {...form.register('name')}
          />
          <Controller
            control={form.control}
            name="permissions"
            render={({ field }) => (
              <div className="flex flex-col gap-5">
                {groupPermissions(catalog).map((group) => (
                  <fieldset key={group.service} className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                    <legend className="mb-2 font-semibold text-ink-strong">
                      {serviceLabel(group.service)}
                    </legend>
                    {group.permissions.map((permission) => (
                      <label key={permission} className="flex items-start gap-3 text-sm">
                        <input
                          type="checkbox"
                          className="mt-0.5 size-4 accent-brand"
                          checked={field.value.includes(permission)}
                          disabled={!held(permission)}
                          onChange={(event) => {
                            field.onChange(
                              event.target.checked
                                ? [...field.value, permission]
                                : field.value.filter((value) => value !== permission),
                            );
                          }}
                        />
                        <span className="flex flex-col text-ink-strong">
                          {permissionLabel(permission)}
                          <code className="text-xs text-ink-muted">{permission}</code>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                ))}
              </div>
            )}
          />
        </fieldset>
        {writable && (
          <button type="submit" className={`${buttonClass('primary')} self-start`} disabled={isSubmitting}>
            {isSubmitting ? t('auth.working') : t('admin.save')}
          </button>
        )}
      </form>

      {role && writable && (
        <section
          aria-labelledby="delete-role"
          className="flex max-w-3xl flex-col items-start gap-3 rounded-lg bg-surface p-6"
        >
          <h2 id="delete-role" className="font-display text-xl font-bold text-ink-strong">
            {t('admin.delete')}
          </h2>
          <button
            type="button"
            className={buttonClass('danger')}
            onClick={() => {
              remove.reset();
              setDeleting(true);
            }}
          >
            {t('admin.deleteNamed').replace('{name}', role.name)}
          </button>
          <ConfirmDialog
            open={deleting}
            title={t('admin.roles.deleteTitle').replace('{name}', role.name)}
            body={t('admin.roles.deleteBody')}
            confirmLabel={t('admin.delete')}
            busy={remove.isPending}
            error={remove.isError ? t(problemMessageKey(remove.error)) : undefined}
            onConfirm={() => {
              remove.mutate(role.id, {
                onSuccess: () => {
                  setDeleting(false);
                  void navigate(paths.roles, { replace: true });
                },
              });
            }}
            onOpenChange={setDeleting}
          />
        </section>
      )}
    </>
  );
}
