'use client';

import { usePlaybackRequests } from '@netboxplus/core';
import { classNames } from '@netboxplus/ui';
import Link from 'next/link';
import { useCallback, useEffect, useEffectEvent, useRef, useState, type MouseEvent } from 'react';
import { useLocale } from '../../i18n/translator';
import {
  BackIcon,
  ForwardIcon,
  FullscreenIcon,
  PauseIcon,
  PlayIcon,
  RewindIcon,
  VolumeIcon,
} from './player-icons';
import { PlaybackProblem } from './player-problem';
import {
  hasSettings,
  noTracks,
  PlayerSettings,
  readTracks,
  type TrackControl,
  type TrackState,
} from './player-settings';
import { idleMs, useIdle } from './use-idle';
import { usePlaybackSession } from './use-playback-session';

/** How far the skip buttons and the arrow keys move. */
export const skipSeconds = 10;
/** How much the up and down keys change the volume. */
export const volumeStep = 0.1;
/** How long before the end the next episode is offered. */
export const nextCardSeconds = 10;

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

/** The episode the player offers near the end and plays when this one is over. */
export interface NextEpisode {
  /** "S1:E3 · The Harvest". */
  readonly label: string;
  readonly onPlay: () => void;
}

/** Whether a key press belongs to something else than the player's shortcuts. */
function ownedElsewhere(event: KeyboardEvent): boolean {
  const target = event.target instanceof HTMLElement ? event.target : null;
  if (event.altKey || event.ctrlKey || event.metaKey || !target) {
    return event.altKey || event.ctrlKey || event.metaKey;
  }
  if (target.closest('[role="menu"], [role="dialog"]')) {
    return true;
  }
  const slider = target instanceof HTMLInputElement && target.type === 'range';
  // A slider moves itself with the arrows; a focused button is pressed with Space and Enter.
  return (
    (slider && event.key.startsWith('Arrow')) ||
    (target.tagName === 'BUTTON' && (event.key === ' ' || event.key === 'Enter')) ||
    target.tagName === 'A'
  );
}

/**
 * The player of one movie or episode, over the whole page: the session (see `usePlaybackSession`), the
 * video through hls.js (Safari plays the playlist itself, without the settings menu), and its controls.
 * It starts where the profile stopped unless `fromStart`.
 *
 * - The settings menu chooses the audio, the subtitles and the quality; audio and subtitles are kept for
 *   the profile, so its next sessions start with them.
 * - Keys: Space or K plays and pauses, the arrows skip and change the volume, M mutes, F goes full
 *   screen, C turns subtitles on and off.
 * - While the video plays the controls and the pointer go after a few seconds without movement; moving,
 *   a key or a tap brings them back.
 * - With a `next` episode, its card appears in the last seconds and it plays when this one ends, unless
 *   the card was dismissed.
 * - When Streaming refuses or ends the session, or the video cannot be played, a dialog says why.
 */
export function Player({
  profileId,
  contentId,
  fromStart,
  heading,
  subheading,
  backHref,
  next,
  onFinished,
  hideAfterMs = idleMs,
}: Readonly<{
  profileId: string;
  contentId: string;
  fromStart: boolean;
  heading: string;
  /** Under the heading, such as "S1:E2 · The Storm". */
  subheading?: string;
  /** The title's page, where "back" goes. */
  backHref: string;
  next?: NextEpisode;
  /** The video played to its end with nothing to play next. */
  onFinished: () => void;
  hideAfterMs?: number;
}>) {
  const { t } = useLocale();
  const requests = usePlaybackRequests();
  const frame = useRef<HTMLDivElement | null>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const attachFrame = useCallback((element: HTMLDivElement | null) => {
    frame.current = element;
    setContainer(element);
  }, []);
  const video = useRef<HTMLVideoElement>(null);
  const control = useRef<TrackControl | null>(null);
  // The session's position: where the video is about to start until it has played, then the last time it
  // showed (kept apart from the element, which is gone when the session ends).
  const startAt = useRef(0);
  const played = useRef(false);
  const lastTime = useRef(0);
  const lastSubtitle = useRef(0);
  const [media, setMedia] = useState<MediaState>(initialMedia);
  const [tracks, setTracks] = useState<TrackState>(noTracks);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [nextDismissed, setNextDismissed] = useState(false);

  const position = useCallback(() => (played.current ? lastTime.current : startAt.current), []);
  const { state, report, retry } = usePlaybackSession(profileId, contentId, position);
  const session = state.status === 'open' ? state.session : undefined;
  const failure = mediaFailed ? 'media' : state.status === 'failed' ? state.error : undefined;
  const { idle, wake } = useIdle(!media.paused && !menuOpen && failure === undefined, hideAfterMs);

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
          control.current = null;
          setTracks(noTracks);
          setMediaFailed(true);
        });
        const sync = () => {
          setTracks(readTracks(hls));
        };
        for (const event of [
          Hls.Events.MANIFEST_PARSED,
          Hls.Events.AUDIO_TRACKS_UPDATED,
          Hls.Events.AUDIO_TRACK_SWITCHED,
          Hls.Events.SUBTITLE_TRACKS_UPDATED,
          Hls.Events.SUBTITLE_TRACK_SWITCH,
          Hls.Events.LEVEL_SWITCHED,
        ] as const) {
          hls.on(event, sync);
        }
        hls.loadSource(session.playlistUrl);
        hls.attachMedia(element);
        control.current = hls;
        destroy = () => {
          control.current = null;
          setTracks(noTracks);
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

  const togglePlay = () => {
    const element = video.current;
    if (element) {
      if (element.paused) {
        void element.play();
      } else {
        element.pause();
      }
    }
  };

  const seekTo = (seconds: number) => {
    const element = video.current;
    if (element) {
      element.currentTime = Math.min(Math.max(seconds, 0), media.duration || seconds);
    }
  };

  const setVolume = (volume: number) => {
    const element = video.current;
    if (element) {
      element.volume = Math.min(Math.max(volume, 0), 1);
      element.muted = element.volume === 0;
    }
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void frame.current?.requestFullscreen();
    }
  };

  /** Keeps the profile's languages: the audio and subtitles it chose last. */
  const savePreferences = (audioId: number, subtitleId: number) => {
    const audio = tracks.audio.find((track) => track.id === audioId);
    const subtitle = tracks.subtitles.find((track) => track.id === subtitleId);
    requests
      .savePreferences(profileId, {
        audioLanguage: audio?.language ?? null,
        subtitleLanguage: subtitle?.language ?? null,
      })
      .catch(() => undefined);
  };

  const chooseAudio = (id: number) => {
    if (control.current) {
      control.current.audioTrack = id;
      savePreferences(id, tracks.subtitleCurrent);
    }
  };

  const chooseSubtitle = (id: number) => {
    if (control.current) {
      if (id >= 0) {
        lastSubtitle.current = id;
      }
      control.current.subtitleTrack = id;
      savePreferences(tracks.audioCurrent, id);
    }
  };

  const chooseLevel = (index: number) => {
    if (control.current) {
      control.current.currentLevel = index;
    }
  };

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (failure !== undefined || !session || ownedElsewhere(event)) {
      return;
    }
    switch (event.key) {
      case ' ':
      case 'k':
      case 'K':
        togglePlay();
        break;
      case 'ArrowLeft':
        seekTo(media.current - skipSeconds);
        break;
      case 'ArrowRight':
        seekTo(media.current + skipSeconds);
        break;
      case 'ArrowUp':
        setVolume((media.muted ? 0 : media.volume) + volumeStep);
        break;
      case 'ArrowDown':
        setVolume((media.muted ? 0 : media.volume) - volumeStep);
        break;
      case 'm':
      case 'M':
        if (video.current) {
          video.current.muted = !video.current.muted;
        }
        break;
      case 'f':
      case 'F':
        toggleFullscreen();
        break;
      case 'c':
      case 'C':
        if (tracks.subtitles.length === 0) {
          return;
        }
        chooseSubtitle(
          tracks.subtitleCurrent >= 0
            ? -1
            : tracks.subtitles.some((track) => track.id === lastSubtitle.current)
              ? lastSubtitle.current
              : (tracks.subtitles[0]?.id ?? -1),
        );
        break;
      default:
        return;
    }
    event.preventDefault();
    wake();
  });
  const onActivity = useEffectEvent(() => {
    wake();
  });
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      onKey(event);
    };
    const activity = () => {
      onActivity();
    };
    window.addEventListener('keydown', key);
    // Moving the pointer over the player or moving focus into its controls brings them back.
    container?.addEventListener('pointermove', activity);
    container?.addEventListener('focusin', activity);
    return () => {
      window.removeEventListener('keydown', key);
      container?.removeEventListener('pointermove', activity);
      container?.removeEventListener('focusin', activity);
    };
  }, [container]);

  const remaining = media.duration - media.current;
  const offerNext =
    next !== undefined &&
    !nextDismissed &&
    failure === undefined &&
    media.duration > 0 &&
    remaining <= nextCardSeconds;

  const onVideoClick = (event: MouseEvent<HTMLVideoElement>) => {
    // A tap shows or hides the controls; a click plays or pauses.
    if ((event.nativeEvent as PointerEvent).pointerType === 'touch') {
      wake();
      return;
    }
    togglePlay();
  };

  const chrome = classNames(
    'relative motion-safe:transition-opacity motion-safe:duration-300',
    // Hidden, not gone: a click where a control is still reaches it.
    idle && 'opacity-0',
  );

  return (
    <div
      ref={attachFrame}
      role="region"
      aria-label={t('player.label')}
      className={classNames('fixed inset-0 z-50 flex flex-col bg-black text-white', idle && 'cursor-none')}
    >
      {/* Captions come from the stream: hls.js adds them to the video as text tracks. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={video}
        playsInline
        className="absolute inset-0 h-full w-full object-contain"
        onClick={onVideoClick}
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
          if (next && !nextDismissed) {
            next.onPlay();
          } else {
            onFinished();
          }
        }}
      />

      <div
        className={classNames(
          chrome,
          'flex items-center gap-3 bg-linear-to-b from-black/80 to-transparent px-4 py-3 sm:px-8',
        )}
      >
        <Link href={backHref} aria-label={t('player.back')} className={controlButton}>
          <BackIcon />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate font-display text-lg font-bold sm:text-xl">{heading}</h1>
          {subheading && <p className="truncate text-sm text-white/80">{subheading}</p>}
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center">
        {(state.status === 'starting' || (session && media.waiting)) && failure === undefined && (
          <p role="status" className="rounded-full bg-black/60 px-4 py-2 text-sm">
            {t('player.loading')}
          </p>
        )}
      </div>

      {offerNext && (
        <section
          aria-label={t('player.next.label')}
          className="absolute right-4 bottom-32 z-10 flex max-w-sm flex-col gap-3 rounded-lg bg-surface/95 p-4 text-ink shadow-xl sm:right-8"
        >
          <p aria-live="polite" className="font-semibold text-ink-strong">
            {t('player.next.title').replace('{episode}', next.label)}
          </p>
          <p aria-hidden="true" className="text-sm text-ink-muted">
            {t('player.next.countdown').replace('{seconds}', String(Math.max(0, Math.ceil(remaining))))}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={next.onPlay}
              className="inline-flex h-10 items-center rounded-md bg-white px-4 font-semibold text-black hover:bg-white/85 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {t('player.next.play')}
            </button>
            <button
              type="button"
              onClick={() => {
                setNextDismissed(true);
              }}
              className="inline-flex h-10 items-center rounded-md bg-white/15 px-4 font-semibold text-white hover:bg-white/25 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {t('player.next.dismiss')}
            </button>
          </div>
        </section>
      )}

      {session && (
        <div
          className={classNames(
            chrome,
            'flex flex-col gap-2 bg-linear-to-t from-black/80 to-transparent px-4 pt-6 pb-4 sm:px-8',
          )}
        >
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
              onClick={togglePlay}
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
                setVolume(Number(event.target.value));
              }}
              className="hidden w-24 cursor-pointer accent-white sm:block"
            />
            <span className="flex-1" />
            {hasSettings(tracks) && (
              <PlayerSettings
                tracks={tracks}
                container={container}
                onAudio={chooseAudio}
                onSubtitle={chooseSubtitle}
                onLevel={chooseLevel}
                onOpenChange={setMenuOpen}
              />
            )}
            <button
              type="button"
              aria-label={fullscreen ? t('player.exitFullscreen') : t('player.fullscreen')}
              className={controlButton}
              onClick={toggleFullscreen}
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
          container={container}
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
