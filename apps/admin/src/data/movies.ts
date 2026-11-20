import { unwrap, type CatalogAdminSchemas } from '@netboxplus/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminGateway } from './gateway';
import { uploadImage } from './images';

export type MovieDetails = CatalogAdminSchemas['MovieDetails'];
export type MovieSummary = CatalogAdminSchemas['MovieSummary'];
export type MovieRequest = CatalogAdminSchemas['MovieRequest'];
export type AgeRating = CatalogAdminSchemas['AgeRating'];
export type CreditRole = CatalogAdminSchemas['CreditRole'];
export type PublicationStatus = CatalogAdminSchemas['PublicationStatus'];
export type VideoState = CatalogAdminSchemas['VideoState'];

/** The two images a title has: a 2:3 poster and a 16:9 backdrop. */
export type ImageSlotName = 'poster' | 'backdrop';

export const ageRatings: readonly AgeRating[] = ['All', 'Age7', 'Age13', 'Age16', 'Age18'];

export interface MovieFilters {
  readonly search: string;
  readonly status: PublicationStatus | undefined;
  readonly genreId: string | undefined;
  readonly page: number;
}

export const movieKeys = {
  lists: ['admin', 'catalog', 'movies'] as const,
  list: (filters: MovieFilters) => ['admin', 'catalog', 'movies', filters] as const,
  movie: (id: string) => ['admin', 'catalog', 'movie', id] as const,
};

/** How many movies a page of the list shows. */
export const moviesPageSize = 20;

/** A page of movies, searched by title and filtered by status and genre. */
export function useMovies(filters: MovieFilters) {
  const { clients } = useAdminGateway();
  return useQuery({
    queryKey: movieKeys.list(filters),
    queryFn: () =>
      unwrap(
        clients.catalog.GET('/movies', {
          params: {
            query: {
              ...(filters.search ? { search: filters.search } : {}),
              ...(filters.status ? { status: filters.status } : {}),
              ...(filters.genreId ? { genreId: filters.genreId } : {}),
              page: filters.page,
              pageSize: moviesPageSize,
            },
          },
        }),
      ),
    placeholderData: (previous) => previous,
  });
}

export function useMovie(id: string | undefined) {
  const { clients } = useAdminGateway();
  return useQuery({
    queryKey: movieKeys.movie(id ?? ''),
    queryFn: () => unwrap(clients.catalog.GET('/movies/{id}', { params: { path: { id: id ?? '' } } })),
    enabled: id !== undefined,
  });
}

/**
 * Creates a movie (`id` undefined; resolves to the new id) or changes one. A change carries the version the
 * editor loaded; Catalog refuses it (409 `Content.VersionConflict`) when someone changed the movie since.
 */
export function useSaveMovie() {
  const { clients } = useAdminGateway();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id?: string; body: MovieRequest }): Promise<string> => {
      if (id) {
        await unwrap(clients.catalog.PUT('/movies/{id}', { params: { path: { id } }, body }));
        return id;
      }
      const created = await unwrap(clients.catalog.POST('/movies', { body }));
      return created.id;
    },
    onSuccess: (id) => {
      void queryClient.invalidateQueries({ queryKey: movieKeys.movie(id) });
      void queryClient.invalidateQueries({ queryKey: movieKeys.lists });
    },
  });
}

/** Deletes a draft movie (409 `Content.MustBeUnpublished` for a published one). */
export function useDeleteMovie() {
  const { clients } = useAdminGateway();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(clients.catalog.DELETE('/movies/{id}', { params: { path: { id } } })),
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: movieKeys.movie(id) });
      void queryClient.invalidateQueries({ queryKey: movieKeys.lists });
    },
  });
}

/**
 * Publishes (`true`) or unpublishes the movie as it is stored, then reads it again and resolves to it: these
 * requests carry no version, so the editor compares the new one with its own to know whether only this
 * change came in between.
 */
export function usePublishMovie(id: string) {
  const { clients } = useAdminGateway();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (publish: boolean): Promise<MovieDetails> => {
      const params = { params: { path: { id } } };
      await unwrap(
        publish
          ? clients.catalog.POST('/movies/{id}/publish', params)
          : clients.catalog.POST('/movies/{id}/unpublish', params),
      );
      return unwrap(clients.catalog.GET('/movies/{id}', params));
    },
    onSuccess: (movie) => {
      queryClient.setQueryData(movieKeys.movie(id), movie);
      void queryClient.invalidateQueries({ queryKey: movieKeys.lists });
    },
  });
}

/**
 * Uploads an image and puts it in the slot of the movie at `version`; Catalog checks its size and shape
 * then. The movie's version goes up by one.
 */
export function useAttachMovieImage(id: string, slot: ImageSlotName) {
  const { clients, upload } = useAdminGateway();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      file,
      version,
      onProgress,
    }: {
      file: File;
      version: number;
      onProgress?: (fraction: number) => void;
    }) => {
      const uploadId = await uploadImage(clients.catalog, file, onProgress, upload);
      await unwrap(
        clients.catalog.PUT('/movies/{id}/images/{slot}', {
          params: { path: { id, slot } },
          body: { uploadId, version },
        }),
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: movieKeys.movie(id) });
      void queryClient.invalidateQueries({ queryKey: movieKeys.lists });
    },
  });
}

/** Empties the slot of the movie at `version`; a published movie keeps its poster. */
export function useRemoveMovieImage(id: string, slot: ImageSlotName) {
  const { clients } = useAdminGateway();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (version: number) =>
      unwrap(
        clients.catalog.DELETE('/movies/{id}/images/{slot}', {
          params: { path: { id, slot }, query: { version } },
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: movieKeys.movie(id) });
      void queryClient.invalidateQueries({ queryKey: movieKeys.lists });
    },
  });
}
