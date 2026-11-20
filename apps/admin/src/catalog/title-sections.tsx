import { isApiError } from '@netboxplus/api';
import { problemMessageKey } from '@netboxplus/core';
import type { MessageKey } from '@netboxplus/i18n';
import { FormAlert } from '@netboxplus/ui';
import { useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { buttonClass } from '../components/buttons';
import { ConfirmDialog } from '../components/confirm-dialog';
import { ImageSlot } from '../components/image-slot';
import { StatusBadge } from '../components/status-badge';
import type { PublicationStatus } from '../data/movies';
import { can, useAdminSession } from '../data/session';
import {
  useAttachTitleImage,
  useDeleteTitle,
  usePublishTitle,
  useRemoveTitleImage,
  type ImageSlotName,
  type TitleKind,
} from '../data/titles';
import { useLocale } from '../i18n';
import { paths } from '../paths';

/** What the sections read of a title, whichever kind it is. */
export interface TitleCore {
  readonly id: string;
  readonly title: string;
  readonly status: PublicationStatus;
  readonly publishedAt: string | null;
  readonly posterUrl: string | null;
  readonly backdropUrl: string | null;
}

/** The words that name the kind of title. */
const words: Record<
  TitleKind,
  {
    readonly permission: string;
    readonly list: string;
    readonly posterKept: MessageKey;
    readonly unpublishBody: MessageKey;
    readonly deletePublished: MessageKey;
    readonly deleteTitle: MessageKey;
    readonly deleteBody: MessageKey;
  }
> = {
  movie: {
    permission: 'catalog:movies',
    list: paths.movies,
    posterKept: 'admin.images.posterKept',
    unpublishBody: 'admin.publish.unpublishBody',
    deletePublished: 'admin.movies.deletePublished',
    deleteTitle: 'admin.movies.deleteTitle',
    deleteBody: 'admin.movies.deleteBody',
  },
  series: {
    permission: 'catalog:series',
    list: paths.series,
    posterKept: 'admin.series.posterKept',
    unpublishBody: 'admin.series.unpublishBody',
    deletePublished: 'admin.series.deletePublished',
    deleteTitle: 'admin.series.deleteTitle',
    deleteBody: 'admin.series.deleteBody',
  },
};

/** The permission `catalog:<kind>:<action>` for the kind of title. */
export function titlePermission(kind: TitleKind, action: 'read' | 'write' | 'publish' | 'delete'): string {
  return `${words[kind].permission}:${action}`;
}

export const isConflict = (error: unknown) => isApiError(error) && error.code === 'Content.VersionConflict';

/** Someone else saved first: the editor's changes stay until it loads the current version. */
export function ConflictNotice({ onReload }: Readonly<{ onReload: () => Promise<void> }>) {
  const { t } = useLocale();
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-md bg-amber-950/70 p-4 text-amber-100"
    >
      <p>{t('admin.conflict.message')}</p>
      <button
        type="button"
        className={buttonClass('secondary', 'sm')}
        onClick={() => {
          void onReload();
        }}
      >
        {t('admin.conflict.reload')}
      </button>
    </div>
  );
}

/**
 * Runs a change that carries the editor's version: on success the editor moves on by one, on a conflict
 * it says so; the error still reaches the caller.
 */
export async function versioned(action: Promise<unknown>, onChanged: () => void, onConflict: () => void) {
  try {
    await action;
    onChanged();
  } catch (error) {
    if (isConflict(error)) {
      onConflict();
    }
    throw error;
  }
}

/** The poster and the backdrop; each change carries the editor's version and moves it on. */
export function TitleImages({
  kind,
  title,
  version,
  onChanged,
  onConflict,
}: Readonly<{
  kind: TitleKind;
  title: TitleCore;
  version: number;
  onChanged: () => void;
  onConflict: () => void;
}>) {
  const { t } = useLocale();
  const id = useId();
  const session = useAdminSession();
  const writable =
    can(session.data, titlePermission(kind, 'write')) && can(session.data, 'catalog:images:upload');
  const poster = useImageActions(kind, title.id, 'poster', version, onChanged, onConflict);
  const backdrop = useImageActions(kind, title.id, 'backdrop', version, onChanged, onConflict);

  return (
    <section aria-labelledby={id} className="flex flex-col gap-6 rounded-lg bg-surface p-6">
      <h2 id={id} className="font-display text-xl font-bold text-ink-strong">
        {t('admin.images.title')}
      </h2>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <ImageSlot
          labels={{
            heading: t('admin.images.poster'),
            none: t('admin.images.noPoster'),
            upload: t('admin.images.uploadPoster'),
            replace: t('admin.images.replacePoster'),
            remove: t('admin.images.removePoster'),
            hint: t('admin.images.posterHint'),
          }}
          imageUrl={title.posterUrl}
          alt={`${title.title}: ${t('admin.images.poster')}`}
          imageClassName="aspect-[2/3] w-40"
          writable={writable}
          removeBlocked={title.status === 'Published' ? t(words[kind].posterKept) : undefined}
          {...poster}
        />
        <ImageSlot
          labels={{
            heading: t('admin.images.backdrop'),
            none: t('admin.images.noBackdrop'),
            upload: t('admin.images.uploadBackdrop'),
            replace: t('admin.images.replaceBackdrop'),
            remove: t('admin.images.removeBackdrop'),
            hint: t('admin.images.backdropHint'),
          }}
          imageUrl={title.backdropUrl}
          alt={`${title.title}: ${t('admin.images.backdrop')}`}
          imageClassName="aspect-video w-full max-w-md"
          writable={writable}
          {...backdrop}
        />
      </div>
    </section>
  );
}

function useImageActions(
  kind: TitleKind,
  id: string,
  slot: ImageSlotName,
  version: number,
  onChanged: () => void,
  onConflict: () => void,
) {
  const attach = useAttachTitleImage(kind, id, slot);
  const remove = useRemoveTitleImage(kind, id, slot);
  return {
    onUpload: (file: File, onProgress: (fraction: number) => void) =>
      versioned(attach.mutateAsync({ file, version, onProgress }), onChanged, onConflict),
    onRemove: () => versioned(remove.mutateAsync(version), onChanged, onConflict),
  };
}

export interface PublishNeed {
  readonly label: string;
  readonly met: boolean;
}

/**
 * Whether the title is out, what it still needs and the switch. It publishes what is stored, so changes
 * not saved keep it closed.
 */
export function TitlePublication({
  kind,
  title,
  needs,
  unsaved,
  version,
  onVersion,
}: Readonly<{
  kind: TitleKind;
  title: TitleCore;
  needs: readonly PublishNeed[];
  unsaved: boolean;
  version: number;
  onVersion: (before: number, after: number) => void;
}>) {
  const { locale, t } = useLocale();
  const id = useId();
  const session = useAdminSession();
  const allowed = can(session.data, titlePermission(kind, 'publish'));
  const publication = usePublishTitle(kind, title.id);
  const [asking, setAsking] = useState(false);
  const published = title.status === 'Published';
  const ready = needs.every((need) => need.met);

  function change(publish: boolean) {
    const before = version;
    publication.mutate(publish, {
      onSuccess: (after) => {
        onVersion(before, after);
        setAsking(false);
      },
    });
  }

  return (
    <section aria-labelledby={id} className="flex flex-col items-start gap-4 rounded-lg bg-surface p-6">
      <h2 id={id} className="font-display text-xl font-bold text-ink-strong">
        {t('admin.publish.title')}
      </h2>
      <p className="flex flex-wrap items-center gap-2">
        <StatusBadge status={title.status} />
        {title.publishedAt && (
          <span className="text-sm text-ink-muted">
            {t('admin.publish.publishedAt').replace(
              '{date}',
              new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(title.publishedAt)),
            )}
          </span>
        )}
      </p>
      {!published && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-ink-strong">{t('admin.publish.needs')}</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {needs.map((need) => (
              <li key={need.label} className={need.met ? 'text-ink' : 'text-amber-200'}>
                <span aria-hidden="true">{need.met ? '✓ ' : '✗ '}</span>
                {need.label}: {t(need.met ? 'admin.publish.done' : 'admin.publish.missing')}
              </li>
            ))}
          </ul>
        </div>
      )}
      {publication.isError && !asking && (
        <FormAlert tone="error">{t(problemMessageKey(publication.error))}</FormAlert>
      )}
      {allowed && !published && (
        <>
          <button
            type="button"
            className={buttonClass('primary')}
            disabled={!ready || unsaved || publication.isPending}
            aria-describedby={!ready || unsaved ? `${id}-blocked` : undefined}
            onClick={() => {
              change(true);
            }}
          >
            {publication.isPending ? t('auth.working') : t('admin.publish.publish')}
          </button>
          {(!ready || unsaved) && (
            <p id={`${id}-blocked`} className="text-sm text-ink-muted">
              {t(unsaved ? 'admin.publish.saveFirst' : 'admin.publish.notReady')}
            </p>
          )}
        </>
      )}
      {allowed && published && (
        <>
          <button
            type="button"
            className={buttonClass('danger')}
            onClick={() => {
              setAsking(true);
            }}
          >
            {t('admin.publish.unpublish')}
          </button>
          <ConfirmDialog
            open={asking}
            title={t('admin.publish.unpublishTitle').replace('{name}', title.title)}
            body={t(words[kind].unpublishBody)}
            confirmLabel={t('admin.publish.unpublish')}
            busy={publication.isPending}
            error={publication.isError ? t(problemMessageKey(publication.error)) : undefined}
            onConfirm={() => {
              change(false);
            }}
            onOpenChange={(open) => {
              setAsking(open);
              if (!open) {
                publication.reset();
              }
            }}
          />
        </>
      )}
    </section>
  );
}

/** Deleting a draft title, after asking; a published one has to be unpublished first. */
export function TitleDeletion({ kind, title }: Readonly<{ kind: TitleKind; title: TitleCore }>) {
  const { t } = useLocale();
  const id = useId();
  const navigate = useNavigate();
  const remove = useDeleteTitle(kind);
  const [asking, setAsking] = useState(false);
  const published = title.status === 'Published';

  return (
    <section aria-labelledby={id} className="flex flex-col items-start gap-3 rounded-lg bg-surface p-6">
      <h2 id={id} className="font-display text-xl font-bold text-ink-strong">
        {t('admin.delete')}
      </h2>
      <button
        type="button"
        className={buttonClass('danger')}
        disabled={published}
        aria-describedby={published ? `${id}-blocked` : undefined}
        onClick={() => {
          remove.reset();
          setAsking(true);
        }}
      >
        {t('admin.deleteNamed').replace('{name}', title.title)}
      </button>
      {published && (
        <p id={`${id}-blocked`} className="text-sm text-ink-muted">
          {t(words[kind].deletePublished)}
        </p>
      )}
      <ConfirmDialog
        open={asking}
        title={t(words[kind].deleteTitle).replace('{name}', title.title)}
        body={t(words[kind].deleteBody)}
        confirmLabel={t('admin.delete')}
        busy={remove.isPending}
        error={remove.isError ? t(problemMessageKey(remove.error)) : undefined}
        onConfirm={() => {
          remove.mutate(title.id, {
            onSuccess: () => {
              setAsking(false);
              void navigate(words[kind].list, { replace: true });
            },
          });
        }}
        onOpenChange={setAsking}
      />
    </section>
  );
}
