import { servicePrefix, unwrap, type PublicClients, type StreamingSchemas } from '@netboxplus/api';
import { useMemo } from 'react';
import { useGateway } from './gateway';

/** A playback session as the player uses it: Streaming's answer with the playlist's full address. */
export interface PlaybackSession {
  readonly id: string;
  /** The master playlist; signed, so it needs no cookie. */
  readonly playlistUrl: string;
  /** How often Streaming wants to hear that the session is still watching. */
  readonly heartbeatSeconds: number;
  /** Where the profile stopped last time, 0 for a fresh start. */
  readonly resumeFromSeconds: number;
  readonly audioLanguages: readonly string[];
  readonly subtitleLanguages: readonly string[];
}

export type PlaybackPreferences = StreamingSchemas['PlaybackPreferences'];

/**
 * An address Streaming gives relative to its own root (a playlist), made absolute against where Streaming
 * is mounted at the gateway: the browser would otherwise resolve it against the page.
 */
export function streamingUrl(baseUrl: string, relative: string): string {
  return new URL(relative, `${baseUrl.replace(/\/+$/, '')}${servicePrefix('streaming')}/`).toString();
}

/** The requests a player makes for its session, bound to the browser's gateway. */
export interface PlaybackRequests {
  /**
   * Opens a session for a profile and a movie or episode. Streaming refuses with 403
   * `Playback.SubscriptionRequired`/`AgeRestricted`, 404 `Playback.NotAvailable`/`ProfileNotFound` or 409
   * `Playback.TooManyScreens`.
   */
  readonly start: (profileId: string, contentId: string) => Promise<PlaybackSession>;
  /**
   * Says the session is still watching and where it is. Streaming checks the rules again: a 403 or 404
   * means the session is over.
   */
  readonly heartbeat: (sessionId: string, positionSeconds: number) => Promise<void>;
  /**
   * Ends the session, keeping the position. `keepalive` lets it outlive the page (closing the tab); if the
   * browser drops it anyway, Streaming ends a silent session after two minutes.
   */
  readonly end: (
    sessionId: string,
    positionSeconds: number,
    options?: { keepalive?: boolean },
  ) => Promise<void>;
}

/** Whole seconds, as Streaming keeps them; never negative. */
const seconds = (value: number) => Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));

export function playbackRequests(streaming: PublicClients['streaming'], baseUrl: string): PlaybackRequests {
  return {
    start: async (profileId, contentId) => {
      const started = await unwrap(streaming.POST('/playback-sessions', { body: { profileId, contentId } }));
      return {
        id: started.sessionId,
        playlistUrl: streamingUrl(baseUrl, started.playlist),
        heartbeatSeconds: started.heartbeatSeconds,
        resumeFromSeconds: started.resumeFromSeconds,
        audioLanguages: started.audioLanguages,
        subtitleLanguages: started.subtitleLanguages,
      };
    },
    heartbeat: async (sessionId, positionSeconds) => {
      await unwrap(
        streaming.POST('/playback-sessions/{id}/heartbeat', {
          params: { path: { id: sessionId } },
          body: { positionSeconds: seconds(positionSeconds) },
        }),
      );
    },
    end: async (sessionId, positionSeconds, options = {}) => {
      await unwrap(
        streaming.DELETE('/playback-sessions/{id}', {
          params: { path: { id: sessionId }, query: { positionSeconds: seconds(positionSeconds) } },
          ...(options.keepalive ? { keepalive: true } : {}),
        }),
      );
    },
  };
}

export function usePlaybackRequests(): PlaybackRequests {
  const { baseUrl, clients } = useGateway();
  return useMemo(() => playbackRequests(clients.streaming, baseUrl), [clients.streaming, baseUrl]);
}
