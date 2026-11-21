import { hasMessage } from '@netboxplus/i18n';
import { useLocale } from '../i18n';

/** The services a permission's first part names, in the order the editor groups them. */
export const services = ['auth', 'catalog', 'billing', 'streaming', 'notification'] as const;

const actions = ['sign-in', 'read', 'write', 'publish', 'upload', 'delete'];
const rank = (action: string) => {
  const index = actions.indexOf(action);
  return index === -1 ? actions.length : index;
};

/** By resource (`movies`) in the alphabet, then reading before changing before deleting. */
function byResourceThenAction(left: string, right: string): number {
  const [, leftResource = '', leftAction = ''] = left.split(':');
  const [, rightResource = '', rightAction = ''] = right.split(':');
  return (
    leftResource.localeCompare(rightResource) ||
    rank(leftAction) - rank(rightAction) ||
    left.localeCompare(right)
  );
}

/** The permissions per service, each by resource and action; a service no permission names is left out. */
export function groupPermissions(
  permissions: readonly string[],
): { service: string; permissions: string[] }[] {
  // The known services first, then any other in the order its permissions come.
  const order = new Set<string>([
    ...services,
    ...permissions.map((permission) => permission.split(':')[0] ?? ''),
  ]);
  return [...order]
    .map((service) => ({
      service,
      permissions: permissions
        .filter((permission) => permission.startsWith(`${service}:`))
        .sort(byResourceThenAction),
    }))
    .filter((group) => group.permissions.length > 0);
}

/** A permission in words ("Filmleri yayınla"), or its code when it has none yet. */
export function usePermissionLabel() {
  const { t } = useLocale();
  return (permission: string) => {
    const key = `admin.permission.${permission}`;
    return hasMessage(key) ? t(key) : permission;
  };
}

/** A service in words ("Katalog"), or its code. */
export function useServiceLabel() {
  const { t } = useLocale();
  return (service: string) => {
    const key = `admin.service.${service}`;
    return hasMessage(key) ? t(key) : service;
  };
}
