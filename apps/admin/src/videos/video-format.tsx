import { classNames } from '@netboxplus/ui';
import type { VideoStatus } from '../data/videos';
import { useLocale } from '../i18n';

/** "1 dk 30 sn" from seconds; a dash when not known yet. */
export function useDuration() {
  const { t } = useLocale();
  return (seconds: number | null) => {
    if (seconds === null) {
      return '—';
    }
    const whole = Math.round(seconds);
    return t('admin.videos.minutes')
      .replace('{minutes}', String(Math.floor(whole / 60)))
      .replace('{seconds}', String(whole % 60));
  };
}

/** A date and time in the panel's language. */
export function useDateTime() {
  const { locale } = useLocale();
  return (value: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

/** A size in megabytes or gigabytes. */
export function useSize() {
  const { locale } = useLocale();
  return (bytes: number | null) => {
    if (bytes === null) {
      return '—';
    }
    const gigabytes = bytes / 1024 ** 3;
    return gigabytes >= 1
      ? new Intl.NumberFormat(locale, { style: 'unit', unit: 'gigabyte', maximumFractionDigits: 1 }).format(
          gigabytes,
        )
      : new Intl.NumberFormat(locale, { style: 'unit', unit: 'megabyte', maximumFractionDigits: 1 }).format(
          bytes / 1024 ** 2,
        );
  };
}

const tones: Record<VideoStatus, string> = {
  AwaitingUpload: 'bg-white/10 text-ink',
  Queued: 'bg-sky-900/70 text-sky-100',
  Ready: 'bg-emerald-900/70 text-emerald-100',
  Failed: 'bg-red-900/70 text-red-100',
  Expired: 'bg-white/10 text-ink-muted',
};

/** Where the video is, in words (the colour only repeats them). */
export function VideoStatusBadge({ status }: Readonly<{ status: VideoStatus }>) {
  const { t } = useLocale();
  return (
    <span
      className={classNames('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold', tones[status])}
    >
      {t(`admin.videos.status.${status}`)}
    </span>
  );
}
