import { problemMessageKey } from '@netboxplus/core';
import { SelectField } from '@netboxplus/ui';
import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router';
import { pageOf } from '../components/address-search';
import { buttonClass } from '../components/buttons';
import { Pagination } from '../components/pagination';
import { useVideos, videosPageSize, type VideoPurpose, type VideoStatus } from '../data/videos';
import { useLocale } from '../i18n';
import { paths } from '../paths';
import { ContentName } from './content-name';
import { useDateTime, useDuration, VideoStatusBadge } from './video-format';

const purposes: readonly VideoPurpose[] = ['Feature', 'Trailer'];
const statuses: readonly VideoStatus[] = ['AwaitingUpload', 'Queued', 'Ready', 'Failed', 'Expired'];

/**
 * Every video, newest first, filtered by purpose and status in the address: where to find the uploads
 * that failed or never finished.
 */
export function VideosPage() {
  const { t } = useLocale();
  const [params, setParams] = useSearchParams();
  const purpose = purposes.find((value) => value === params.get('purpose'));
  const status = statuses.find((value) => value === params.get('status'));
  const page = pageOf(params.get('page'));
  const videos = useVideos({ purpose, status, page });
  const duration = useDuration();
  const dateTime = useDateTime();

  useEffect(() => {
    document.title = t('admin.videos.title');
  }, [t]);

  function change(name: string, value: string) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (name !== 'page') {
        next.delete('page');
      }
      if (value) {
        next.set(name, value);
      } else {
        next.delete(name);
      }
      return next;
    });
  }

  return (
    <>
      <h1 className="font-display text-3xl font-bold text-ink-strong">{t('admin.videos.title')}</h1>
      <div className="grid max-w-xl gap-4 sm:grid-cols-2">
        <SelectField
          label={t('admin.videos.purpose')}
          value={purpose ?? ''}
          options={[
            { value: '', label: t('admin.filter.all') },
            ...purposes.map((value) => ({ value, label: t(`admin.videos.purpose.${value}`) })),
          ]}
          onChange={(event) => {
            change('purpose', event.target.value);
          }}
        />
        <SelectField
          label={t('admin.filter.status')}
          value={status ?? ''}
          options={[
            { value: '', label: t('admin.filter.all') },
            ...statuses.map((value) => ({ value, label: t(`admin.videos.status.${value}`) })),
          ]}
          onChange={(event) => {
            change('status', event.target.value);
          }}
        />
      </div>
      {videos.isPending ? (
        <p aria-busy="true" className="text-ink-muted">
          {t('browse.loading')}
        </p>
      ) : videos.isError ? (
        <p role="alert" className="text-ink-muted">
          {t(problemMessageKey(videos.error))}
        </p>
      ) : videos.data.items.length === 0 ? (
        <p className="text-ink-muted">{t('admin.videos.empty')}</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="text-ink-muted">
                <tr className="border-b border-line">
                  {[
                    t('admin.videos.added'),
                    t('admin.videos.purpose'),
                    t('admin.videos.content'),
                    t('admin.content.status'),
                    t('admin.videos.duration'),
                  ].map((header) => (
                    <th key={header} scope="col" className="px-4 py-3 font-normal">
                      {header}
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-3 font-normal">
                    <span className="sr-only">{t('admin.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {videos.data.items.map((video) => (
                  <tr key={video.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">{dateTime(video.createdAt)}</td>
                    <td className="px-4 py-3">{t(`admin.videos.purpose.${video.purpose}`)}</td>
                    <td className="px-4 py-3">
                      <ContentName kind={video.contentKind} id={video.contentId} />
                    </td>
                    <td className="px-4 py-3">
                      <VideoStatusBadge status={video.status} />
                    </td>
                    <td className="px-4 py-3 tabular-nums">{duration(video.durationSeconds)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={paths.video(video.id)}
                        aria-label={t('admin.videos.openNamed').replace(
                          '{name}',
                          `${t(`admin.videos.kind.${video.contentKind}`)} · ${dateTime(video.createdAt)}`,
                        )}
                        className={buttonClass('ghost', 'sm')}
                      >
                        {t('admin.videos.open')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={videosPageSize}
            total={videos.data.totalCount}
            onPage={(next) => {
              change('page', String(next));
            }}
          />
        </>
      )}
    </>
  );
}
