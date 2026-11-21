import { problemMessageKey } from '@netboxplus/core';
import { FormAlert, SelectField } from '@netboxplus/ui';
import type { UseMutationResult } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { buttonClass } from '../components/buttons';
import { ConfirmDialog } from '../components/confirm-dialog';
import { LeaveGuard } from '../components/leave-guard';
import { can, useAdminSession } from '../data/session';
import {
  languageName,
  mediaLanguages,
  TrackRejected,
  useRemoveAudioTrack,
  useRemoveSubtitle,
  useUploadAudioTrack,
  useUploadSubtitle,
  type MediaLanguage,
  type VideoDetails,
} from '../data/videos';
import { useLocale } from '../i18n';

type TrackStatus = VideoDetails['audioTracks'][number]['status'];

type TrackUpload = UseMutationResult<
  void,
  Error,
  { language: MediaLanguage; file: File; onProgress?: (fraction: number) => void }
>;

/**
 * A ready feature video's dubbing and subtitles: listed with their state, added in a language not taken
 * yet, removed after asking. A trailer takes neither; an old-layout video takes no dubbing.
 */
export function VideoTracks({ video }: Readonly<{ video: VideoDetails }>) {
  const { t } = useLocale();
  const audio = useUploadAudioTrack(video.id);
  const subtitle = useUploadSubtitle(video.id);
  if (video.purpose === 'Trailer') {
    return <p className="text-ink-muted">{t('admin.tracks.trailer')}</p>;
  }
  return (
    <>
      {/* One guard for both uploads: a router holds a single blocker at a time. */}
      <LeaveGuard
        active={audio.isPending || subtitle.isPending}
        title={t('admin.videos.leaveTitle')}
        body={t('admin.videos.leaveBody')}
      />
      <AudioTracks video={video} upload={audio} />
      <Subtitles video={video} upload={subtitle} />
    </>
  );
}

function TrackStatusText({ status }: Readonly<{ status: TrackStatus }>) {
  const { t } = useLocale();
  return <>{t(`admin.tracks.status.${status}`)}</>;
}

function AudioTracks({ video, upload }: Readonly<{ video: VideoDetails; upload: TrackUpload }>) {
  const { locale, t } = useLocale();
  const id = useId();
  const session = useAdminSession();
  const writable = can(session.data, 'streaming:videos:write');
  const remove = useRemoveAudioTrack(video.id);
  const [removing, setRemoving] = useState<string | null>(null);
  const tracks = [...video.audioTracks].sort(
    (left, right) => Number(right.isOriginal) - Number(left.isOriginal),
  );
  const taken = new Set([video.originalAudioLanguage, ...video.audioTracks.map((track) => track.language)]);
  const free = mediaLanguages.filter((language) => !taken.has(language));
  const outdated = video.audioLayout === 'Muxed';

  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 rounded-lg bg-surface p-6">
      <h2 id={id} className="font-display text-xl font-bold text-ink-strong">
        {t('admin.tracks.audio')}
      </h2>
      {outdated && <p className="text-ink-muted">{t('admin.tracks.outdated')}</p>}
      {tracks.length === 0 ? (
        <p className="text-ink-muted">{t('admin.tracks.noDubs')}</p>
      ) : (
        <TrackTable
          rows={tracks.map((track) => ({
            key: track.id,
            language: languageName(track.language, locale),
            kind: track.isOriginal ? t('admin.tracks.original') : t('admin.tracks.dub'),
            status: track.status,
            failure: track.failureReason,
            removable: writable && !track.isOriginal,
            onRemove: () => {
              remove.reset();
              setRemoving(track.language);
            },
          }))}
          withKind
        />
      )}
      {writable && !outdated && video.status === 'Ready' && (
        <TrackForm
          label={t('admin.tracks.addAudio')}
          fileLabel={t('admin.tracks.audioFile')}
          hint={t('admin.tracks.audioHint')}
          accept="audio/*,video/*"
          typeMessage={t('admin.tracks.audioType')}
          languages={free}
          mutation={upload}
          withProgress
        />
      )}
      {writable && !outdated && video.status !== 'Ready' && (
        <p className="text-ink-muted">{t('admin.tracks.notReady')}</p>
      )}
      <ConfirmDialog
        open={removing !== null}
        title={t('admin.tracks.removeTitle').replace('{name}', languageName(removing ?? '', locale))}
        body={t('admin.tracks.removeAudioBody')}
        confirmLabel={t('admin.tracks.removeLabel')}
        busy={remove.isPending}
        error={remove.isError ? t(problemMessageKey(remove.error)) : undefined}
        onConfirm={() => {
          if (removing) {
            remove.mutate(removing, {
              onSuccess: () => {
                setRemoving(null);
              },
            });
          }
        }}
        onOpenChange={(open) => {
          if (!open) {
            setRemoving(null);
          }
        }}
      />
    </section>
  );
}

function Subtitles({ video, upload }: Readonly<{ video: VideoDetails; upload: TrackUpload }>) {
  const { locale, t } = useLocale();
  const id = useId();
  const session = useAdminSession();
  const writable = can(session.data, 'streaming:videos:write');
  const remove = useRemoveSubtitle(video.id);
  const [removing, setRemoving] = useState<string | null>(null);
  const subtitles = [...video.subtitles].sort((left, right) => left.language.localeCompare(right.language));
  const taken = new Set(video.subtitles.map((subtitle) => subtitle.language));
  const free = mediaLanguages.filter((language) => !taken.has(language));

  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 rounded-lg bg-surface p-6">
      <h2 id={id} className="font-display text-xl font-bold text-ink-strong">
        {t('admin.tracks.subtitles')}
      </h2>
      {subtitles.length === 0 ? (
        <p className="text-ink-muted">{t('admin.tracks.noSubtitles')}</p>
      ) : (
        <TrackTable
          rows={subtitles.map((subtitle) => ({
            key: subtitle.id,
            language: languageName(subtitle.language, locale),
            status: subtitle.status,
            failure: null,
            removable: writable,
            onRemove: () => {
              remove.reset();
              setRemoving(subtitle.language);
            },
          }))}
        />
      )}
      {writable && video.status === 'Ready' && (
        <TrackForm
          label={t('admin.tracks.addSubtitle')}
          fileLabel={t('admin.tracks.subtitleFile')}
          hint={t('admin.tracks.subtitleHint')}
          accept=".vtt,.srt"
          typeMessage={t('admin.tracks.subtitleType')}
          languages={free}
          mutation={upload}
        />
      )}
      {writable && video.status !== 'Ready' && <p className="text-ink-muted">{t('admin.tracks.notReady')}</p>}
      <ConfirmDialog
        open={removing !== null}
        title={t('admin.tracks.removeTitle').replace('{name}', languageName(removing ?? '', locale))}
        body={t('admin.tracks.removeSubtitleBody')}
        confirmLabel={t('admin.tracks.removeLabel')}
        busy={remove.isPending}
        error={remove.isError ? t(problemMessageKey(remove.error)) : undefined}
        onConfirm={() => {
          if (removing) {
            remove.mutate(removing, {
              onSuccess: () => {
                setRemoving(null);
              },
            });
          }
        }}
        onOpenChange={(open) => {
          if (!open) {
            setRemoving(null);
          }
        }}
      />
    </section>
  );
}

interface TrackRow {
  readonly key: string;
  readonly language: string;
  readonly kind?: string;
  readonly status: TrackStatus;
  readonly failure: string | null;
  readonly removable: boolean;
  readonly onRemove: () => void;
}

function TrackTable({ rows, withKind = false }: Readonly<{ rows: readonly TrackRow[]; withKind?: boolean }>) {
  const { t } = useLocale();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-ink-muted">
          <tr className="border-b border-line">
            <th scope="col" className="py-2 pr-4 font-normal">
              {t('admin.tracks.language')}
            </th>
            {withKind && (
              <th scope="col" className="py-2 pr-4 font-normal">
                {t('admin.tracks.kind')}
              </th>
            )}
            <th scope="col" className="py-2 pr-4 font-normal">
              {t('admin.content.status')}
            </th>
            <th scope="col" className="py-2 font-normal">
              <span className="sr-only">{t('admin.actions')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-line last:border-0">
              <td className="py-2 pr-4 font-semibold text-ink-strong">{row.language}</td>
              {withKind && <td className="py-2 pr-4">{row.kind}</td>}
              <td className="py-2 pr-4">
                <TrackStatusText status={row.status} />
                {row.failure && <span className="block text-xs text-red-300">{row.failure}</span>}
              </td>
              <td className="py-2 text-right">
                {row.removable && (
                  <button
                    type="button"
                    className={buttonClass('ghost', 'sm')}
                    aria-label={t('admin.tracks.remove').replace('{name}', row.language)}
                    onClick={row.onRemove}
                  >
                    {t('admin.tracks.removeLabel')}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const rejections = {
  empty: 'admin.videos.emptyFile',
  size: 'admin.videos.tooLarge',
} as const;

/** A language not taken yet and a file, sent through the given upload. */
function TrackForm({
  label,
  fileLabel,
  hint,
  accept,
  typeMessage,
  languages,
  mutation,
  withProgress = false,
}: Readonly<{
  label: string;
  fileLabel: string;
  hint: string;
  accept: string;
  typeMessage: string;
  languages: readonly MediaLanguage[];
  mutation: TrackUpload;
  withProgress?: boolean;
}>) {
  const { locale, t } = useLocale();
  const id = useId();
  const [file, setFile] = useState<File | null>(null);
  const [chosen, setChosen] = useState<MediaLanguage | ''>('');
  const [progress, setProgress] = useState(0);
  const language = chosen && languages.includes(chosen) ? chosen : (languages[0] ?? '');
  const failure = mutation.error;
  const message =
    failure instanceof TrackRejected
      ? failure.reason === 'type'
        ? typeMessage
        : t(rejections[failure.reason])
      : failure
        ? t(problemMessageKey(failure))
        : undefined;

  if (languages.length === 0) {
    return <p className="text-ink-muted">{t('admin.tracks.allLanguages')}</p>;
  }

  return (
    <form
      aria-label={label}
      className="flex flex-col gap-4 rounded-md border border-line p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        if (!file || !language) {
          return;
        }
        setProgress(0);
        mutation.mutate(
          { language, file, onProgress: setProgress },
          {
            onSuccess: () => {
              setFile(null);
              form.reset();
            },
          },
        );
      }}
    >
      <h3 className="font-semibold text-ink-strong">{label}</h3>
      {message && <FormAlert tone="error">{message}</FormAlert>}
      <fieldset disabled={mutation.isPending} className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label={t('admin.tracks.language')}
          value={language}
          options={languages.map((tag) => ({ value: tag, label: languageName(tag, locale) }))}
          onChange={(event) => {
            setChosen(languages.find((tag) => tag === event.target.value) ?? '');
          }}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-file`} className="text-sm font-semibold text-ink-strong">
            {fileLabel}
          </label>
          <input
            id={`${id}-file`}
            type="file"
            accept={accept}
            aria-describedby={`${id}-hint`}
            className="text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-white/15 file:px-3 file:py-2 file:font-semibold file:text-white focus-visible:outline-3 focus-visible:outline-focus"
            onChange={(event) => {
              mutation.reset();
              setFile(event.target.files?.[0] ?? null);
            }}
          />
        </div>
      </fieldset>
      <p id={`${id}-hint`} className="text-sm text-ink-muted">
        {hint}
      </p>
      {withProgress && mutation.isPending && (
        <p role="status" className="text-sm text-ink-muted">
          {t('admin.image.uploading').replace('{percent}', String(Math.round(progress * 100)))}
        </p>
      )}
      <button
        type="submit"
        className={`${buttonClass('primary')} self-start`}
        disabled={!file || mutation.isPending}
      >
        {mutation.isPending ? t('auth.working') : t('admin.videos.send')}
      </button>
    </form>
  );
}
