import { unwrap } from '@netboxplus/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminGateway } from './gateway';
import { uploadImage } from './images';

/** A title Catalog edits as one: a movie, or a series with its seasons and episodes. */
export type TitleKind = 'movie' | 'series';

/** The two images a title has: a 2:3 poster and a 16:9 backdrop. */
export type ImageSlotName = 'poster' | 'backdrop';

export const titleKeys = {
  lists: (kind: TitleKind) => ['admin', 'catalog', kind === 'movie' ? 'movies' : 'series-list'] as const,
  title: (kind: TitleKind, id: string) => ['admin', 'catalog', kind, id] as const,
};

function useTitleChanged(kind: TitleKind, id: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: titleKeys.title(kind, id) });
    void queryClient.invalidateQueries({ queryKey: titleKeys.lists(kind) });
  };
}

/**
 * Uploads an image and puts it in the slot of the title at `version`; Catalog checks its size and shape
 * then. The title's version goes up by one.
 */
export function useAttachTitleImage(kind: TitleKind, id: string, slot: ImageSlotName) {
  const { clients, upload } = useAdminGateway();
  const changed = useTitleChanged(kind, id);
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
      const request = { params: { path: { id, slot } }, body: { uploadId, version } };
      await unwrap(
        kind === 'movie'
          ? clients.catalog.PUT('/movies/{id}/images/{slot}', request)
          : clients.catalog.PUT('/series/{id}/images/{slot}', request),
      );
    },
    onSuccess: changed,
  });
}

/** Empties the slot of the title at `version`; a published title keeps its poster. */
export function useRemoveTitleImage(kind: TitleKind, id: string, slot: ImageSlotName) {
  const { clients } = useAdminGateway();
  const changed = useTitleChanged(kind, id);
  return useMutation({
    mutationFn: (version: number) => {
      const request = { params: { path: { id, slot }, query: { version } } };
      return unwrap(
        kind === 'movie'
          ? clients.catalog.DELETE('/movies/{id}/images/{slot}', request)
          : clients.catalog.DELETE('/series/{id}/images/{slot}', request),
      );
    },
    onSuccess: changed,
  });
}

/**
 * Publishes (`true`) or unpublishes the title as it is stored, then reads it again and resolves to its
 * version: these requests carry none, so the editor compares the new one with its own to know whether only
 * this change came in between.
 */
export function usePublishTitle(kind: TitleKind, id: string) {
  const { clients } = useAdminGateway();
  const changed = useTitleChanged(kind, id);
  return useMutation({
    mutationFn: async (publish: boolean): Promise<number> => {
      const request = { params: { path: { id } } };
      if (kind === 'movie') {
        await unwrap(
          publish
            ? clients.catalog.POST('/movies/{id}/publish', request)
            : clients.catalog.POST('/movies/{id}/unpublish', request),
        );
        return (await unwrap(clients.catalog.GET('/movies/{id}', request))).version;
      }
      await unwrap(
        publish
          ? clients.catalog.POST('/series/{id}/publish', request)
          : clients.catalog.POST('/series/{id}/unpublish', request),
      );
      return (await unwrap(clients.catalog.GET('/series/{id}', request))).version;
    },
    onSuccess: changed,
  });
}

/** Deletes a draft title (409 `Content.MustBeUnpublished` for a published one). */
export function useDeleteTitle(kind: TitleKind) {
  const { clients } = useAdminGateway();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      const request = { params: { path: { id } } };
      return unwrap(
        kind === 'movie'
          ? clients.catalog.DELETE('/movies/{id}', request)
          : clients.catalog.DELETE('/series/{id}', request),
      );
    },
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: titleKeys.title(kind, id) });
      void queryClient.invalidateQueries({ queryKey: titleKeys.lists(kind) });
    },
  });
}

/**
 * The title of a movie or series by its id, read from Catalog with its read permission; `undefined` for an
 * episode (its series is not known from the id), without the permission or when it cannot be read.
 */
export function useContentName(kind: 'Movie' | 'Episode' | 'Series', id: string, allowed: boolean) {
  const { clients } = useAdminGateway();
  const titleKind: TitleKind | null = kind === 'Movie' ? 'movie' : kind === 'Series' ? 'series' : null;
  const query = useQuery({
    queryKey: titleKeys.title(titleKind ?? 'movie', id),
    queryFn: async () => {
      const request = { params: { path: { id } } };
      return titleKind === 'movie'
        ? unwrap(clients.catalog.GET('/movies/{id}', request))
        : unwrap(clients.catalog.GET('/series/{id}', request));
    },
    enabled: titleKind !== null && allowed,
  });
  return query.data?.title;
}
