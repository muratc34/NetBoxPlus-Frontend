import { zodResolver } from '@hookform/resolvers/zod';
import { problemMessageKey } from '@netboxplus/core';
import { FormAlert, TextField } from '@netboxplus/ui';
import * as Dialog from '@radix-ui/react-dialog';
import { useId, useState, type ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { z } from 'zod';
import { buttonClass } from '../components/buttons';
import { ConfirmDialog } from '../components/confirm-dialog';
import { messageOf, showProblem } from '../components/form-errors';
import { StatusBadge } from '../components/status-badge';
import {
  usePublishEpisode,
  useRemoveEpisode,
  useRemoveSeason,
  useSaveEpisode,
  useSaveSeason,
  type EpisodeResponse,
  type SeasonDetails,
  type SeriesDetails,
} from '../data/series';
import { can, useAdminSession } from '../data/session';
import { useLocale } from '../i18n';
import { textsOf, TextsFields, translationsOf, translationsSchema, wholeNumber } from './content-form';
import { versioned } from './title-sections';

const byNumber = <T extends { number: number }>(items: readonly T[]) =>
  [...items].sort((left, right) => left.number - right.number);

const nextNumber = (items: readonly { number: number }[]) =>
  items.reduce((highest, item) => Math.max(highest, item.number), 0) + 1;

interface Versioning {
  readonly version: number;
  readonly onChanged: () => void;
  readonly onConflict: () => void;
}

/**
 * The seasons in order, each with its episodes. Every change carries the series' version and moves the
 * editor on by one: seasons and episodes are part of the series.
 */
export function SeasonsEditor({
  series,
  version,
  onChanged,
  onConflict,
}: Readonly<{ series: SeriesDetails } & Versioning>) {
  const { t } = useLocale();
  const id = useId();
  const session = useAdminSession();
  const writable = can(session.data, 'catalog:series:write');
  const [adding, setAdding] = useState(false);
  const versioning = { version, onChanged, onConflict };
  const seasons = byNumber(series.seasons);
  const publishedCount = series.seasons.reduce(
    (count, season) => count + season.episodes.filter((episode) => episode.status === 'Published').length,
    0,
  );

  return (
    <section aria-labelledby={id} className="flex flex-col gap-6 rounded-lg bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={id} className="font-display text-xl font-bold text-ink-strong">
          {t('admin.seasons.title')}
        </h2>
        {writable && (
          <button
            type="button"
            className={buttonClass('secondary', 'sm')}
            onClick={() => {
              setAdding(true);
            }}
          >
            {t('admin.seasons.add')}
          </button>
        )}
      </div>
      {series.status === 'Draft' && seasons.length > 0 && (
        <p className="text-sm text-ink-muted">{t('admin.episodes.draftSeries')}</p>
      )}
      {seasons.length === 0 ? (
        <p className="text-ink-muted">{t('admin.seasons.empty')}</p>
      ) : (
        seasons.map((season) => (
          <SeasonBlock
            key={season.id}
            series={series}
            season={season}
            lastPublished={series.status === 'Published' && publishedCount === 1}
            {...versioning}
          />
        ))
      )}
      {adding && (
        <SeasonDialog
          series={series}
          number={nextNumber(series.seasons)}
          onClose={() => {
            setAdding(false);
          }}
          {...versioning}
        />
      )}
    </section>
  );
}

function seasonName(t: (key: 'title.seasonNumber') => string, season: SeasonDetails) {
  const numbered = t('title.seasonNumber').replace('{number}', String(season.number));
  return season.title ? `${numbered}: ${season.title}` : numbered;
}

function SeasonBlock({
  series,
  season,
  lastPublished,
  ...versioning
}: Readonly<{ series: SeriesDetails; season: SeasonDetails; lastPublished: boolean } & Versioning>) {
  const { t } = useLocale();
  const id = useId();
  const session = useAdminSession();
  const writable = can(session.data, 'catalog:series:write');
  const publishable = can(session.data, 'catalog:series:publish');
  const remove = useRemoveSeason(series.id);
  const publish = usePublishEpisode(series.id);
  const [editing, setEditing] = useState<EpisodeResponse | 'new' | 'season' | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [removingEpisode, setRemovingEpisode] = useState<EpisodeResponse | null>(null);
  const name = seasonName(t, season);
  const episodes = byNumber(season.episodes);
  const hasPublished = season.episodes.some((episode) => episode.status === 'Published');

  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 border-t border-line pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id={id} className="font-display text-lg font-bold text-ink-strong">
          {name}
        </h3>
        {writable && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={buttonClass('secondary', 'sm')}
              aria-label={t('admin.episodes.addTo').replace('{season}', name)}
              onClick={() => {
                setEditing('new');
              }}
            >
              {t('admin.episodes.add')}
            </button>
            <button
              type="button"
              className={buttonClass('ghost', 'sm')}
              aria-label={t('admin.editNamed').replace('{name}', name)}
              onClick={() => {
                setEditing('season');
              }}
            >
              {t('admin.edit')}
            </button>
            <button
              type="button"
              className={buttonClass('ghost', 'sm')}
              aria-label={t('admin.deleteNamed').replace('{name}', name)}
              disabled={hasPublished}
              aria-describedby={hasPublished ? `${id}-kept` : undefined}
              onClick={() => {
                remove.reset();
                setDeleting(true);
              }}
            >
              {t('admin.delete')}
            </button>
          </div>
        )}
      </div>
      {writable && hasPublished && (
        <p id={`${id}-kept`} className="text-sm text-ink-muted">
          {t('admin.seasons.hasPublished')}
        </p>
      )}
      {publish.isError && <FormAlert tone="error">{t(problemMessageKey(publish.error))}</FormAlert>}
      {episodes.length === 0 ? (
        <p className="text-ink-muted">{t('admin.episodes.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-ink-muted">
              <tr className="border-b border-line">
                <th scope="col" className="py-2 pr-4 font-normal">
                  {t('admin.episodes.numberColumn')}
                </th>
                <th scope="col" className="py-2 pr-4 font-normal">
                  {t('admin.content.title')}
                </th>
                <th scope="col" className="py-2 pr-4 font-normal">
                  {t('admin.content.runtime')}
                </th>
                <th scope="col" className="py-2 pr-4 font-normal">
                  {t('admin.content.status')}
                </th>
                <th scope="col" className="py-2 pr-4 font-normal">
                  {t('admin.episodes.video')}
                </th>
                {(writable || publishable) && (
                  <th scope="col" className="py-2 font-normal">
                    <span className="sr-only">{t('admin.actions')}</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {episodes.map((episode) => (
                <EpisodeRow
                  key={episode.id}
                  episode={episode}
                  writable={writable}
                  publishable={publishable}
                  kept={lastPublished}
                  busy={publish.isPending}
                  onEdit={() => {
                    setEditing(episode);
                  }}
                  onRemove={() => {
                    setRemovingEpisode(episode);
                  }}
                  onPublish={(value) => {
                    publish.reset();
                    void versioned(
                      publish.mutateAsync({
                        episodeId: episode.id,
                        publish: value,
                        version: versioning.version,
                      }),
                      versioning.onChanged,
                      versioning.onConflict,
                    ).catch(() => undefined);
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing === 'season' && (
        <SeasonDialog
          series={series}
          season={season}
          number={season.number}
          onClose={() => {
            setEditing(null);
          }}
          {...versioning}
        />
      )}
      {(editing === 'new' || (editing !== null && typeof editing === 'object')) && (
        <EpisodeDialog
          seriesId={series.id}
          season={season}
          episode={editing === 'new' ? undefined : editing}
          onClose={() => {
            setEditing(null);
          }}
          {...versioning}
        />
      )}
      <ConfirmDialog
        open={deleting}
        title={t('admin.movies.deleteTitle').replace('{name}', name)}
        body={t('admin.seasons.deleteBody')}
        confirmLabel={t('admin.delete')}
        busy={remove.isPending}
        error={remove.isError ? t(problemMessageKey(remove.error)) : undefined}
        onConfirm={() => {
          void versioned(
            remove.mutateAsync({ seasonId: season.id, version: versioning.version }),
            versioning.onChanged,
            versioning.onConflict,
          )
            .then(() => {
              setDeleting(false);
            })
            .catch(() => undefined);
        }}
        onOpenChange={setDeleting}
      />
      {removingEpisode && (
        <EpisodeDeletion
          seriesId={series.id}
          episode={removingEpisode}
          onClose={() => {
            setRemovingEpisode(null);
          }}
          {...versioning}
        />
      )}
    </section>
  );
}

function EpisodeRow({
  episode,
  writable,
  publishable,
  kept,
  busy,
  onEdit,
  onRemove,
  onPublish,
}: Readonly<{
  episode: EpisodeResponse;
  writable: boolean;
  publishable: boolean;
  kept: boolean;
  busy: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onPublish: (publish: boolean) => void;
}>) {
  const { t } = useLocale();
  const id = useId();
  const published = episode.status === 'Published';
  const name = `${String(episode.number)}. ${episode.title}`;
  const publishBlocked = !published && !episode.hasPlayableVideo;
  const unpublishBlocked = published && kept;
  const reason = publishBlocked
    ? t('admin.episodes.noVideo')
    : unpublishBlocked
      ? t('admin.episodes.lastPublished')
      : null;

  return (
    <tr className="border-b border-line last:border-0">
      <td className="py-2 pr-4 tabular-nums">{episode.number}</td>
      <td className="py-2 pr-4 font-semibold text-ink-strong">{episode.title}</td>
      <td className="py-2 pr-4 tabular-nums">{episode.runtimeMinutes}</td>
      <td className="py-2 pr-4">
        <StatusBadge status={episode.status} />
      </td>
      <td className="py-2 pr-4">{t(`admin.video.${episode.videoStatus}`)}</td>
      {(writable || publishable) && (
        <td className="py-2">
          <div className="flex flex-wrap justify-end gap-2">
            {publishable && (
              <button
                type="button"
                className={buttonClass(published ? 'ghost' : 'secondary', 'sm')}
                aria-label={t(published ? 'admin.episodes.unpublish' : 'admin.episodes.publish').replace(
                  '{name}',
                  name,
                )}
                disabled={busy || publishBlocked || unpublishBlocked}
                aria-describedby={reason ? `${id}-reason` : undefined}
                onClick={() => {
                  onPublish(!published);
                }}
              >
                {t(published ? 'admin.publish.unpublish' : 'admin.publish.publish')}
              </button>
            )}
            {writable && (
              <>
                <button
                  type="button"
                  className={buttonClass('secondary', 'sm')}
                  aria-label={t('admin.editNamed').replace('{name}', name)}
                  onClick={onEdit}
                >
                  {t('admin.edit')}
                </button>
                <button
                  type="button"
                  className={buttonClass('ghost', 'sm')}
                  aria-label={t('admin.deleteNamed').replace('{name}', name)}
                  disabled={published}
                  onClick={onRemove}
                >
                  {t('admin.delete')}
                </button>
              </>
            )}
          </div>
          {publishable && reason && (
            <p id={`${id}-reason`} className="mt-1 text-right text-xs text-ink-muted">
              {reason}
            </p>
          )}
        </td>
      )}
    </tr>
  );
}

function EpisodeDeletion({
  seriesId,
  episode,
  onClose,
  ...versioning
}: Readonly<{ seriesId: string; episode: EpisodeResponse; onClose: () => void } & Versioning>) {
  const { t } = useLocale();
  const remove = useRemoveEpisode(seriesId);
  return (
    <ConfirmDialog
      open
      title={t('admin.movies.deleteTitle').replace('{name}', `${String(episode.number)}. ${episode.title}`)}
      body={t('admin.episodes.deleteBody')}
      confirmLabel={t('admin.delete')}
      busy={remove.isPending}
      error={remove.isError ? t(problemMessageKey(remove.error)) : undefined}
      onConfirm={() => {
        void versioned(
          remove.mutateAsync({ episodeId: episode.id, version: versioning.version }),
          versioning.onChanged,
          versioning.onConflict,
        )
          .then(onClose)
          .catch(() => undefined);
      }}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    />
  );
}

/** A dialog holding one small form. */
function FormDialog({
  title,
  onClose,
  children,
}: Readonly<{ title: string; onClose: () => void; children: ReactNode }>) {
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/75" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-lg bg-surface p-6 shadow-xl"
        >
          <Dialog.Title className="font-display text-xl font-bold text-ink-strong">{title}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DialogButtons({ busy }: Readonly<{ busy: boolean }>) {
  const { t } = useLocale();
  return (
    <div className="flex flex-wrap gap-3">
      <button type="submit" className={buttonClass('primary')} disabled={busy}>
        {busy ? t('auth.working') : t('admin.save')}
      </button>
      <Dialog.Close asChild>
        <button type="button" className={buttonClass('ghost')}>
          {t('admin.cancel')}
        </button>
      </Dialog.Close>
    </div>
  );
}

const seasonSchema = z.object({
  number: wholeNumber(1, 1000, 'error.Series.SeasonNumberOutOfRange'),
  names: z.object({
    tr: z.string().trim().max(200, 'error.Series.SeasonTitleTooLong'),
    en: z.string().trim().max(200, 'error.Series.SeasonTitleTooLong'),
  }),
});
type SeasonValues = z.infer<typeof seasonSchema>;

/** Adds a season (number, an optional name per language) or changes one. */
function SeasonDialog({
  series,
  season,
  number,
  onClose,
  ...versioning
}: Readonly<
  { series: SeriesDetails; season?: SeasonDetails; number: number; onClose: () => void } & Versioning
>) {
  const { t } = useLocale();
  const save = useSaveSeason(series.id);
  const form = useForm<SeasonValues>({
    resolver: zodResolver(seasonSchema),
    defaultValues: {
      number: String(number),
      names: { tr: season?.translations.tr ?? '', en: season?.translations.en ?? '' },
    },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    const names = Object.fromEntries(Object.entries(values.names).filter(([, name]) => name !== ''));
    try {
      await versioned(
        save.mutateAsync({
          ...(season ? { seasonId: season.id } : {}),
          body: { number: Number(values.number), translations: names, version: versioning.version },
        }),
        versioning.onChanged,
        versioning.onConflict,
      );
      onClose();
    } catch (error) {
      showProblem(error, ['number'], form.setError, {
        'Series.SeasonNumberTaken': 'number',
        'Series.SeasonNumberOutOfRange': 'number',
        'Series.SeasonTitleTooLong': 'names.tr',
      });
    }
  });

  return (
    <FormDialog title={season ? t('admin.seasons.edit') : t('admin.seasons.add')} onClose={onClose}>
      <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
        {errors.root && <FormAlert tone="error">{messageOf(t, errors.root.message)}</FormAlert>}
        <TextField
          label={t('admin.seasons.number')}
          inputMode="numeric"
          error={messageOf(t, errors.number?.message)}
          {...form.register('number')}
        />
        <TextField
          label={`${t('admin.seasons.name')} (${t('admin.content.turkish')})`}
          lang="tr"
          hint={t('admin.seasons.nameHint')}
          error={messageOf(t, errors.names?.tr?.message)}
          {...form.register('names.tr')}
        />
        <TextField
          label={`${t('admin.seasons.name')} (${t('admin.content.english')})`}
          lang="en"
          hint={t('admin.seasons.nameHint')}
          error={messageOf(t, errors.names?.en?.message)}
          {...form.register('names.en')}
        />
        <DialogButtons busy={isSubmitting} />
      </form>
    </FormDialog>
  );
}

const episodeSchema = z.object({
  number: wholeNumber(1, 10000, 'error.Series.EpisodeNumberOutOfRange'),
  translations: translationsSchema,
  runtimeMinutes: wholeNumber(1, 1000, 'error.Content.RuntimeOutOfRange'),
});
type EpisodeValues = z.infer<typeof episodeSchema>;

/** Adds an episode to the season or changes one: number, texts per language, runtime. */
function EpisodeDialog({
  seriesId,
  season,
  episode,
  onClose,
  ...versioning
}: Readonly<
  {
    seriesId: string;
    season: SeasonDetails;
    episode: EpisodeResponse | undefined;
    onClose: () => void;
  } & Versioning
>) {
  const { t } = useLocale();
  const save = useSaveEpisode(seriesId);
  const form = useForm<EpisodeValues>({
    resolver: zodResolver(episodeSchema),
    defaultValues: {
      number: String(episode?.number ?? nextNumber(season.episodes)),
      translations: textsOf(episode?.translations),
      runtimeMinutes: episode ? String(episode.runtimeMinutes) : '',
    },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    try {
      await versioned(
        save.mutateAsync({
          seasonId: season.id,
          ...(episode ? { episodeId: episode.id } : {}),
          body: {
            number: Number(values.number),
            translations: translationsOf(values.translations),
            runtimeMinutes: Number(values.runtimeMinutes),
            version: versioning.version,
          },
        }),
        versioning.onChanged,
        versioning.onConflict,
      );
      onClose();
    } catch (error) {
      showProblem(
        error,
        [
          'number',
          'translations.tr.title',
          'translations.tr.synopsis',
          'translations.en.title',
          'translations.en.synopsis',
          'runtimeMinutes',
        ],
        form.setError,
        {
          'Series.EpisodeNumberTaken': 'number',
          'Series.EpisodeNumberOutOfRange': 'number',
          'Content.DefaultLanguageRequired': 'translations.tr.title',
        },
      );
    }
  });

  return (
    <FormDialog title={episode ? t('admin.episodes.edit') : t('admin.episodes.add')} onClose={onClose}>
      <FormProvider {...form}>
        <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
          {errors.root && <FormAlert tone="error">{messageOf(t, errors.root.message)}</FormAlert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t('admin.episodes.number')}
              inputMode="numeric"
              error={messageOf(t, errors.number?.message)}
              {...form.register('number')}
            />
            <TextField
              label={t('admin.content.runtime')}
              inputMode="numeric"
              error={messageOf(t, errors.runtimeMinutes?.message)}
              {...form.register('runtimeMinutes')}
            />
          </div>
          <TextsFields />
          <DialogButtons busy={isSubmitting} />
        </form>
      </FormProvider>
    </FormDialog>
  );
}
