import { zodResolver } from '@hookform/resolvers/zod';
import { isApiError } from '@netboxplus/api';
import { problemMessageKey } from '@netboxplus/core';
import { FormAlert, SelectField, TextField } from '@netboxplus/ui';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import { buttonClass } from '../components/buttons';
import { ConfirmDialog } from '../components/confirm-dialog';
import { messageOf, showProblem } from '../components/form-errors';
import { ImageSlot } from '../components/image-slot';
import { StatusBadge } from '../components/status-badge';
import { UnsavedChanges } from '../components/unsaved-changes';
import {
  ageRatings,
  useAttachMovieImage,
  useDeleteMovie,
  useMovie,
  usePublishMovie,
  useRemoveMovieImage,
  useSaveMovie,
  type ImageSlotName,
  type MovieDetails,
  type MovieRequest,
} from '../data/movies';
import { can, useAdminSession } from '../data/session';
import { useLocale } from '../i18n';
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

const isConflict = (error: unknown) => isApiError(error) && error.code === 'Content.VersionConflict';

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
  const { locale, t } = useLocale();
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
      {conflict && (
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
      )}
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
        <MovieImages
          movie={movie}
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
        <MoviePublication
          movie={movie}
          locale={locale}
          unsaved={isDirty}
          onVersion={(before, after) => {
            // Only this change in between: the editor moves on. Otherwise saving finds the conflict.
            if (after === before + 1) {
              setVersion(after);
            }
          }}
          version={version}
        />
      )}
      {movie && can(session.data, 'catalog:movies:delete') && <MovieDeletion movie={movie} />}
    </>
  );
}

/** The poster and the backdrop; each change carries the editor's version and moves it on. */
function MovieImages({
  movie,
  version,
  onChanged,
  onConflict,
}: Readonly<{ movie: MovieDetails; version: number; onChanged: () => void; onConflict: () => void }>) {
  const { t } = useLocale();
  const session = useAdminSession();
  const writable = can(session.data, 'catalog:movies:write') && can(session.data, 'catalog:images:upload');
  const poster = useImageActions(movie.id, 'poster', version, onChanged, onConflict);
  const backdrop = useImageActions(movie.id, 'backdrop', version, onChanged, onConflict);

  return (
    <section aria-labelledby="movie-images" className="flex flex-col gap-6 rounded-lg bg-surface p-6">
      <h2 id="movie-images" className="font-display text-xl font-bold text-ink-strong">
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
          imageUrl={movie.posterUrl}
          alt={`${movie.title}: ${t('admin.images.poster')}`}
          imageClassName="aspect-[2/3] w-40"
          writable={writable}
          removeBlocked={movie.status === 'Published' ? t('admin.images.posterKept') : undefined}
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
          imageUrl={movie.backdropUrl}
          alt={`${movie.title}: ${t('admin.images.backdrop')}`}
          imageClassName="aspect-video w-full max-w-md"
          writable={writable}
          {...backdrop}
        />
      </div>
    </section>
  );
}

function useImageActions(
  id: string,
  slot: ImageSlotName,
  version: number,
  onChanged: () => void,
  onConflict: () => void,
) {
  const attach = useAttachMovieImage(id, slot);
  const remove = useRemoveMovieImage(id, slot);
  async function changed(action: Promise<void>) {
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
  return {
    onUpload: (file: File, onProgress: (fraction: number) => void) =>
      changed(attach.mutateAsync({ file, version, onProgress })),
    onRemove: () => changed(remove.mutateAsync(version)),
  };
}

/**
 * Whether the movie is out, what it still needs (a genre, a poster, a playable video) and the switch. It
 * publishes what is stored, so changes not saved keep it closed.
 */
function MoviePublication({
  movie,
  locale,
  unsaved,
  version,
  onVersion,
}: Readonly<{
  movie: MovieDetails;
  locale: string;
  unsaved: boolean;
  version: number;
  onVersion: (before: number, after: number) => void;
}>) {
  const { t } = useLocale();
  const session = useAdminSession();
  const allowed = can(session.data, 'catalog:movies:publish');
  const publication = usePublishMovie(movie.id);
  const [asking, setAsking] = useState(false);
  const published = movie.status === 'Published';
  const needs = [
    { label: t('admin.publish.genre'), met: movie.genres.length > 0 },
    { label: t('admin.publish.poster'), met: movie.posterUrl !== null },
    {
      label: `${t('admin.publish.video')} (${t(`admin.video.${movie.videoStatus}`)})`,
      met: movie.hasPlayableVideo,
    },
  ];
  const ready = needs.every((need) => need.met);

  function change(publish: boolean) {
    const before = version;
    publication.mutate(publish, {
      onSuccess: (fresh) => {
        onVersion(before, fresh.version);
        setAsking(false);
      },
    });
  }

  return (
    <section
      aria-labelledby="movie-publication"
      className="flex flex-col items-start gap-4 rounded-lg bg-surface p-6"
    >
      <h2 id="movie-publication" className="font-display text-xl font-bold text-ink-strong">
        {t('admin.publish.title')}
      </h2>
      <p className="flex flex-wrap items-center gap-2">
        <StatusBadge status={movie.status} />
        {movie.publishedAt && (
          <span className="text-sm text-ink-muted">
            {t('admin.publish.publishedAt').replace(
              '{date}',
              new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(movie.publishedAt)),
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
            aria-describedby={!ready || unsaved ? 'publish-blocked' : undefined}
            onClick={() => {
              change(true);
            }}
          >
            {publication.isPending ? t('auth.working') : t('admin.publish.publish')}
          </button>
          {(!ready || unsaved) && (
            <p id="publish-blocked" className="text-sm text-ink-muted">
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
            title={t('admin.publish.unpublishTitle').replace('{name}', movie.title)}
            body={t('admin.publish.unpublishBody')}
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

/** Deleting a draft movie, after asking; a published one has to be unpublished first. */
function MovieDeletion({ movie }: Readonly<{ movie: MovieDetails }>) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const remove = useDeleteMovie();
  const [asking, setAsking] = useState(false);
  const published = movie.status === 'Published';

  return (
    <section
      aria-labelledby="movie-deletion"
      className="flex flex-col items-start gap-3 rounded-lg bg-surface p-6"
    >
      <h2 id="movie-deletion" className="font-display text-xl font-bold text-ink-strong">
        {t('admin.delete')}
      </h2>
      <button
        type="button"
        className={buttonClass('danger')}
        disabled={published}
        aria-describedby={published ? 'movie-deletion-blocked' : undefined}
        onClick={() => {
          remove.reset();
          setAsking(true);
        }}
      >
        {t('admin.deleteNamed').replace('{name}', movie.title)}
      </button>
      {published && (
        <p id="movie-deletion-blocked" className="text-sm text-ink-muted">
          {t('admin.movies.deletePublished')}
        </p>
      )}
      <ConfirmDialog
        open={asking}
        title={t('admin.movies.deleteTitle').replace('{name}', movie.title)}
        body={t('admin.movies.deleteBody')}
        confirmLabel={t('admin.delete')}
        busy={remove.isPending}
        error={remove.isError ? t(problemMessageKey(remove.error)) : undefined}
        onConfirm={() => {
          remove.mutate(movie.id, {
            onSuccess: () => {
              setAsking(false);
              void navigate(paths.movies, { replace: true });
            },
          });
        }}
        onOpenChange={setAsking}
      />
    </section>
  );
}
