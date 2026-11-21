import { unwrap, type AuthAdminSchemas } from '@netboxplus/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminGateway } from './gateway';
import type { AdminSession } from './session';

export type UserSummary = AuthAdminSchemas['UserSummary'];
export type UserDetails = AuthAdminSchemas['UserDetails'];
export type RoleSummary = AuthAdminSchemas['RoleSummary'];
export type RoleDetails = AuthAdminSchemas['RoleDetails'];

export const userKeys = {
  users: ['admin', 'auth', 'users'] as const,
  list: (search: string, page: number) => ['admin', 'auth', 'users', { search, page }] as const,
  user: (id: string) => ['admin', 'auth', 'user', id] as const,
  roles: ['admin', 'auth', 'roles'] as const,
  role: (id: string) => ['admin', 'auth', 'role', id] as const,
  permissions: ['admin', 'auth', 'permissions'] as const,
};

/** How many users a page of the list shows. */
export const usersPageSize = 20;

/**
 * Whether the session holds every permission given: Auth lets a role be given, taken, changed or deleted
 * only by someone holding all of its permissions.
 */
export function holdsAll(session: AdminSession | null | undefined, permissions: readonly string[]): boolean {
  return (
    session !== null &&
    session !== undefined &&
    permissions.every((permission) => session.permissions.includes(permission))
  );
}

/** Whether a lockout after failed sign-ins still lasts at `now`. */
export function isLockedOut(lockedOutUntil: string | null, now: number): boolean {
  return lockedOutUntil !== null && new Date(lockedOutUntil).getTime() > now;
}

/** A page of users, newest first, by part of the e-mail address. */
export function useUsers(search: string, page: number) {
  const { clients } = useAdminGateway();
  return useQuery({
    queryKey: userKeys.list(search, page),
    queryFn: () =>
      unwrap(
        clients.auth.GET('/users', {
          params: { query: { ...(search ? { search } : {}), page, pageSize: usersPageSize } },
        }),
      ),
    placeholderData: (previous) => previous,
  });
}

export function useUser(id: string) {
  const { clients } = useAdminGateway();
  return useQuery({
    queryKey: userKeys.user(id),
    queryFn: () => unwrap(clients.auth.GET('/users/{id}', { params: { path: { id } } })),
  });
}

/** After a change to a user: the user again, and the list that shows the status and the roles. */
function useUserChanged(userId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: userKeys.user(userId) }),
      queryClient.invalidateQueries({ queryKey: userKeys.users }),
      queryClient.invalidateQueries({ queryKey: userKeys.roles }),
    ]);
}

/** Closes the account (it cannot sign in, its sessions end) or opens it again; not one's own. */
export function useSetUserDisabled(userId: string) {
  const { clients } = useAdminGateway();
  const changed = useUserChanged(userId);
  return useMutation({
    mutationFn: (disabled: boolean) => {
      const request = { params: { path: { id: userId } } };
      return unwrap(
        disabled
          ? clients.auth.POST('/users/{id}/disable', request)
          : clients.auth.POST('/users/{id}/enable', request),
      );
    },
    onSettled: changed,
  });
}

/** Gives a role (`assign`) or takes it away; both need every permission of the role. */
export function useChangeUserRole(userId: string) {
  const { clients } = useAdminGateway();
  const changed = useUserChanged(userId);
  return useMutation({
    mutationFn: ({ roleId, assign }: { roleId: string; assign: boolean }) => {
      const request = { params: { path: { id: userId, roleId } } };
      return unwrap(
        assign
          ? clients.auth.PUT('/users/{id}/roles/{roleId}', request)
          : clients.auth.DELETE('/users/{id}/roles/{roleId}', request),
      );
    },
    onSettled: changed,
  });
}

/** Deletes the account for good: Auth makes it anonymous and the other services follow. */
export function useDeleteUser() {
  const { clients } = useAdminGateway();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(clients.auth.DELETE('/users/{id}', { params: { path: { id } } })),
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: userKeys.user(id) });
      void queryClient.invalidateQueries({ queryKey: userKeys.users });
      void queryClient.invalidateQueries({ queryKey: userKeys.roles });
    },
  });
}

/** Every role with its permissions and how many users hold it. */
export function useRoles(enabled = true) {
  const { clients } = useAdminGateway();
  return useQuery({
    queryKey: userKeys.roles,
    queryFn: () => unwrap(clients.auth.GET('/roles')),
    enabled,
  });
}

export function useRole(id: string | undefined) {
  const { clients } = useAdminGateway();
  return useQuery({
    queryKey: userKeys.role(id ?? ''),
    queryFn: () => unwrap(clients.auth.GET('/roles/{id}', { params: { path: { id: id ?? '' } } })),
    enabled: id !== undefined,
  });
}

/** Every permission Auth knows, in its order. */
export function usePermissions() {
  const { clients } = useAdminGateway();
  return useQuery({
    queryKey: userKeys.permissions,
    queryFn: () => unwrap(clients.auth.GET('/permissions')),
    staleTime: Infinity,
  });
}

export interface RoleFields {
  readonly name: string;
  readonly permissions: readonly string[];
}

/** Creates a role (resolves to the new id) or changes one (resolves to its id). */
export function useSaveRole() {
  const { clients } = useAdminGateway();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, fields }: { id?: string; fields: RoleFields }): Promise<string> => {
      const body = { name: fields.name, permissions: [...fields.permissions] };
      if (id) {
        await unwrap(clients.auth.PUT('/roles/{id}', { params: { path: { id } }, body }));
        return id;
      }
      const created = await unwrap(clients.auth.POST('/roles', { body }));
      return created.id;
    },
    onSuccess: (id) => {
      void queryClient.invalidateQueries({ queryKey: userKeys.role(id) });
      void queryClient.invalidateQueries({ queryKey: userKeys.roles });
      void queryClient.invalidateQueries({ queryKey: userKeys.users });
    },
  });
}

/** Deletes a role that is not the system's; its holders lose it. */
export function useDeleteRole() {
  const { clients } = useAdminGateway();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(clients.auth.DELETE('/roles/{id}', { params: { path: { id } } })),
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: userKeys.role(id) });
      void queryClient.invalidateQueries({ queryKey: userKeys.roles });
      void queryClient.invalidateQueries({ queryKey: userKeys.users });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'auth', 'user'] });
    },
  });
}
