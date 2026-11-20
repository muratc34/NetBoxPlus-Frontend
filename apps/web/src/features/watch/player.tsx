'use client';

import { isApiError } from '@netboxplus/api';
import { problemMessageKey } from '@netboxplus/core';
import * as Dialog from '@radix-ui/react-dialog';
import { Button, classNames } from '@netboxplus/ui';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocale } from '../../i18n/translator';
import { profilesPath, routes } from '../../routes';
import {
  BackIcon,
  ForwardIcon,
  FullscreenIcon,
  PauseIcon,
  PlayIcon,
  RewindIcon,
  VolumeIcon,
} from './player-icons';
import { usePlaybackSession } from './use-playback-session';

/** How far the skip buttons move. */
export const skipSeconds = 10;

/** "1:02:03" or "12:05". */
export function formatClock(totalSeconds: number): string {
  const whole = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const seconds = String(whole % 60).padStart(2, '0');
  return hours > 0
    ? `${String(hours)}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${String(minutes)}:${seconds}`;
}

interface MediaState {
  readonly paused: boolean;
  readonly waiting: boolean;
  readonly current: number;
  readonly duration: number;
  readonly volume: number;
  readonly muted: boolean;
}

const initialMedia: MediaState = {
  paused: true,
  waiting: true,
  current: 0,
  duration: 0,
  volume: 1,
  muted: false,
};

const controlButton =
  'inline-flex size-11 items-center justify-center rounded-full text-white hover:bg-white/15 ' +
  'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus';

/**
 * The player of one movie or episode, over the whole page: the session (see `usePlaybackSession`), the
 * video through hls.js (Safari plays the playlist itself), and its controls. It starts where the profile
 * stopped unless `fromStart`. When Streaming refuses or ends the session, or the video cannot be played,
 * a dialog says why and offers what helps (the plans, another profile, trying again).
 */
export function Player({
  profileId,
  contentId,
  fromStart,
  heading,
  subheading,
  backHref,
  onFinished,
}: Readonly<{
  profileId: string;
  contentId: string;
  fromStart: boolean;
  heading: string;
  /** Under the heading, such as "S1:E2 · The Storm". */
  subheading?: string;
  /** The title's page, where "back" goes. */
  backHref: string;
  /** The video played to its end. */
  onFinished: () => void;
}>) {
  const { t } = useLocale();
  const frame = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  // The session's position: where the video is about to start until it has played, then the last time it
  // showed (kept apart from the element, which is gone when the session ends).
  const startAt = useRef(0);
  const played = useRef(false);
  const lastTime = useRef(0);
  const [media, setMedia] = useState<MediaState>(initialMedia);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const position = useCallback(() => (played.current ? lastTime.current : startAt.current), []);
  const { state, report, retry } = usePlaybackSession(profileId, contentId, position);
  const session = state.status === 'open' ? state.session : undefined;

  useEffect(() => {
    const element = video.current;
    if (!session || !element) {
      return;
    }
    const start = fromStart ? 0 : session.resumeFromSeconds;
    startAt.current = start;
    played.current = false;
    let cancelled = false;
    let destroy: (() => void) | undefined;
    const play = () => {
      // Refused autoplay leaves the video paused; the play button starts it.
      element.play().catch(() => undefined);
    };

    void import('hls.js').then(({ default: Hls }) => {
      if (cancelled) {
        return;
      }
      if (Hls.isSupported()) {
        const hls = new Hls({ startPosition: start });
        let recovered = false;
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) {
            return;
          }
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !recovered) {
            recovered = true;
            hls.recoverMediaError();
            return;
          }
          hls.destroy();
          setMediaFailed(true);
        });
        hls.loadSource(session.playlistUrl);
        hls.attachMedia(element);
        destroy = () => {
          hls.destroy();
        };
        play();
      } else if (element.canPlayType('application/vnd.apple.mpegurl')) {
        element.src = session.playlistUrl;
        element.addEventListener(
          'loadedmetadata',
          () => {
            element.currentTime = start;
          },
          { once: true },
        );
        play();
      } else {
        setMediaFailed(true);
      }
    });

    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [session, fromStart]);

  useEffect(() => {
    const sync = () => {
      setFullscreen(document.fullscreenElement !== null && document.fullscreenElement === frame.current);
    };
    document.addEventListener('fullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
    };
  }, []);

  const read = () => {
    const element = video.current;
    if (element) {
      lastTime.current = element.currentTime;
      setMedia({
        paused: element.paused,
        waiting: element.readyState < 3 && !element.paused,
        current: element.currentTime,
        duration: Number.isFinite(element.duration) ? element.duration : 0,
        volume: element.volume,
        muted: element.muted,
      });
    }
  };

  const seekTo = (seconds: number) => {
    const element = video.current;
    if (element) {
      element.currentTime = Math.min(Math.max(seconds, 0), media.duration || seconds);
    }
  };

  const failure = mediaFailed ? 'media' : state.status === 'failed' ? state.error : undefined;

  return (
    <div
      ref={frame}
      role="region"
      aria-label={t('player.label')}
      className="fixed inset-0 z-50 flex flex-col bg-black text-white"
    >
      {/* Captions come from the stream: hls.js adds them to the video as text tracks. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={video}
        playsInline
        className="absolute inset-0 h-full w-full object-contain"
        onClick={() => {
          const element = video.current;
          if (element) {
            if (element.paused) {
              void element.play();
            } else {
              element.pause();
            }
          }
        }}
        onPlaying={() => {
          played.current = true;
          read();
        }}
        onPause={() => {
          read();
          report();
        }}
        onSeeked={() => {
          read();
          report();
        }}
        onTimeUpdate={read}
        onDurationChange={read}
        onVolumeChange={read}
        onWaiting={read}
        onCanPlay={read}
        onEnded={() => {
          read();
          onFinished();
        }}
      />

      <div className="relative flex items-center gap-3 bg-linear-to-b from-black/80 to-transparent px-4 py-3 sm:px-8">
        <Link href={backHref} aria-label={t('player.back')} className={controlButton}>
          <BackIcon />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate font-display text-lg font-bold sm:text-xl">{heading}</h1>
          {subheading && <p className="truncate text-sm text-white/80">{subheading}</p>}
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center">
        {(state.status === 'starting' || (session && media.waiting)) && !failure && (
          <p role="status" className="rounded-full bg-black/60 px-4 py-2 text-sm">
            {t('player.loading')}
          </p>
        )}
      </div>

      {session && (
        <div className="relative flex flex-col gap-2 bg-linear-to-t from-black/80 to-transparent px-4 pt-6 pb-4 sm:px-8">
          <div className="flex items-center gap-3 text-sm tabular-nums">
            <input
              type="range"
              min={0}
              max={media.duration}
              step="any"
              value={Math.min(media.current, media.duration)}
              aria-label={t('player.seek')}
              aria-valuetext={t('player.time')
                .replace('{current}', formatClock(media.current))
                .replace('{total}', formatClock(media.duration))}
              disabled={media.duration === 0}
              onChange={(event) => {
                seekTo(Number(event.target.value));
              }}
              className="h-2 flex-1 cursor-pointer accent-brand focus-visible:outline-3 focus-visible:outline-focus"
            />
            <span aria-hidden="true">
              {formatClock(media.current)} / {formatClock(media.duration)}
            </span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              aria-label={media.paused ? t('player.play') : t('player.pause')}
              className={controlButton}
              onClick={() => {
                const element = video.current;
                if (element) {
                  if (element.paused) {
                    void element.play();
                  } else {
                    element.pause();
                  }
                }
              }}
            >
              {media.paused ? <PlayIcon /> : <PauseIcon />}
            </button>
            <button
              type="button"
              aria-label={t('player.rewind')}
              className={controlButton}
              onClick={() => {
                seekTo(media.current - skipSeconds);
              }}
            >
              <RewindIcon />
            </button>
            <button
              type="button"
              aria-label={t('player.forward')}
              className={controlButton}
              onClick={() => {
                seekTo(media.current + skipSeconds);
              }}
            >
              <ForwardIcon />
            </button>
            <button
              type="button"
              aria-label={media.muted ? t('player.unmute') : t('player.mute')}
              className={controlButton}
              onClick={() => {
                const element = video.current;
                if (element) {
                  element.muted = !element.muted;
                }
              }}
            >
              <VolumeIcon muted={media.muted || media.volume === 0} />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={media.muted ? 0 : media.volume}
              aria-label={t('player.volume')}
              onChange={(event) => {
                const element = video.current;
                if (element) {
                  element.volume = Number(event.target.value);
                  element.muted = element.volume === 0;
                }
              }}
              className="hidden w-24 cursor-pointer accent-white sm:block"
            />
            <span className="flex-1" />
            <button
              type="button"
              aria-label={fullscreen ? t('player.exitFullscreen') : t('player.fullscreen')}
              className={controlButton}
              onClick={() => {
                if (document.fullscreenElement) {
                  void document.exitFullscreen();
                } else {
                  void frame.current?.requestFullscreen();
                }
              }}
            >
              <FullscreenIcon active={fullscreen} />
            </button>
          </div>
        </div>
      )}

      {failure !== undefined && (
        <PlaybackProblem
          failure={failure}
          backHref={backHref}
          onRetry={() => {
            setMediaFailed(false);
            setMedia(initialMedia);
            retry();
          }}
        />
      )}
    </div>
  );
}

/**
 * Why playing stopped, as a dialog over the player, with what helps: the plans without a membership,
 * another profile for one too young or gone, trying again for the rest. Closing it goes back.
 */
function PlaybackProblem({
  failure,
  backHref,
  onRetry,
}: Readonly<{ failure: unknown; backHref: string; onRetry: () => void }>) {
  const { locale, t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const here = search ? `${pathname}?${search}` : pathname;
  const code = isApiError(failure) ? failure.code : undefined;
  const message = failure === 'media' ? t('player.error.media') : t(problemMessageKey(failure));

  const link = (href: string, label: string, primary: boolean): ReactNode => (
    <Link
      href={href}
      className={classNames(
        'inline-flex h-11 items-center justify-center rounded-md px-5 font-semibold text-white',
        'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus',
        primary ? 'bg-brand-strong hover:bg-brand-strong-hover' : 'bg-white/15 hover:bg-white/25',
      )}
    >
      {label}
    </Link>
  );
  const retryButton = <Button onClick={onRetry}>{t('player.retry')}</Button>;

  const actions =
    code === 'Playback.SubscriptionRequired' ? (
      link(routes.plans(locale), t('player.seePlans'), true)
    ) : code === 'Playback.AgeRestricted' || code === 'Playback.ProfileNotFound' ? (
      link(profilesPath(locale, here), t('player.switchProfile'), true)
    ) : code === 'Playback.NotAvailable' ? null : code === 'Playback.TooManyScreens' ? (
      <>
        {retryButton}
        {link(routes.account(locale), t('player.account'), false)}
      </>
    ) : (
      retryButton
    );

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) {
          router.push(backHref);
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/75" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-[60] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg bg-surface p-6 shadow-xl sm:p-8">
          <Dialog.Title className="font-display text-2xl font-bold text-ink-strong">
            {t('player.error.title')}
          </Dialog.Title>
          <Dialog.Description className="text-ink">{message}</Dialog.Description>
          <div className="flex flex-wrap gap-3">
            {actions}
            {link(backHref, t('player.back'), false)}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
