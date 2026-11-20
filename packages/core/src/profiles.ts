import { unwrap, type PublicClients } from '@netboxplus/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AgeRating } from './age-ratings';
import { useGateway } from './gateway';

const readProfiles = (auth: PublicClients['auth']) => auth.GET('/profiles');

/** A profile of the signed-in account, typed from the generated client. */
export type Profile = NonNullable<Awaited<ReturnType<typeof readProfiles>>['data']>[number];

export { ageRatings, type AgeRating } from './age-ratings';

/** An account has at most this many profiles (Auth's rule); the page stops offering more. */
export const maxProfiles = 5;

export interface ProfileFields {
  readonly name: string;
  readonly maxAgeRating: AgeRating;
}

export const profileKeys = { all: ['profiles'] as const };

/** The account's profiles; only asked while there is a session. */
export function useProfiles(enabled: boolean) {
  const { clients } = useGateway();
  return useQuery({
    queryKey: profileKeys.all,
    queryFn: () => unwrap(readProfiles(clients.auth)),
    enabled,
  });
}

function useProfileChange<Variables>(send: (variables: Variables) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSettled: () => queryClient.invalidateQueries({ queryKey: profileKeys.all }),
  });
}

export function useCreateProfile() {
  const { clients } = useGateway();
  return useProfileChange((body: ProfileFields) => unwrap(clients.auth.POST('/profiles', { body })));
}

export function useUpdateProfile() {
  const { clients } = useGateway();
  return useProfileChange(({ id, ...body }: ProfileFields & { readonly id: string }) =>
    unwrap(clients.auth.PUT('/profiles/{id}', { params: { path: { id } }, body })),
  );
}

/** The backend keeps the last profile: an account always has one. */
export function useRemoveProfile() {
  const { clients } = useGateway();
  return useProfileChange((id: string) =>
    unwrap(clients.auth.DELETE('/profiles/{id}', { params: { path: { id } } })),
  );
}
