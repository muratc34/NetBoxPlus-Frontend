import { zodResolver } from '@hookform/resolvers/zod';
import { problemMessageKey } from '@netboxplus/core';
import { FormAlert, SelectField, TextField } from '@netboxplus/ui';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import { buttonClass } from '../components/buttons';
import { messageOf, showProblem } from '../components/form-errors';
import { StatusBadge } from '../components/status-badge';
import { UnsavedChanges } from '../components/unsaved-changes';
import { ageRatings } from '../data/movies';
import { useSaveSeries, useSeries, type SeriesDetails, type SeriesRequest } from '../data/series';
import { can, useAdminSession } from '../data/session';
import { useLocale } from '../i18n';
import { paths } from '../paths';
import {
  creditInputs,
  creditsOf,
  creditsSchema,
  CreditsEditor,
  GenresField,
  seriesRoles,
  textsOf,
  TextsFields,
  translationsOf,
  translationsSchema,
  wholeNumber,
} from './content-form';
import { SeasonsEditor } from './seasons-editor';
import { ConflictNotice, isConflict, TitleDeletion, TitleImages, TitlePublication } from './title-sections';

const schema = z.object({
  translations: translationsSchema,
  originalTitle: z.string().trim().max(200, 'error.Content.OriginalTitleTooLong'),
  releaseYear: wholeNumber(1888, 2100, 'error.Content.ReleaseYearOutOfRange'),
  ageRating: z.enum(['All', 'Age7', 'Age13', 'Age16', 'Age18']),
  genreIds: z.array(z.string()),
  credits: creditsSchema,
});
type Values = z.infer<typeof schema>;

const valuesOf = (series: SeriesDetails | undefined): Values => ({
  translations: textsOf(series?.translations),
  originalTitle: series?.originalTitle ?? '',
  releaseYear: series ? String(series.releaseYear) : '',
  ageRating: series?.ageRating ?? 'All',
  genreIds: series?.genres.map((genre) => genre.id) ?? [],
  credits: creditsOf(series?.credits),
});

const requestOf = (values: Values, version: number): SeriesRequest => ({
  translations: translationsOf(values.translations),
  originalTitle: values.originalTitle || null,
  releaseYear: Number(values.releaseYear),
  ageRating: values.ageRating,
  genreIds: values.genreIds,
  credits: creditInputs(values.credits),
  version,
});

/**
 * A series: its details, images, seasons and episodes, publishing and deleting. `/series/new` makes one and
 * goes on to its page. Each part asks for its own permission; without the write permission it is read only.
 */
export function SeriesPage() {
  const { t } = useLocale();
  const id = useParams().id;
  const series = useSeries(id);
  // Loading the current version after a conflict starts the editor again from it.
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    document.title = series.data?.title ?? t('admin.series.new');
  }, [series.data?.title, t]);

  if (id !== undefined && series.isPending) {
    return (
      <p aria-busy="true" className="text-ink-muted">
        {t('browse.loading')}
      </p>
    );
  }
  if (series.isError) {
    return (
      <p role="alert" className="text-ink-muted">
        {t(problemMessageKey(series.error))}
      </p>
    );
  }
  return (
    <SeriesEditor
      key={`${series.data?.id ?? 'new'}:${String(generation)}`}
      series={series.data}
      onReload={async () => {
        await series.refetch();
        setGeneration((value) => value + 1);
      }}
    />
  );
}

function SeriesEditor({
  series,
  onReload,
}: Readonly<{ series: SeriesDetails | undefined; onReload: () => Promise<void> }>) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const session = useAdminSession();
  const writable = can(session.data, 'catalog:series:write');
  const save = useSaveSeries();
  // The version this editor works from: loaded with the series, moved on by its own changes.
  const [version, setVersion] = useState(series?.version ?? 0);
  const [conflict, setConflict] = useState(false);
  const [saved, setSaved] = useState(false);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: valuesOf(series) });
  const { errors, isSubmitting, isDirty } = form.formState;
  const changed = () => {
    setVersion((value) => value + 1);
  };
  const conflicted = () => {
    setConflict(true);
  };

  const submit = form.handleSubmit(async (values) => {
    setSaved(false);
    try {
      const id = await save.mutateAsync({
        ...(series ? { id: series.id } : {}),
        body: requestOf(values, version),
      });
      form.reset(values);
      if (series) {
        changed();
        setSaved(true);
      } else {
        void navigate(paths.seriesItem(id), { replace: true });
      }
    } catch (error) {
      if (isConflict(error)) {
        conflicted();
        return;
      }
      showProblem(
        error,
        [
          'translations.tr.title',
          'translations.tr.synopsis',
          'translations.en.title',
          'translations.en.synopsis',
          'originalTitle',
          'releaseYear',
          'ageRating',
        ],
        form.setError,
        {
          'Content.DefaultLanguageRequired': 'translations.tr.title',
          'Content.GenreRequired': 'genreIds',
          'Content.UnknownGenre': 'genreIds',
        },
      );
    }
  });

  const publishedEpisodes = (series?.seasons ?? []).flatMap((season) =>
    season.episodes.filter((episode) => episode.status === 'Published'),
  );

  return (
    <>
      <UnsavedChanges dirty={isDirty && !isSubmitting} />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold text-ink-strong">
          {series?.title ?? t('admin.series.new')}
        </h1>
        {series && <StatusBadge status={series.status} />}
      </div>
      {conflict && <ConflictNotice onReload={onReload} />}
      <FormProvider {...form}>
        <form
          noValidate
          aria-label={t('admin.series.details')}
          onSubmit={(event) => void submit(event)}
          className="flex flex-col gap-6 rounded-lg bg-surface p-6"
        >
          {errors.root && <FormAlert tone="error">{messageOf(t, errors.root.message)}</FormAlert>}
          {saved && <FormAlert tone="success">{t('admin.saved')}</FormAlert>}
          <fieldset disabled={!writable} className="flex min-w-0 flex-col gap-6">
            <TextsFields />
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField
                label={t('admin.content.originalTitle')}
                error={messageOf(t, errors.originalTitle?.message)}
                {...form.register('originalTitle')}
              />
              <TextField
                label={t('admin.content.releaseYear')}
                inputMode="numeric"
                error={messageOf(t, errors.releaseYear?.message)}
                {...form.register('releaseYear')}
              />
              <SelectField
                label={t('admin.content.ageRating')}
                options={ageRatings.map((value) => ({ value, label: t(`age.${value}`) }))}
                error={messageOf(t, errors.ageRating?.message)}
                {...form.register('ageRating')}
              />
            </div>
            <GenresField />
            <CreditsEditor roles={seriesRoles} disabled={!writable} />
          </fieldset>
          {writable && (
            <button type="submit" className={`${buttonClass('primary')} self-start`} disabled={isSubmitting}>
              {isSubmitting ? t('auth.working') : t('admin.save')}
            </button>
          )}
        </form>
      </FormProvider>

      {series && (
        <TitleImages
          kind="series"
          title={series}
          version={version}
          onChanged={changed}
          onConflict={conflicted}
        />
      )}
      {series && (
        <SeasonsEditor series={series} version={version} onChanged={changed} onConflict={conflicted} />
      )}
      {series && (
        <TitlePublication
          kind="series"
          title={series}
          needs={[
            { label: t('admin.publish.genre'), met: series.genres.length > 0 },
            { label: t('admin.publish.poster'), met: series.posterUrl !== null },
            { label: t('admin.publish.publishedEpisode'), met: publishedEpisodes.length > 0 },
          ]}
          unsaved={isDirty}
          version={version}
          onVersion={(before, after) => {
            // Only this change in between: the editor moves on. Otherwise saving finds the conflict.
            if (after === before + 1) {
              setVersion(after);
            }
          }}
        />
      )}
      {series && can(session.data, 'catalog:series:delete') && <TitleDeletion kind="series" title={series} />}
    </>
  );
}
