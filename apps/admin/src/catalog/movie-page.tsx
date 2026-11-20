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
import { ageRatings, useMovie, useSaveMovie, type MovieDetails, type MovieRequest } from '../data/movies';
import { can, useAdminSession } from '../data/session';
import { useLocale } from '../i18n';
import { ContentVideos } from '../videos/content-videos';
import { paths } from '../paths';
import {
  creditInputs,
  creditsOf,
  creditsSchema,
  CreditsEditor,
  GenresField,
  movieRoles,
  textsOf,
  TextsFields,
  translationsOf,
  translationsSchema,
  wholeNumber,
} from './content-form';
import { ConflictNotice, isConflict, TitleDeletion, TitleImages, TitlePublication } from './title-sections';

const schema = z.object({
  translations: translationsSchema,
  originalTitle: z.string().trim().max(200, 'error.Content.OriginalTitleTooLong'),
  releaseYear: wholeNumber(1888, 2100, 'error.Content.ReleaseYearOutOfRange'),
  ageRating: z.enum(['All', 'Age7', 'Age13', 'Age16', 'Age18']),
  runtimeMinutes: wholeNumber(1, 1000, 'error.Content.RuntimeOutOfRange'),
  genreIds: z.array(z.string()),
  credits: creditsSchema,
});
type Values = z.infer<typeof schema>;

const valuesOf = (movie: MovieDetails | undefined): Values => ({
  translations: textsOf(movie?.translations),
  originalTitle: movie?.originalTitle ?? '',
  releaseYear: movie ? String(movie.releaseYear) : '',
  ageRating: movie?.ageRating ?? 'All',
  runtimeMinutes: movie ? String(movie.runtimeMinutes) : '',
  genreIds: movie?.genres.map((genre) => genre.id) ?? [],
  credits: creditsOf(movie?.credits),
});

const requestOf = (values: Values, version: number): MovieRequest => ({
  translations: translationsOf(values.translations),
  originalTitle: values.originalTitle || null,
  releaseYear: Number(values.releaseYear),
  ageRating: values.ageRating,
  runtimeMinutes: Number(values.runtimeMinutes),
  genreIds: values.genreIds,
  credits: creditInputs(values.credits),
  version,
});

/**
 * A movie: its details, images, publishing and deleting. `/movies/new` makes one and goes on to its page.
 * Each part asks for its own permission; without the write permission the details are read only.
 */
export function MoviePage() {
  const { t } = useLocale();
  const id = useParams().id;
  const movie = useMovie(id);
  // Loading the current version after a conflict starts the editor again from it.
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    document.title = movie.data?.title ?? t('admin.movies.new');
  }, [movie.data?.title, t]);

  if (id !== undefined && movie.isPending) {
    return (
      <p aria-busy="true" className="text-ink-muted">
        {t('browse.loading')}
      </p>
    );
  }
  if (movie.isError) {
    return (
      <p role="alert" className="text-ink-muted">
        {t(problemMessageKey(movie.error))}
      </p>
    );
  }
  return (
    <MovieEditor
      key={`${movie.data?.id ?? 'new'}:${String(generation)}`}
      movie={movie.data}
      onReload={async () => {
        await movie.refetch();
        setGeneration((value) => value + 1);
      }}
    />
  );
}

function MovieEditor({
  movie,
  onReload,
}: Readonly<{ movie: MovieDetails | undefined; onReload: () => Promise<void> }>) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const session = useAdminSession();
  const writable = can(session.data, 'catalog:movies:write');
  const save = useSaveMovie();
  // The version this editor works from: loaded with the movie, moved on by its own changes.
  const [version, setVersion] = useState(movie?.version ?? 0);
  const [conflict, setConflict] = useState(false);
  const [saved, setSaved] = useState(false);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: valuesOf(movie) });
  const { errors, isSubmitting, isDirty } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    setSaved(false);
    try {
      const id = await save.mutateAsync({
        ...(movie ? { id: movie.id } : {}),
        body: requestOf(values, version),
      });
      form.reset(values);
      if (movie) {
        setVersion((value) => value + 1);
        setSaved(true);
      } else {
        void navigate(paths.movie(id), { replace: true });
      }
    } catch (error) {
      if (isConflict(error)) {
        setConflict(true);
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
          'runtimeMinutes',
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

  return (
    <>
      <UnsavedChanges dirty={isDirty && !isSubmitting} />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold text-ink-strong">
          {movie?.title ?? t('admin.movies.new')}
        </h1>
        {movie && <StatusBadge status={movie.status} />}
      </div>
      {conflict && <ConflictNotice onReload={onReload} />}
      <FormProvider {...form}>
        <form
          noValidate
          aria-label={t('admin.movies.details')}
          onSubmit={(event) => void submit(event)}
          className="flex flex-col gap-6 rounded-lg bg-surface p-6"
        >
          {errors.root && <FormAlert tone="error">{messageOf(t, errors.root.message)}</FormAlert>}
          {saved && <FormAlert tone="success">{t('admin.saved')}</FormAlert>}
          <fieldset disabled={!writable} className="flex min-w-0 flex-col gap-6">
            <TextsFields />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              <TextField
                label={t('admin.content.runtime')}
                inputMode="numeric"
                error={messageOf(t, errors.runtimeMinutes?.message)}
                {...form.register('runtimeMinutes')}
              />
            </div>
            <GenresField />
            <CreditsEditor roles={movieRoles} disabled={!writable} />
          </fieldset>
          {writable && (
            <button type="submit" className={`${buttonClass('primary')} self-start`} disabled={isSubmitting}>
              {isSubmitting ? t('auth.working') : t('admin.save')}
            </button>
          )}
        </form>
      </FormProvider>

      {movie && (
        <TitleImages
          kind="movie"
          title={movie}
          version={version}
          onChanged={() => {
            setVersion((value) => value + 1);
          }}
          onConflict={() => {
            setConflict(true);
          }}
        />
      )}
      {movie && (
        <ContentVideos
          contentKind="Movie"
          contentId={movie.id}
          purposes={['Feature', 'Trailer']}
          className="rounded-lg bg-surface p-6"
        />
      )}
      {movie && (
        <TitlePublication
          kind="movie"
          title={movie}
          needs={[
            { label: t('admin.publish.genre'), met: movie.genres.length > 0 },
            { label: t('admin.publish.poster'), met: movie.posterUrl !== null },
            {
              label: `${t('admin.publish.video')} (${t(`admin.video.${movie.videoStatus}`)})`,
              met: movie.hasPlayableVideo,
            },
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
      {movie && can(session.data, 'catalog:movies:delete') && <TitleDeletion kind="movie" title={movie} />}
    </>
  );
}
