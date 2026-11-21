import { problemMessageKey } from '@netboxplus/core';
import { useEffect, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { buttonClass } from '../components/buttons';
import { isPending, languageName, useVideo, type VideoDetails } from '../data/videos';
import { useLocale } from '../i18n';
import { paths } from '../paths';
import { ContentName } from './content-name';
import { useDateTime, useDuration, useSize, VideoStatusBadge } from './video-format';
import { VideoTracks } from './video-tracks';

/** Where the content of the video is edited; an episode's series is not known from the video. */
function contentPath(video: VideoDetails): string | null {
  if (video.contentKind === 'Movie') {
    return paths.movie(video.contentId);
  }
  return video.contentKind === 'Series' ? paths.seriesItem(video.contentId) : null;
}

function Fact({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="text-ink-strong">{children}</dd>
    </div>
  );
}

/**
 * A video: what it belongs to, where it is (asked again while it uploads or is processed), its length,
 * size, qualities and original audio, and why it failed.
 */
export function VideoPage() {
  const { locale, t } = useLocale();
  const id = useParams().id;
  const video = useVideo(id);
  const duration = useDuration();
  const dateTime = useDateTime();
  const size = useSize();
  const heading = video.data
    ? `${t(`admin.videos.purpose.${video.data.purpose}`)} · ${t(`admin.videos.kind.${video.data.contentKind}`)}`
    : t('admin.videos.title');

  useEffect(() => {
    document.title = heading;
  }, [heading]);

  if (video.isPending) {
    return (
      <p aria-busy="true" className="text-ink-muted">
        {t('browse.loading')}
      </p>
    );
  }
  if (video.isError) {
    return (
      <p role="alert" className="text-ink-muted">
        {t(problemMessageKey(video.error))}
      </p>
    );
  }

  const details = video.data;
  const link = contentPath(details);
  const unfinished = details.status === 'Expired' || details.status === 'Failed';

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold text-ink-strong">{heading}</h1>
        <VideoStatusBadge status={details.status} />
      </div>
      {isPending(details.status) && (
        <p role="status" className="text-ink-muted">
          {t('admin.videos.pending')}
        </p>
      )}
      {details.failureReason && (
        <div role="alert" className="rounded-md bg-red-950/60 p-4 text-red-100">
          <p className="font-semibold">{t('admin.videos.failure')}</p>
          <p>{details.failureReason}</p>
        </div>
      )}
      {unfinished && <p className="text-ink-muted">{t('admin.videos.reupload')}</p>}
      <section className="flex flex-col gap-4 rounded-lg bg-surface p-6">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Fact label={t('admin.videos.content')}>
            <ContentName kind={details.contentKind} id={details.contentId} />
          </Fact>
          <Fact label={t('admin.videos.added')}>{dateTime(details.createdAt)}</Fact>
          <Fact label={t('admin.videos.duration')}>{duration(details.durationSeconds)}</Fact>
          <Fact label={t('admin.videos.size')}>{size(details.sizeBytes)}</Fact>
          <Fact label={t('admin.videos.originalAudio')}>
            {languageName(details.originalAudioLanguage, locale)}
          </Fact>
          <Fact label={t('admin.videos.renditions')}>
            {details.renditions.length === 0
              ? '—'
              : [...details.renditions]
                  .sort((left, right) => left.height - right.height)
                  .map((rendition) => `${String(rendition.height)}p`)
                  .join(', ')}
          </Fact>
        </dl>
        {link && (
          <Link to={link} className={`${buttonClass('secondary', 'sm')} self-start`}>
            {t('admin.videos.contentLink')}
          </Link>
        )}
      </section>
      <VideoTracks video={details} />
    </>
  );
}
