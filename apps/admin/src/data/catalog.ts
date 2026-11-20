import { unwrap, type CatalogAdminSchemas } from '@netboxplus/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminGateway } from './gateway';
import { uploadImage } from './images';

export type GenreResponse = CatalogAdminSchemas['GenreResponse'];
export type PersonResponse = CatalogAdminSchemas['PersonResponse'];
export type PersonPage = CatalogAdminSchemas['PageOfPersonResponse'];

/** A text per language (`tr`, `en`); an empty one is left out, Turkish is the one Catalog requires. */
export type Translations = Readonly<Partial<Record<'tr' | 'en', string>>>;

export const catalogKeys = {
  all: ['admin', 'catalog'] as const,
  genres: ['admin', 'catalog', 'genres'] as const,
  people: (search: string, page: number) => ['admin', 'catalog', 'people', { search, page }] as const,
  person: (id: string) => ['admin', 'catalog', 'person', id] as const,
};

/** How many people a page of the list shows. */
export const peoplePageSize = 20;

/** Only the languages with text: Catalog takes a missing language as "not translated". */
export function filled(translations: Translations): Record<string, string> {
  return Object.fromEntries(
    Object.entries(translations)
      .map(([language, text]) => [language, text.trim()] as const)
      .filter(([, text]) => text !== ''),
  );
}

/** Every genre with its names and how many titles use it. */
export function useGenres() {
  const { clients } = useAdminGateway();
  return useQuery({
    queryKey: catalogKeys.genres,
    queryFn: () => unwrap(clients.catalog.GET('/genres')),
  });
}

/** Creates a genre (`id` undefined) or renames one. */
export function useSaveGenre() {
  const { clients } = useAdminGateway();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, names }: { id?: string; names: Translations }) => {
      const body = { translations: filled(names) };
      return id
        ? unwrap(clients.catalog.PUT('/genres/{id}', { params: { path: { id } }, body }))
        : unwrap(clients.catalog.POST('/genres', { body }));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: catalogKeys.genres }),
  });
}

/** Deletes a genre no title uses (409 `Genre.InUse` otherwise). */
export function useDeleteGenre() {
  const { clients } = useAdminGateway();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(clients.catalog.DELETE('/genres/{id}', { params: { path: { id } } })),
    onSettled: () => queryClient.invalidateQueries({ queryKey: catalogKeys.genres }),
  });
}

/** A page of people, by name. */
export function usePeople(search: string, page: number) {
  const { clients } = useAdminGateway();
  return useQuery({
    queryKey: catalogKeys.people(search, page),
    queryFn: () =>
      unwrap(
        clients.catalog.GET('/people', {
          params: { query: { ...(search ? { search } : {}), page, pageSize: peoplePageSize } },
        }),
      ),
    placeholderData: (previous) => previous,
  });
}

export function usePerson(id: string | undefined) {
  const { clients } = useAdminGateway();
  return useQuery({
    queryKey: catalogKeys.person(id ?? ''),
    queryFn: () => unwrap(clients.catalog.GET('/people/{id}', { params: { path: { id: id ?? '' } } })),
    enabled: id !== undefined,
  });
}

export interface PersonFields {
  readonly name: string;
  /** The biography per language. */
  readonly biographies: Translations;
}

/** Creates a person (resolves to the new id) or changes one (resolves to its id). */
export function useSavePerson() {
  const { clients } = useAdminGateway();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, fields }: { id?: string; fields: PersonFields }): Promise<string> => {
      const body = { name: fields.name, translations: filled(fields.biographies) };
      if (id) {
        await unwrap(clients.catalog.PUT('/people/{id}', { params: { path: { id } }, body }));
        return id;
      }
      const created = await unwrap(clients.catalog.POST('/people', { body }));
      return created.id;
    },
    onSuccess: (id) => {
      void queryClient.invalidateQueries({ queryKey: catalogKeys.person(id) });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'catalog', 'people'] });
    },
  });
}

/** Deletes a person no title credits (409 `Person.InUse` otherwise). */
export function useDeletePerson() {
  const { clients } = useAdminGateway();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(clients.catalog.DELETE('/people/{id}', { params: { path: { id } } })),
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: catalogKeys.person(id) });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'catalog', 'people'] });
    },
  });
}

/**
 * Uploads a photo and attaches it to the person; Catalog checks it then (at least 200 by 200 pixels).
 * `onProgress` hears how much of the file has gone.
 */
export function useAttachPhoto(personId: string) {
  const { clients, upload } = useAdminGateway();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, onProgress }: { file: File; onProgress?: (fraction: number) => void }) => {
      const uploadId = await uploadImage(clients.catalog, file, onProgress, upload);
      await unwrap(
        clients.catalog.PUT('/people/{id}/photo', { params: { path: { id: personId } }, body: { uploadId } }),
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: catalogKeys.person(personId) }),
  });
}

export function useRemovePhoto(personId: string) {
  const { clients } = useAdminGateway();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      unwrap(clients.catalog.DELETE('/people/{id}/photo', { params: { path: { id: personId } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: catalogKeys.person(personId) }),
  });
}
