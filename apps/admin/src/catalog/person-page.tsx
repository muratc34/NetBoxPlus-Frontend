import { zodResolver } from '@hookform/resolvers/zod';
import { problemMessageKey } from '@netboxplus/core';
import { classNames, FormAlert, TextAreaField, TextField } from '@netboxplus/ui';
import { useEffect, useId, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import { buttonClass } from '../components/buttons';
import { ConfirmDialog } from '../components/confirm-dialog';
import { messageOf, showProblem } from '../components/form-errors';
import { UnsavedChanges } from '../components/unsaved-changes';
import {
  useAttachPhoto,
  useDeletePerson,
  usePerson,
  useRemovePhoto,
  useSavePerson,
  type PersonResponse,
} from '../data/catalog';
import { ImageRejected, imageTypes } from '../data/images';
import { can, useAdminSession } from '../data/session';
import { useLocale } from '../i18n';
import { paths } from '../paths';

const schema = z.object({
  name: z.string().trim().min(1, 'validation.required'),
  bioTr: z.string(),
  bioEn: z.string(),
});
type Values = z.infer<typeof schema>;

const valuesOf = (person: PersonResponse | undefined): Values => ({
  name: person?.name ?? '',
  bioTr: person?.translations.tr ?? '',
  bioEn: person?.translations.en ?? '',
});

/**
 * A person: the name and the biography in Turkish and English, the photo, and deleting (only someone no
 * title credits). `/people/new` makes one and goes on to its page. Without the write permission it is
 * read only.
 */
export function PersonPage() {
  const { t } = useLocale();
  const id = useParams().id;
  const person = usePerson(id);

  useEffect(() => {
    document.title = person.data?.name ?? t('admin.people.new');
  }, [person.data?.name, t]);

  if (id !== undefined && person.isPending) {
    return (
      <p aria-busy="true" className="text-ink-muted">
        {t('browse.loading')}
      </p>
    );
  }
  if (person.isError) {
    return (
      <p role="alert" className="text-ink-muted">
        {t(problemMessageKey(person.error))}
      </p>
    );
  }
  // Keyed by the person, so the form starts again from what Catalog has after saving or loading another.
  return <PersonForm key={person.data?.id ?? 'new'} person={person.data} />;
}

function PersonForm({ person }: Readonly<{ person: PersonResponse | undefined }>) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const session = useAdminSession();
  const writable = can(session.data, 'catalog:people:write');
  const save = useSavePerson();
  const remove = useDeletePerson();
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: valuesOf(person) });
  const { errors, isSubmitting, isDirty } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    setSaved(false);
    try {
      const id = await save.mutateAsync({
        ...(person ? { id: person.id } : {}),
        fields: { name: values.name, biographies: { tr: values.bioTr, en: values.bioEn } },
      });
      form.reset(values);
      if (person) {
        setSaved(true);
      } else {
        void navigate(paths.person(id), { replace: true });
      }
    } catch (error) {
      showProblem(error, ['name'], form.setError, {
        'Person.NameRequired': 'name',
        'Person.NameTooLong': 'name',
        'Person.BiographyTooLong': 'bioTr',
      });
    }
  });

  return (
    <>
      <UnsavedChanges dirty={isDirty && !isSubmitting} />
      <h1 className="font-display text-3xl font-bold text-ink-strong">
        {person?.name ?? t('admin.people.new')}
      </h1>
      <form
        noValidate
        aria-label={t('admin.people.details')}
        onSubmit={(event) => void submit(event)}
        className="flex max-w-2xl flex-col gap-4 rounded-lg bg-surface p-6"
      >
        {errors.root && <FormAlert tone="error">{messageOf(t, errors.root.message)}</FormAlert>}
        {saved && <FormAlert tone="success">{t('admin.saved')}</FormAlert>}
        <fieldset disabled={!writable} className="flex flex-col gap-4">
          <TextField
            label={t('admin.people.name')}
            error={messageOf(t, errors.name?.message)}
            {...form.register('name')}
          />
          <TextAreaField
            label={t('admin.people.bioTr')}
            lang="tr"
            error={messageOf(t, errors.bioTr?.message)}
            {...form.register('bioTr')}
          />
          <TextAreaField
            label={t('admin.people.bioEn')}
            lang="en"
            error={messageOf(t, errors.bioEn?.message)}
            {...form.register('bioEn')}
          />
        </fieldset>
        {writable && (
          <button type="submit" className={buttonClass('primary')} disabled={isSubmitting}>
            {isSubmitting ? t('auth.working') : t('admin.save')}
          </button>
        )}
      </form>

      {person && <PersonPhoto person={person} />}

      {person && writable && (
        <section
          aria-labelledby="delete-person"
          className="flex max-w-2xl flex-col items-start gap-3 rounded-lg bg-surface p-6"
        >
          <h2 id="delete-person" className="font-display text-xl font-bold text-ink-strong">
            {t('admin.delete')}
          </h2>
          <button
            type="button"
            className={buttonClass('danger')}
            onClick={() => {
              remove.reset();
              setDeleting(true);
            }}
          >
            {t('admin.deleteNamed').replace('{name}', person.name)}
          </button>
          <ConfirmDialog
            open={deleting}
            title={t('admin.people.deleteTitle').replace('{name}', person.name)}
            body={t('admin.people.deleteBody')}
            confirmLabel={t('admin.delete')}
            busy={remove.isPending}
            error={remove.isError ? t(problemMessageKey(remove.error)) : undefined}
            onConfirm={() => {
              remove.mutate(person.id, {
                onSuccess: () => {
                  setDeleting(false);
                  void navigate(paths.people, { replace: true });
                },
              });
            }}
            onOpenChange={setDeleting}
          />
        </section>
      )}
    </>
  );
}

/** The person's photo: shown, replaced by a new file (with how far the upload is) or removed. */
function PersonPhoto({ person }: Readonly<{ person: PersonResponse }>) {
  const { t } = useLocale();
  const session = useAdminSession();
  const writable = can(session.data, 'catalog:people:write') && can(session.data, 'catalog:images:upload');
  const fileId = useId();
  const input = useRef<HTMLInputElement>(null);
  const attach = useAttachPhoto(person.id);
  const remove = useRemovePhoto(person.id);
  const [progress, setProgress] = useState<number | undefined>(undefined);
  const failure = attach.error ?? remove.error;
  const message =
    failure instanceof ImageRejected
      ? t(failure.reason === 'type' ? 'admin.image.type' : 'admin.image.size')
      : failure
        ? t(problemMessageKey(failure))
        : undefined;

  return (
    <section
      aria-labelledby="person-photo"
      className="flex max-w-2xl flex-col gap-4 rounded-lg bg-surface p-6"
    >
      <h2 id="person-photo" className="font-display text-xl font-bold text-ink-strong">
        {t('admin.people.photo')}
      </h2>
      {person.photoUrl ? (
        <img src={person.photoUrl} alt={person.name} className="size-40 rounded-lg object-cover" />
      ) : (
        <p className="text-ink-muted">{t('admin.people.noPhoto')}</p>
      )}
      {message && <FormAlert tone="error">{message}</FormAlert>}
      {attach.isPending && progress !== undefined && (
        <p role="status" className="text-sm text-ink-muted">
          {t('admin.people.uploading').replace('{percent}', String(Math.round(progress * 100)))}
        </p>
      )}
      {writable && (
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={input}
            id={fileId}
            type="file"
            accept={imageTypes.join(',')}
            aria-describedby={`${fileId}-hint`}
            className="peer sr-only"
            disabled={attach.isPending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                remove.reset();
                setProgress(0);
                attach.mutate(
                  { file, onProgress: setProgress },
                  {
                    onSettled: () => {
                      setProgress(undefined);
                      if (input.current) {
                        input.current.value = '';
                      }
                    },
                  },
                );
              }
            }}
          />
          {/* The input is hidden for its label, which looks like a button and shows the input's focus. */}
          <label
            htmlFor={fileId}
            className={classNames(
              buttonClass('secondary'),
              'cursor-pointer peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
            )}
          >
            {person.photoUrl ? t('admin.people.replacePhoto') : t('admin.people.uploadPhoto')}
          </label>
          {person.photoUrl && (
            <button
              type="button"
              className={buttonClass('ghost')}
              disabled={remove.isPending}
              onClick={() => {
                attach.reset();
                remove.mutate();
              }}
            >
              {t('admin.people.removePhoto')}
            </button>
          )}
          <p id={`${fileId}-hint`} className="w-full text-sm text-ink-muted">
            {t('admin.people.photoHint')}
          </p>
        </div>
      )}
    </section>
  );
}
