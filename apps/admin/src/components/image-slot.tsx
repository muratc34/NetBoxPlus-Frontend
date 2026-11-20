import { problemMessageKey } from '@netboxplus/core';
import { classNames, FormAlert } from '@netboxplus/ui';
import { useId, useRef, useState } from 'react';
import { ImageRejected, imageTypes } from '../data/images';
import { useLocale } from '../i18n';
import { buttonClass } from './buttons';

export interface ImageSlotLabels {
  readonly heading: string;
  readonly none: string;
  readonly upload: string;
  readonly replace: string;
  readonly remove: string;
  /** What the slot takes: types, pixels, size. */
  readonly hint: string;
}

/**
 * One image of a record (a person's photo, a title's poster or backdrop): shown, replaced by a new file
 * with how far the upload is, or removed. `removeBlocked` says why it cannot be removed now, instead of
 * the button. Without `writable` it is only shown.
 */
export function ImageSlot({
  labels,
  headingLevel = 3,
  className,
  imageUrl,
  alt,
  imageClassName,
  writable,
  removeBlocked,
  onUpload,
  onRemove,
}: Readonly<{
  labels: ImageSlotLabels;
  headingLevel?: 2 | 3;
  className?: string;
  imageUrl: string | null;
  alt: string;
  imageClassName: string;
  writable: boolean;
  removeBlocked?: string | undefined;
  onUpload: (file: File, onProgress: (fraction: number) => void) => Promise<void>;
  onRemove: () => Promise<void>;
}>) {
  const { t } = useLocale();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null);
  const [progress, setProgress] = useState<number | undefined>(undefined);
  const [failure, setFailure] = useState<unknown>(null);
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const message =
    failure instanceof ImageRejected
      ? t(failure.reason === 'type' ? 'admin.image.type' : 'admin.image.size')
      : failure
        ? t(problemMessageKey(failure))
        : undefined;

  async function run(kind: 'upload' | 'remove', action: () => Promise<void>) {
    setFailure(null);
    setBusy(kind);
    try {
      await action();
    } catch (error) {
      setFailure(error);
    } finally {
      setBusy(null);
      setProgress(undefined);
      if (input.current) {
        input.current.value = '';
      }
    }
  }

  return (
    <section aria-labelledby={`${id}-heading`} className={classNames('flex flex-col gap-4', className)}>
      <Heading
        id={`${id}-heading`}
        className={classNames(
          'font-display font-bold text-ink-strong',
          headingLevel === 2 ? 'text-xl' : 'text-lg',
        )}
      >
        {labels.heading}
      </Heading>
      {imageUrl ? (
        <img src={imageUrl} alt={alt} className={classNames('rounded-lg object-cover', imageClassName)} />
      ) : (
        <p className="text-ink-muted">{labels.none}</p>
      )}
      {message && <FormAlert tone="error">{message}</FormAlert>}
      {busy === 'upload' && progress !== undefined && (
        <p role="status" className="text-sm text-ink-muted">
          {t('admin.image.uploading').replace('{percent}', String(Math.round(progress * 100)))}
        </p>
      )}
      {writable && (
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={input}
            id={`${id}-file`}
            type="file"
            accept={imageTypes.join(',')}
            aria-describedby={`${id}-hint`}
            className="peer sr-only"
            disabled={busy !== null}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                setProgress(0);
                void run('upload', () => onUpload(file, setProgress));
              }
            }}
          />
          {/* The input is hidden for its label, which looks like a button and shows the input's focus. */}
          <label
            htmlFor={`${id}-file`}
            className={classNames(
              buttonClass('secondary'),
              'cursor-pointer peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
            )}
          >
            {imageUrl ? labels.replace : labels.upload}
          </label>
          {imageUrl && !removeBlocked && (
            <button
              type="button"
              className={buttonClass('ghost')}
              disabled={busy !== null}
              onClick={() => {
                void run('remove', onRemove);
              }}
            >
              {labels.remove}
            </button>
          )}
          <p id={`${id}-hint`} className="w-full text-sm text-ink-muted">
            {labels.hint}
          </p>
          {imageUrl && removeBlocked && <p className="w-full text-sm text-ink-muted">{removeBlocked}</p>}
        </div>
      )}
    </section>
  );
}
