import { unwrap, type StreamingSchemas } from '@netboxplus/api';
import type { Locale } from '@netboxplus/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { catalogStaleTime, readTitlesByIds, type TitleKind, type TitleSummary } from './catalog-reads';
import { useGateway } from './gateway';

export type ContinueWatchingItem = StreamingSchemas['ContinueWatchingItem'];
export type ProgressView = StreamingSchemas['ProgressView'];
export type MyListItem = StreamingSchemas['MyListItem'];

/**
 * A profile's own data, kept per profile: switching profiles shows the other one's at once, and signing
 * out clears them with the rest of the cache.
 */
export const personalKeys = {
  all: (profileId: string) => ['profile', profileId] as const,
  continueWatching: (profileId: string) => ['profile', profileId, 'continue-watching'] as const,
  myList: (profileId: string) => ['profile', profileId, 'my-list'] as const,
  progress: (profileId: string, titleId: string) => ['profile', profileId, 'progress', titleId] as const,
};

/** What the profile was watching, most recent first (at most 20); none without a profile. */
export function useContinueWatching(profileId: string | undefined) {
  const { clients } = useGateway();
  return useQuery({
    queryKey: personalKeys.continueWatching(profileId ?? ''),
    queryFn: () =>
      unwrap(
        clients.streaming.GET('/profiles/{profileId}/continue-watching', {
          params: { path: { profileId: profileId ?? '' } },
        }),
      ),
    enabled: profileId !== undefined,
  });
}

/**
 * The titles on the profile's list it can watch now, most recently added first. Streaming leaves out the
 * ones that are no longer published or are above the profile's age limit.
 */
export function useMyList(profileId: string | undefined) {
  const { clients } = useGateway();
  return useQuery({
    queryKey: personalKeys.myList(profileId ?? ''),
    queryFn: () =>
      unwrap(
        clients.streaming.GET('/profiles/{profileId}/my-list', {
          params: { path: { profileId: profileId ?? '' } },
        }),
      ),
    enabled: profileId !== undefined,
  });
}

/** How far the profile has watched each movie or episode of a title. */
export function useProgress(profileId: string | undefined, titleId: string) {
  const { clients } = useGateway();
  return useQuery({
    queryKey: personalKeys.progress(profileId ?? '', titleId),
    queryFn: () =>
      unwrap(
        clients.streaming.GET('/profiles/{profileId}/progress', {
          params: { path: { profileId: profileId ?? '' }, query: { titleId } },
        }),
      ),
    enabled: profileId !== undefined,
  });
}

/**
 * The titles behind a list of ids, in that order, in `lang`: Streaming names titles by id only, so their
 * names and images come from Catalog in one request per hundred.
 */
export function useTitlesByIds(ids: readonly string[], lang: Locale) {
  const { clients } = useGateway();
  return useQuery({
    queryKey: ['catalog', 'titles-by-id', lang, ids] as const,
    queryFn: (): Promise<TitleSummary[]> => readTitlesByIds(clients.catalog, ids, lang),
    enabled: ids.length > 0,
    staleTime: catalogStaleTime,
  });
}

export interface MyListChange {
  readonly titleId: string;
  readonly kind: TitleKind;
  /** `true` puts the title on the list, `false` takes it off. */
  readonly onList: boolean;
}

/**
 * Puts a title on the profile's list or takes it off. The list changes on screen at once and goes back if
 * Streaming refuses (full, age, not watchable); it is asked again afterwards either way.
 */
export function useChangeMyList(profileId: string | undefined) {
  const { clients } = useGateway();
  const queryClient = useQueryClient();
  const key = personalKeys.myList(profileId ?? '');

  return useMutation({
    mutationFn: ({ titleId, onList }: MyListChange) => {
      const params = { params: { path: { profileId: profileId ?? '', titleId } } };
      return unwrap(
        onList
          ? clients.streaming.PUT('/profiles/{profileId}/my-list/{titleId}', params)
          : clients.streaming.DELETE('/profiles/{profileId}/my-list/{titleId}', params),
      );
    },
    onMutate: async ({ titleId, kind, onList }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const before = queryClient.getQueryData<MyListItem[]>(key);
      if (before) {
        const without = before.filter((item) => item.titleId !== titleId);
        queryClient.setQueryData<MyListItem[]>(
          key,
          onList ? [{ titleId, kind, addedAt: new Date().toISOString() }, ...without] : without,
        );
      }
      return { before };
    },
    onError: (_error, _change, context) => {
      if (context?.before) {
        queryClient.setQueryData(key, context.before);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}
