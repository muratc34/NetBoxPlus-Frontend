import { unwrap, type CatalogAdminSchemas } from '@netboxplus/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminGateway } from './gateway';
import type { PublicationStatus } from './movies';
import { titleKeys } from './titles';

export type SeriesDetails = CatalogAdminSchemas['SeriesDetails'];
export type SeriesSummary = CatalogAdminSchemas['SeriesSummary'];
export type SeriesRequest = CatalogAdminSchemas['SeriesRequest'];
export type SeasonDetails = CatalogAdminSchemas['SeasonDetails'];
export type SeasonRequest = CatalogAdminSchemas['SeasonRequest'];
export type EpisodeResponse = CatalogAdminSchemas['EpisodeResponse'];
export type EpisodeRequest = CatalogAdminSchemas['EpisodeRequest'];

export interface SeriesFilters {
  readonly search: string;
  readonly status: PublicationStatus | undefined;
  readonly genreId: string | undefined;
  readonly page: number;
}

export const seriesKeys = {
  lists: titleKeys.lists('series'),
  list: (filters: SeriesFilters) => [...titleKeys.lists('series'), filters] as const,
  series: (id: string) => titleKeys.title('series', id),
};

/** How many series a page of the list shows. */
export const seriesPageSize = 20;

/** A page of series, searched by title and filtered by status and genre. */
export function useSeriesList(filters: SeriesFilters) {
  const { clients } = useAdminGateway();
  return useQuery({
    queryKey: seriesKeys.list(filters),
    queryFn: () =>
      unwrap(
        clients.catalog.GET('/series', {
          params: {
            query: {
              ...(filters.search ? { search: filters.search } : {}),
              ...(filters.status ? { status: filters.status } : {}),
              ...(filters.genreId ? { genreId: filters.genreId } : {}),
              page: filters.page,
              pageSize: seriesPageSize,
            },
          },
        }),
      ),
    placeholderData: (previous) => previous,
  });
}

/** A series with its seasons and their episodes. */
export function useSeries(id: string | undefined) {
  const { clients } = useAdminGateway();
  return useQuery({
    queryKey: seriesKeys.series(id ?? ''),
    queryFn: () => unwrap(clients.catalog.GET('/series/{id}', { params: { path: { id: id ?? '' } } })),
    enabled: id !== undefined,
  });
}

function useSeriesChanged() {
  const queryClient = useQueryClient();
  return (id: string) => {
    void queryClient.invalidateQueries({ queryKey: seriesKeys.series(id) });
    void queryClient.invalidateQueries({ queryKey: seriesKeys.lists });
  };
}

/** Creates a series (`id` undefined; resolves to the new id) or changes its details at the editor's version. */
export function useSaveSeries() {
  const { clients } = useAdminGateway();
  const changed = useSeriesChanged();
  return useMutation({
    mutationFn: async ({ id, body }: { id?: string; body: SeriesRequest }): Promise<string> => {
      if (id) {
        await unwrap(clients.catalog.PUT('/series/{id}', { params: { path: { id } }, body }));
        return id;
      }
      return (await unwrap(clients.catalog.POST('/series', { body }))).id;
    },
    onSuccess: changed,
  });
}

/** Adds a season (`seasonId` undefined) or changes one; the body carries the series' version. */
export function useSaveSeason(seriesId: string) {
  const { clients } = useAdminGateway();
  const changed = useSeriesChanged();
  return useMutation({
    mutationFn: async ({ seasonId, body }: { seasonId?: string; body: SeasonRequest }) => {
      const path = { id: seriesId };
      if (seasonId) {
        await unwrap(
          clients.catalog.PUT('/series/{id}/seasons/{seasonId}', {
            params: { path: { ...path, seasonId } },
            body,
          }),
        );
      } else {
        await unwrap(clients.catalog.POST('/series/{id}/seasons', { params: { path }, body }));
      }
    },
    onSuccess: () => {
      changed(seriesId);
    },
  });
}

/** Removes a season without published episodes, at the series' version. */
export function useRemoveSeason(seriesId: string) {
  const { clients } = useAdminGateway();
  const changed = useSeriesChanged();
  return useMutation({
    mutationFn: ({ seasonId, version }: { seasonId: string; version: number }) =>
      unwrap(
        clients.catalog.DELETE('/series/{id}/seasons/{seasonId}', {
          params: { path: { id: seriesId, seasonId }, query: { version } },
        }),
      ),
    onSuccess: () => {
      changed(seriesId);
    },
  });
}

/** Adds an episode to a season (`episodeId` undefined) or changes one; the body carries the series' version. */
export function useSaveEpisode(seriesId: string) {
  const { clients } = useAdminGateway();
  const changed = useSeriesChanged();
  return useMutation({
    mutationFn: async ({
      seasonId,
      episodeId,
      body,
    }: {
      seasonId: string;
      episodeId?: string;
      body: EpisodeRequest;
    }) => {
      if (episodeId) {
        await unwrap(
          clients.catalog.PUT('/series/{id}/episodes/{episodeId}', {
            params: { path: { id: seriesId, episodeId } },
            body,
          }),
        );
      } else {
        await unwrap(
          clients.catalog.POST('/series/{id}/seasons/{seasonId}/episodes', {
            params: { path: { id: seriesId, seasonId } },
            body,
          }),
        );
      }
    },
    onSuccess: () => {
      changed(seriesId);
    },
  });
}

/** Removes an unpublished episode, at the series' version. */
export function useRemoveEpisode(seriesId: string) {
  const { clients } = useAdminGateway();
  const changed = useSeriesChanged();
  return useMutation({
    mutationFn: ({ episodeId, version }: { episodeId: string; version: number }) =>
      unwrap(
        clients.catalog.DELETE('/series/{id}/episodes/{episodeId}', {
          params: { path: { id: seriesId, episodeId }, query: { version } },
        }),
      ),
    onSuccess: () => {
      changed(seriesId);
    },
  });
}

/**
 * Publishes (`true`) or unpublishes an episode at the series' version. In a draft series a published
 * episode shows once the series is published.
 */
export function usePublishEpisode(seriesId: string) {
  const { clients } = useAdminGateway();
  const changed = useSeriesChanged();
  return useMutation({
    mutationFn: ({
      episodeId,
      publish,
      version,
    }: {
      episodeId: string;
      publish: boolean;
      version: number;
    }) => {
      const request = { params: { path: { id: seriesId, episodeId }, query: { version } } };
      return unwrap(
        publish
          ? clients.catalog.POST('/series/{id}/episodes/{episodeId}/publish', request)
          : clients.catalog.POST('/series/{id}/episodes/{episodeId}/unpublish', request),
      );
    },
    onSuccess: () => {
      changed(seriesId);
    },
  });
}
