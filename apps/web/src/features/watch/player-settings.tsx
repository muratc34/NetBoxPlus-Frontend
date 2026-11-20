'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useLocale } from '../../i18n/translator';
import { languageNames } from '../titles/format';
import { SettingsIcon } from './player-icons';

/** What of hls.js the player reads and sets: its audio and subtitle tracks and its qualities. */
export interface TrackControl {
  readonly audioTracks: readonly { readonly lang?: string | undefined; readonly name: string }[];
  audioTrack: number;
  readonly subtitleTracks: readonly { readonly lang?: string | undefined; readonly name: string }[];
  subtitleTrack: number;
  readonly levels: readonly { readonly height: number }[];
  currentLevel: number;
  readonly autoLevelEnabled: boolean;
}

export interface TrackOption {
  /** The track's index in hls.js. */
  readonly id: number;
  /** BCP 47, as Streaming names it (`en-US`). */
  readonly language: string;
}

export interface TrackState {
  readonly audio: readonly TrackOption[];
  readonly audioCurrent: number;
  readonly subtitles: readonly TrackOption[];
  /** -1: subtitles off. */
  readonly subtitleCurrent: number;
  /** The qualities by their index in hls.js, highest first. */
  readonly levels: readonly { readonly index: number; readonly height: number }[];
  /** Whether hls.js picks the quality itself. */
  readonly levelAuto: boolean;
  /** The quality playing now, -1 before one is. */
  readonly levelPlaying: number;
}

export const noTracks: TrackState = {
  audio: [],
  audioCurrent: -1,
  subtitles: [],
  subtitleCurrent: -1,
  levels: [],
  levelAuto: true,
  levelPlaying: -1,
};

const options = (tracks: TrackControl['audioTracks']): TrackOption[] =>
  tracks.map((track, id) => ({ id, language: track.lang ?? track.name }));

export function readTracks(hls: TrackControl): TrackState {
  return {
    audio: options(hls.audioTracks),
    audioCurrent: hls.audioTrack,
    subtitles: options(hls.subtitleTracks),
    subtitleCurrent: hls.subtitleTrack,
    levels: hls.levels
      .map((level, index) => ({ index, height: level.height }))
      .sort((a, b) => b.height - a.height),
    levelAuto: hls.autoLevelEnabled,
    levelPlaying: hls.currentLevel,
  };
}

/** Whether the menu has anything to choose: a second audio language, subtitles or a second quality. */
export function hasSettings(tracks: TrackState): boolean {
  return tracks.audio.length > 1 || tracks.subtitles.length > 0 || tracks.levels.length > 1;
}

const label = 'px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-ink-muted uppercase';
const item =
  'relative flex cursor-pointer items-center rounded py-2 pr-3 pl-8 text-sm text-ink outline-none ' +
  'data-[highlighted]:bg-white/10 data-[highlighted]:text-ink-strong';

function Choice({ value, children }: Readonly<{ value: string; children: string }>) {
  return (
    <DropdownMenu.RadioItem value={value} className={item}>
      <DropdownMenu.ItemIndicator className="absolute left-3 text-brand">
        <span aria-hidden="true">●</span>
      </DropdownMenu.ItemIndicator>
      {children}
    </DropdownMenu.RadioItem>
  );
}

/**
 * The player's settings: the audio language, the subtitles and the quality, as radio choices in one menu.
 * A group with nothing to choose is left out. It opens inside `container` (the player, which may be the
 * full-screen element).
 */
export function PlayerSettings({
  tracks,
  container,
  onAudio,
  onSubtitle,
  onLevel,
  onOpenChange,
}: Readonly<{
  tracks: TrackState;
  container: HTMLElement | null;
  onAudio: (id: number) => void;
  /** -1 turns subtitles off. */
  onSubtitle: (id: number) => void;
  /** -1 lets hls.js choose. */
  onLevel: (index: number) => void;
  onOpenChange: (open: boolean) => void;
}>) {
  const { locale, t } = useLocale();
  // Each group named on its own: a region is said only where the group has two of a language.
  const namer = (group: readonly TrackOption[]) => {
    const names = languageNames(
      group.map((track) => track.language),
      locale,
    );
    return (track: TrackOption) => names.get(track.language) ?? track.language;
  };
  const audioName = namer(tracks.audio);
  const subtitleName = namer(tracks.subtitles);
  const playing = tracks.levels.find((level) => level.index === tracks.levelPlaying);

  return (
    <DropdownMenu.Root modal={false} onOpenChange={onOpenChange}>
      <DropdownMenu.Trigger
        aria-label={t('player.settings')}
        className="inline-flex size-11 items-center justify-center rounded-full text-white hover:bg-white/15 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <SettingsIcon />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal container={container}>
        <DropdownMenu.Content
          side="top"
          align="end"
          sideOffset={8}
          className="z-[70] max-h-[70vh] min-w-60 overflow-y-auto rounded-md border border-line bg-surface p-1 shadow-xl shadow-black/50"
        >
          {tracks.audio.length > 1 && (
            <DropdownMenu.Group>
              <DropdownMenu.Label className={label}>{t('player.audio')}</DropdownMenu.Label>
              <DropdownMenu.RadioGroup
                value={String(tracks.audioCurrent)}
                onValueChange={(value) => {
                  onAudio(Number(value));
                }}
              >
                {tracks.audio.map((track) => (
                  <Choice key={track.id} value={String(track.id)}>
                    {audioName(track)}
                  </Choice>
                ))}
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Group>
          )}
          {tracks.subtitles.length > 0 && (
            <DropdownMenu.Group>
              <DropdownMenu.Label className={label}>{t('player.subtitles')}</DropdownMenu.Label>
              <DropdownMenu.RadioGroup
                value={String(tracks.subtitleCurrent)}
                onValueChange={(value) => {
                  onSubtitle(Number(value));
                }}
              >
                <Choice value="-1">{t('player.subtitlesOff')}</Choice>
                {tracks.subtitles.map((track) => (
                  <Choice key={track.id} value={String(track.id)}>
                    {subtitleName(track)}
                  </Choice>
                ))}
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Group>
          )}
          {tracks.levels.length > 1 && (
            <DropdownMenu.Group>
              <DropdownMenu.Label className={label}>{t('player.quality')}</DropdownMenu.Label>
              <DropdownMenu.RadioGroup
                value={tracks.levelAuto ? 'auto' : String(tracks.levelPlaying)}
                onValueChange={(value) => {
                  onLevel(value === 'auto' ? -1 : Number(value));
                }}
              >
                <Choice value="auto">
                  {tracks.levelAuto && playing
                    ? t('player.qualityAutoNow').replace('{height}', String(playing.height))
                    : t('player.qualityAuto')}
                </Choice>
                {tracks.levels.map((level) => (
                  <Choice key={level.index} value={String(level.index)}>
                    {`${String(level.height)}p`}
                  </Choice>
                ))}
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Group>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
