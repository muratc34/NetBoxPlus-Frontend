import { isApiError, servicePrefix, unwrap, type StreamingSchemas } from '@netboxplus/api';
import { useQuery } from '@tanstack/react-query';
import { useGateway } from './gateway';

export type TrailerRating = StreamingSchemas['AgeRating'];

export interface Trailer {
  /** The master playlist's full address; signed, good until `expiresAt`. */
  readonly playlistUrl: string;
  readonly durationSeconds: number;
  /** The title's rating: the trailer is public, whether to show it to a profile is the page's decision. */
  readonly ageRating: TrailerRating;
}

export const trailerKeys = { forTitle: (titleId: string) => ['trailer', titleId] as const };

/**
 * The newest trailer of a published title, or `null` when it has none (404 `Trailer.NotFound`). Asked only
 * once `enabled`. Streaming answers the playlist relative to its own root, so it is resolved against the
 * service's address at the gateway, not against the request's.
 */
export function useTrailer(titleId: string, enabled: boolean) {
  const { baseUrl, clients } = useGateway();
  return useQuery({
    queryKey: trailerKeys.forTitle(titleId),
    queryFn: async (): Promise<Trailer | null> => {
      try {
        const link = await unwrap(
          clients.streaming.GET('/titles/{titleId}/trailer', { params: { path: { titleId } } }),
        );
        const root = `${baseUrl.replace(/\/+$/, '')}${servicePrefix('streaming')}/`;
        return {
          playlistUrl: new URL(link.playlist, root).toString(),
          durationSeconds: link.durationSeconds,
          ageRating: link.ageRating,
        };
      } catch (error) {
        if (isApiError(error) && error.status === 404) {
          return null;
        }
        throw error;
      }
    },
    enabled,
    // The playlist's signature lasts an hour; a new one is asked well before.
    staleTime: 30 * 60_000,
  });
}
