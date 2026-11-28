import { unwrap, type PublicClients } from '@netboxplus/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useGateway } from './gateway';
import { queryKeys } from './session';

const readDevices = (session: PublicClients['session']) => session.GET('/session/devices');
const readNotificationPreferences = (notification: PublicClients['notification']) =>
  notification.GET('/me/notification-preferences');

/** A sign-in of the account: one browser or device, as the devices list shows it. */
export type Device = NonNullable<Awaited<ReturnType<typeof readDevices>>['data']>[number];

export type NotificationPreferences = NonNullable<
  Awaited<ReturnType<typeof readNotificationPreferences>>['data']
>;

export const securityKeys = {
  devices: ['devices'] as const,
  notificationPreferences: ['notification-preferences'] as const,
};

/** The account's open sessions, the most recently active first; only asked while there is a session. */
export function useDevices(enabled: boolean) {
  const { clients } = useGateway();
  return useQuery({
    queryKey: securityKeys.devices,
    queryFn: () => unwrap(readDevices(clients.session)),
    enabled,
  });
}

/**
 * Signs one device out at once. Ending this browser's own works like signing out: the gateway clears the cookie,
 * and nothing of the session stays in this tab.
 */
export function useEndDevice() {
  const { clients, setCsrfToken } = useGateway();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (device: Device) => {
      await unwrap(
        clients.session.DELETE('/session/devices/{sessionId}', {
          params: { path: { sessionId: device.id } },
        }),
      );
      return device;
    },
    onSuccess: (device) => {
      if (device.current) {
        // Signed out for everything showing it now (clear() would leave observers on the old query); the rest goes.
        setCsrfToken(undefined);
        queryClient.setQueryData(queryKeys.session, null);
        queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== queryKeys.session[0] });
        return;
      }
      void queryClient.invalidateQueries({ queryKey: securityKeys.devices });
    },
  });
}

/** Signs every other device out at once; this one stays. */
export function useEndOtherDevices() {
  const { clients } = useGateway();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(clients.session.DELETE('/session/devices')),
    onSettled: () => queryClient.invalidateQueries({ queryKey: securityKeys.devices }),
  });
}

/** What the account wants to be e-mailed about; an alert is on until turned off. */
export function useNotificationPreferences(enabled: boolean) {
  const { clients } = useGateway();
  return useQuery({
    queryKey: securityKeys.notificationPreferences,
    queryFn: () => unwrap(readNotificationPreferences(clients.notification)),
    enabled,
  });
}

export function useSetNotificationPreferences() {
  const { clients } = useGateway();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (preferences: NotificationPreferences) => {
      await unwrap(clients.notification.PUT('/me/notification-preferences', { body: preferences }));
      return preferences;
    },
    onSuccess: (preferences) => {
      queryClient.setQueryData(securityKeys.notificationPreferences, preferences);
    },
  });
}

/** Turns the sign-in alerts off with an alert's link; needs no session. */
export function useUnsubscribe() {
  const { clients } = useGateway();
  return useMutation({
    mutationFn: (token: string) =>
      unwrap(clients.notification.POST('/unsubscribe', { params: { query: { token } } })),
  });
}
