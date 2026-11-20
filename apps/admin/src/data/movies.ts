import { unwrap, type CatalogAdminSchemas } from '@netboxplus/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminGateway } from './gateway';
import { titleKeys } from './titles';

export type MovieDetails = CatalogAdminSchemas['MovieDetails'];
export type MovieSummary = CatalogAdminSchemas['MovieSummary'];
export type MovieRequest = CatalogAdminSchemas['MovieRequest'];
export type AgeRating = CatalogAdminSchemas['AgeRating'];
export type CreditRole = CatalogAdminSchemas['CreditRole'];
export type PublicationStatus = CatalogAdminSchemas['PublicationStatus'];
export type VideoState = CatalogAdminSchemas['VideoState'];

export const ageRatings: readonly AgeRating[] = ['All', 'Age7', 'Age13', 'Age16', 'Age18'];

export interface MovieFilters {
  readonly search: string;
  readonly status: PublicationStatus | undefined;
  readonly genreId: string | undefined;
  readonly page: number;
}

export const movieKeys = {
  lists: titleKeys.lists('movie'),
  list: (filters: MovieFilters) => ['admin', 'catalog', 'movies', filters] as const,
  movie: (id: string) => titleKeys.title('movie', id),
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
