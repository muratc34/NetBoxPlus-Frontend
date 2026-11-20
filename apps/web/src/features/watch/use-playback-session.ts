'use client';

import { isApiError } from '@netboxplus/api';
import { personalKeys, usePlaybackRequests, type PlaybackSession } from '@netboxplus/core';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';

/** At most one extra heartbeat (pausing, seeking) this often: the regular one keeps its own pace. */
export const reportGapMs = 5_000;

/**
 * The last session's ending: the next one, of whichever player, starts only after it. A plan with one
 * screen would refuse the next session while the last is still open (going on to the next episode, trying
 * again, React's strict mode mounting twice).
 */
let lastEnding: Promise<unknown> = Promise.resolve();

export type SessionState =
  | { readonly status: 'starting' }
  | { readonly status: 'open'; readonly session: PlaybackSession }
  /** Streaming refused to start, or ended the session while it played (a heartbeat answered 403/404). */
  | { readonly status: 'failed'; readonly error: unknown };

export interface PlaybackSessionControl {
  readonly state: SessionState;
  /** Tells Streaming the position now (after pausing or seeking); at most once every few seconds. */
  readonly report: () => void;
  /** Starts a new session for the same content, after a failure. */
  readonly retry: () => void;
}

/**
 * The playback session of one movie or episode for the watching profile, for as long as the component
 * shows it: started when it appears, a heartbeat with the position every `heartbeatSeconds`, ended with
 * the position when it goes away (the profile's progress is then asked again). Closing the tab ends it with a request that outlives the page; coming
 * back to the page from the browser's history starts a new one.
 *
 * A session starts only after the previous one has ended (see `lastEnding`). `position` is read after the
 * video has gone too (when the session ends), so it must not depend on the element.
 */
export function usePlaybackSession(
  profileId: string,
  contentId: string,
  position: () => number,
): PlaybackSessionControl {
  const requests = usePlaybackRequests();
  const queryClient = useQueryClient();
  const [state, setState] = useState<SessionState>({ status: 'starting' });
  const [attempt, setAttempt] = useState(0);
  const current = useRef<{ session: PlaybackSession; reportedAt: number } | undefined>(undefined);
  const readPosition = useEffectEvent(position);

  useEffect(() => {
    let mounted = true;
    let session: PlaybackSession | undefined;
    // Whether the player got the session: one it never showed ends where it would have started.
    let shown = false;
    let timer: number | undefined;

    const stopBeating = () => {
      window.clearInterval(timer);
      timer = undefined;
    };
    const beat = () => {
      const open = session;
      if (!open) {
        return;
      }
      if (current.current) {
        current.current.reportedAt = Date.now();
      }
      requests.heartbeat(open.id, readPosition()).catch((error: unknown) => {
        // A network failure is tried again with the next beat; Streaming saying no ends the session.
        if (isApiError(error) && (error.status === 403 || error.status === 404) && session === open) {
          session = undefined;
          current.current = undefined;
          stopBeating();
          if (mounted) {
            setState({ status: 'failed', error });
          }
        }
      });
    };
    const finish = (keepalive: boolean) => {
      const open = session;
      session = undefined;
      current.current = undefined;
      stopBeating();
      if (!open) {
        return undefined;
      }
      const at = shown ? readPosition() : open.resumeFromSeconds;
      return requests
        .end(open.id, at, { keepalive })
        .catch(() => undefined)
        .then(() =>
          // Continue watching and the title's progress have moved on.
          queryClient.invalidateQueries({ queryKey: personalKeys.all(profileId) }),
        );
    };

    setState({ status: 'starting' });
    // Started on the next turn, so a mount that is undone at once (strict mode) asks for nothing.
    let begun = false;
    let due: number | undefined;
    const started = new Promise<void>((resolve) => {
      due = window.setTimeout(() => {
        begun = true;
        resolve();
      }, 0);
    })
      .then(() => lastEnding)
      .then(() => requests.start(profileId, contentId));
    started.then(
      (opened) => {
        // Kept even when the component is already gone: the cleanup below still has to end it.
        session = opened;
        if (!mounted) {
          return;
        }
        shown = true;
        current.current = { session: opened, reportedAt: 0 };
        timer = window.setInterval(beat, opened.heartbeatSeconds * 1000);
        setState({ status: 'open', session: opened });
      },
      (error: unknown) => {
        if (mounted) {
          setState({ status: 'failed', error });
        }
      },
    );

    const leave = () => {
      void finish(true);
    };
    const back = (event: PageTransitionEvent) => {
      // Restored from the history cache after the session was ended on the way out.
      if (event.persisted) {
        setAttempt((count) => count + 1);
      }
    };
    window.addEventListener('pagehide', leave);
    window.addEventListener('pageshow', back);

    return () => {
      mounted = false;
      window.removeEventListener('pagehide', leave);
      window.removeEventListener('pageshow', back);
      if (!begun) {
        window.clearTimeout(due);
        return;
      }
      lastEnding = started.then(
        () => finish(false),
        () => undefined,
      );
    };
  }, [profileId, contentId, attempt, requests, queryClient]);

  const report = useCallback(() => {
    const open = current.current;
    if (!open || Date.now() - open.reportedAt < reportGapMs) {
      return;
    }
    open.reportedAt = Date.now();
    requests.heartbeat(open.session.id, position()).catch(() => undefined);
  }, [requests, position]);

  const retry = useCallback(() => {
    setAttempt((count) => count + 1);
  }, []);

  return { state, report, retry };
}
