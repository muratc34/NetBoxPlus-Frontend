import { problemMessageKey } from '@netboxplus/core';
import { classNames } from '@netboxplus/ui';
import { useId, useState } from 'react';
import { Link } from 'react-router';
import { buttonClass } from '../components/buttons';
import { can, useAdminSession } from '../data/session';
import { useContentVideos, type ContentKind, type VideoPurpose } from '../data/videos';
import { useLocale } from '../i18n';
import { paths } from '../paths';
import { useDateTime, useDuration, VideoStatusBadge } from './video-format';
import { VideoUploader } from './video-uploader';

/**
 * The videos of one movie, episode or series, newest first, each linking to its page; with the write
 * permission, uploading one of the purposes it takes. Shown only with the read permission.
 */
export function ContentVideos({
  contentKind,
  contentId,
  purposes,
  headingLevel = 2,
  className,
}: Readonly<{
  contentKind: ContentKind;
  contentId: string;
  purposes: readonly VideoPurpose[];
  headingLevel?: 2 | 3;
  className?: string;
}>) {
  const { t } = useLocale();
  const id = useId();
  const session = useAdminSession();
  const videos = useContentVideos(contentId);
  const duration = useDuration();
  const dateTime = useDateTime();
  const [uploading, setUploading] = useState<VideoPurpose | null>(null);
  const Heading = headingLevel === 2 ? 'h2' : 'h3';

  if (!can(session.data, 'streaming:videos:read')) {
    return null;
  }
  const writable = can(session.data, 'streaming:videos:write');
  const items = [...(videos.data?.items ?? [])].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );

  return (
    <section aria-labelledby={id} className={classNames('flex flex-col gap-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Heading id={id} className="font-display text-xl font-bold text-ink-strong">
          {t('admin.videos.section')}
        </Heading>
        {writable && uploading === null && (
          <div className="flex flex-wrap gap-2">
            {purposes.map((purpose) => (
              <button
                key={purpose}
                type="button"
                className={buttonClass('secondary', 'sm')}
                onClick={() => {
                  setUploading(purpose);
                }}
              >
                {purpose === 'Trailer' ? t('admin.videos.uploadTrailer') : t('admin.videos.upload')}
              </button>
            ))}
          </div>
        )}
      </div>
      {uploading !== null && (
        <VideoUploader
          contentKind={contentKind}
          contentId={contentId}
          purpose={uploading}
          onCancel={() => {
            setUploading(null);
          }}
        />
      )}
      {videos.isPending ? (
        <p aria-busy="true" className="text-ink-muted">
          {t('browse.loading')}
        </p>
      ) : videos.isError ? (
        <p role="alert" className="text-ink-muted">
          {t(problemMessageKey(videos.error))}
        </p>
      ) : items.length === 0 ? (
        <p className="text-ink-muted">{t('admin.videos.none')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-ink-muted">
              <tr className="border-b border-line">
                {[
                  t('admin.videos.purpose'),
                  t('admin.content.status'),
                  t('admin.videos.duration'),
                  t('admin.videos.added'),
                ].map((header) => (
                  <th key={header} scope="col" className="py-2 pr-4 font-normal">
                    {header}
                  </th>
                ))}
                <th scope="col" className="py-2 font-normal">
                  <span className="sr-only">{t('admin.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((video) => {
                const name = `${t(`admin.videos.purpose.${video.purpose}`)} · ${dateTime(video.createdAt)}`;
                return (
                  <tr key={video.id} className="border-b border-line last:border-0">
                    <td className="py-2 pr-4">{t(`admin.videos.purpose.${video.purpose}`)}</td>
                    <td className="py-2 pr-4">
                      <VideoStatusBadge status={video.status} />
                    </td>
                    <td className="py-2 pr-4 tabular-nums">{duration(video.durationSeconds)}</td>
                    <td className="py-2 pr-4">{dateTime(video.createdAt)}</td>
                    <td className="py-2 text-right">
                      <Link
                        to={paths.video(video.id)}
                        aria-label={t('admin.videos.openNamed').replace('{name}', name)}
                        className={buttonClass('ghost', 'sm')}
                      >
                        {t('admin.videos.open')}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
