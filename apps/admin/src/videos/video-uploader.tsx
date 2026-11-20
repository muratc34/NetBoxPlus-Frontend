import { problemMessageKey } from '@netboxplus/core';
import { FormAlert, SelectField } from '@netboxplus/ui';
import { useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { buttonClass } from '../components/buttons';
import { LeaveGuard } from '../components/leave-guard';
import {
  languageName,
  mediaLanguages,
  useUploadVideo,
  VideoRejected,
  type ContentKind,
  type MediaLanguage,
  type VideoPurpose,
} from '../data/videos';
import { useLocale } from '../i18n';
import { paths } from '../paths';

const rejections = {
  type: 'admin.videos.type',
  empty: 'admin.videos.emptyFile',
  size: 'admin.videos.tooLarge',
} as const;

/**
 * Uploads a video for one movie, episode or series: the file and its original audio language, then on to
 * the video's page once Streaming has it. Leaving while it uploads asks first.
 */
export function VideoUploader({
  contentKind,
  contentId,
  purpose,
  onCancel,
}: Readonly<{ contentKind: ContentKind; contentId: string; purpose: VideoPurpose; onCancel: () => void }>) {
  const { locale, t } = useLocale();
  const id = useId();
  const navigate = useNavigate();
  const upload = useUploadVideo();
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState<MediaLanguage>('tr-TR');
  const [progress, setProgress] = useState(0);
  // Whether leaving would stop an upload; let go before moving on to the video.
  const uploading = useRef(false);
  const failure = upload.error;
  const message =
    failure instanceof VideoRejected
      ? t(rejections[failure.reason])
      : failure
        ? t(problemMessageKey(failure))
        : undefined;

  return (
    <form
      aria-label={purpose === 'Trailer' ? t('admin.videos.uploadTrailer') : t('admin.videos.upload')}
      className="flex flex-col gap-4 rounded-md border border-line p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!file) {
          return;
        }
        setProgress(0);
        uploading.current = true;
        upload.mutate(
          { contentKind, contentId, purpose, originalAudioLanguage: language, file, onProgress: setProgress },
          {
            onSuccess: (videoId) => {
              uploading.current = false;
              void navigate(paths.video(videoId));
            },
            onError: () => {
              uploading.current = false;
            },
          },
        );
      }}
    >
      <LeaveGuard
        active={upload.isPending}
        holds={() => uploading.current}
        title={t('admin.videos.leaveTitle')}
        body={t('admin.videos.leaveBody')}
      />
      {message && <FormAlert tone="error">{message}</FormAlert>}
      <fieldset disabled={upload.isPending} className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-file`} className="text-sm font-semibold text-ink-strong">
            {t('admin.videos.file')}
          </label>
          <input
            id={`${id}-file`}
            type="file"
            accept="video/*"
            aria-describedby={`${id}-hint`}
            className="text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-white/15 file:px-3 file:py-2 file:font-semibold file:text-white focus-visible:outline-3 focus-visible:outline-focus"
            onChange={(event) => {
              upload.reset();
              setFile(event.target.files?.[0] ?? null);
            }}
          />
        </div>
        <SelectField
          label={t('admin.videos.language')}
          value={language}
          options={mediaLanguages.map((tag) => ({ value: tag, label: languageName(tag, locale) }))}
          onChange={(event) => {
            setLanguage(mediaLanguages.find((tag) => tag === event.target.value) ?? 'tr-TR');
          }}
        />
      </fieldset>
      <p id={`${id}-hint`} className="text-sm text-ink-muted">
        {t('admin.videos.hint')}
        {purpose === 'Trailer' && ` ${t('admin.videos.trailerHint')}`}
      </p>
      {upload.isPending && (
        <div className="flex flex-col gap-1">
          <progress
            aria-label={t('admin.videos.progress')}
            max={100}
            value={Math.round(progress * 100)}
            className="h-2 w-full accent-brand-strong"
          />
          <p role="status" className="text-sm text-ink-muted">
            {t('admin.image.uploading').replace('{percent}', String(Math.round(progress * 100)))}
          </p>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="submit" className={buttonClass('primary')} disabled={!file || upload.isPending}>
          {upload.isPending ? t('auth.working') : t('admin.videos.send')}
        </button>
        <button type="button" className={buttonClass('ghost')} disabled={upload.isPending} onClick={onCancel}>
          {t('admin.cancel')}
        </button>
      </div>
    </form>
  );
}
