'use client';

import { isWithinAgeLimit, useTrailer } from '@netboxplus/core';
import { classNames } from '@netboxplus/ui';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useProfileSelection } from '../../profiles/profile-selection';
import { TitleImage } from './title-image';

/** How long the image stays alone before the trailer is asked for: the page settles first. */
export const trailerDelayMs = 2000;

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

function subscribeToMotion(listener: () => void) {
  const query = window.matchMedia(reducedMotionQuery);
  query.addEventListener('change', listener);
  return () => {
    query.removeEventListener('change', listener);
  };
}
const prefersReducedMotion = () => window.matchMedia(reducedMotionQuery).matches;
// While the server renders nothing moves.
const onServer = () => true;

/** Whether the visitor asked for less motion; true until the page runs in the browser. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeToMotion, prefersReducedMotion, onServer);
}

type Playback = 'waiting' | 'playing' | 'over';

/**
 * A title's wide image that becomes its trailer: muted, inline, once. Always muted, with no way to turn the
 * sound on: trailers have no captions (Streaming gives them only their original audio), so with sound they
 * would be video without captions. It does not play when the visitor
 * asks for less motion, when the title has no trailer, or when the trailer is rated above the chosen
 * profile's limit (it is public; showing it is the page's decision). It pauses off screen and in a hidden
 * tab, and gives way to the image when it ends or fails. hls.js is loaded only when there is something to
 * play; Safari plays the playlist itself.
 */
export function TrailerBackdrop({
  titleId,
  imageUrl,
  title,
  priority = false,
  delayMs = trailerDelayMs,
}: Readonly<{
  titleId: string;
  imageUrl: string | null | undefined;
  title: string;
  priority?: boolean;
  delayMs?: number;
}>) {
  const reducedMotion = useReducedMotion();
  const { selected } = useProfileSelection();
  const [due, setDue] = useState(false);
  // Never due when the visitor wants less motion: the timer does not start.
  const trailer = useTrailer(titleId, due);
  const [playback, setPlayback] = useState<Playback>('waiting');
  const frame = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  const found = trailer.data;
  const playlist =
    found && !reducedMotion && (!selected || isWithinAgeLimit(found.ageRating, selected.maxAgeRating))
      ? found.playlistUrl
      : undefined;
  // Once it is over (ended, failed or refused) the player goes away for good.
  const source = playback === 'over' ? undefined : playlist;

  useEffect(() => {
    if (reducedMotion) {
      return;
    }
    const timer = window.setTimeout(() => {
      setDue(true);
    }, delayMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [reducedMotion, delayMs]);

  useEffect(() => {
    const element = video.current;
    if (!source || !element) {
      return;
    }
    let destroy: (() => void) | undefined;
    let cancelled = false;

    const start = () => {
      element.play().catch(() => {
        // Autoplay refused: the image stays.
        setPlayback('over');
      });
    };

    void import('hls.js').then(({ default: Hls }) => {
      if (cancelled) {
        return;
      }
      if (Hls.isSupported()) {
        const hls = new Hls({ capLevelToPlayerSize: true });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            hls.destroy();
            setPlayback('over');
          }
        });
        hls.loadSource(source);
        hls.attachMedia(element);
        destroy = () => {
          hls.destroy();
        };
        start();
      } else if (element.canPlayType('application/vnd.apple.mpegurl')) {
        element.src = source;
        start();
      }
    });

    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [source]);

  // Off screen or in a hidden tab the trailer waits; it goes on when it is seen again.
  useEffect(() => {
    const element = video.current;
    const container = frame.current;
    if (!source || !element || !container) {
      return;
    }
    let visible = true;
    const sync = () => {
      if (visible && document.visibilityState === 'visible') {
        if (element.paused && !element.ended) {
          element.play().catch(() => undefined);
        }
      } else {
        element.pause();
      }
    };
    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries.some((entry) => entry.isIntersecting);
        sync();
      },
      { threshold: 0.25 },
    );
    observer.observe(container);
    document.addEventListener('visibilitychange', sync);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, [source]);

  const showing = source !== undefined && playback === 'playing';

  return (
    <div ref={frame} className="absolute inset-0 overflow-hidden">
      <TitleImage url={imageUrl} title={title} priority={priority} className="h-full w-full" />
      {source !== undefined && (
        <video
          ref={video}
          muted
          playsInline
          preload="none"
          aria-hidden="true"
          tabIndex={-1}
          onPlaying={() => {
            setPlayback('playing');
          }}
          onEnded={() => {
            setPlayback('over');
          }}
          className={classNames(
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-700',
            showing ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
      <div className="absolute inset-0 bg-linear-to-r from-canvas via-canvas/60 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-canvas to-transparent" />
    </div>
  );
}
