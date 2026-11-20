import { zodResolver } from '@hookform/resolvers/zod';
import { problemMessageKey } from '@netboxplus/core';
import { FormAlert, TextField } from '@netboxplus/ui';
import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { buttonClass } from '../components/buttons';
import { ConfirmDialog } from '../components/confirm-dialog';
import { messageOf, showProblem } from '../components/form-errors';
import { useDeleteGenre, useGenres, useSaveGenre, type GenreResponse } from '../data/catalog';
import { can, useAdminSession } from '../data/session';
import { useLocale } from '../i18n';

const schema = z.object({
  tr: z.string().trim().min(1, 'validation.required'),
  en: z.string(),
});
type Values = z.infer<typeof schema>;

/**
 * The genres with their Turkish and English names and how many titles use each. With the write
 * permission they can be added, renamed and deleted (only one no title uses).
 */
export function GenresPage() {
  const { t } = useLocale();
  const session = useAdminSession();
  const writable = can(session.data, 'catalog:genres:write');
  const genres = useGenres();
  const remove = useDeleteGenre();
  const [editing, setEditing] = useState<GenreResponse | 'new' | null>(null);
  const [deleting, setDeleting] = useState<GenreResponse | null>(null);

  useEffect(() => {
    document.title = t('admin.genres.title');
  }, [t]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold text-ink-strong">{t('admin.genres.title')}</h1>
        {writable && (
          <button
            type="button"
            className={buttonClass('primary')}
            onClick={() => {
              setEditing('new');
            }}
          >
            {t('admin.genres.new')}
          </button>
        )}
      </div>

      {genres.isPending ? (
        <p aria-busy="true" className="text-ink-muted">
          {t('browse.loading')}
        </p>
      ) : genres.isError ? (
        <p role="alert" className="text-ink-muted">
          {t(problemMessageKey(genres.error))}
        </p>
      ) : genres.data.length === 0 ? (
        <p className="text-ink-muted">{t('admin.genres.empty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="text-ink-muted">
              <tr className="border-b border-line">
                <th scope="col" className="px-4 py-3 font-normal">
                  {t('admin.genres.nameTr')}
                </th>
                <th scope="col" className="px-4 py-3 font-normal">
                  {t('admin.genres.nameEn')}
                </th>
                <th scope="col" className="px-4 py-3 font-normal">
                  {t('admin.genres.usage')}
                </th>
                {writable && (
                  <th scope="col" className="px-4 py-3 font-normal">
                    <span className="sr-only">{t('admin.actions')}</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {genres.data.map((genre) => (
                <tr key={genre.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-semibold text-ink-strong">
                    {genre.translations.tr ?? genre.name}
                  </td>
                  <td className="px-4 py-3">{genre.translations.en ?? '—'}</td>
                  <td className="px-4 py-3 tabular-nums">{genre.usageCount}</td>
                  {writable && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className={buttonClass('secondary', 'sm')}
                          aria-label={t('admin.editNamed').replace('{name}', genre.name)}
                          onClick={() => {
                            setEditing(genre);
                          }}
                        >
                          {t('admin.edit')}
                        </button>
                        <button
                          type="button"
                          className={buttonClass('ghost', 'sm')}
                          aria-label={t('admin.deleteNamed').replace('{name}', genre.name)}
                          onClick={() => {
                            remove.reset();
                            setDeleting(genre);
                          }}
                        >
                          {t('admin.delete')}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing !== null && (
        <GenreDialog
          genre={editing === 'new' ? undefined : editing}
          onClose={() => {
            setEditing(null);
          }}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title={t('admin.genres.deleteTitle').replace('{name}', deleting?.name ?? '')}
        body={t('admin.genres.deleteBody')}
        confirmLabel={t('admin.delete')}
        busy={remove.isPending}
        error={remove.isError ? t(problemMessageKey(remove.error)) : undefined}
        onConfirm={() => {
          if (deleting) {
            remove.mutate(deleting.id, {
              onSuccess: () => {
                setDeleting(null);
              },
            });
          }
        }}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
          }
        }}
      />
    </>
  );
}

function GenreDialog({
  genre,
  onClose,
}: Readonly<{ genre: GenreResponse | undefined; onClose: () => void }>) {
  const { t } = useLocale();
  const save = useSaveGenre();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { tr: genre?.translations.tr ?? '', en: genre?.translations.en ?? '' },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({ ...(genre ? { id: genre.id } : {}), names: values });
      onClose();
    } catch (error) {
      showProblem(error, ['tr', 'en'], form.setError, {
        'Genre.NameTaken': 'tr',
        'Genre.NameRequired': 'tr',
        'Genre.NameTooLong': 'tr',
      });
    }
  });

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
          className="fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg bg-surface p-6 shadow-xl"
        >
          <Dialog.Title className="font-display text-xl font-bold text-ink-strong">
            {genre ? t('admin.genres.edit') : t('admin.genres.new')}
          </Dialog.Title>
          <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
            {errors.root && <FormAlert tone="error">{messageOf(t, errors.root.message)}</FormAlert>}
            <TextField
              label={t('admin.genres.nameTr')}
              lang="tr"
              error={messageOf(t, errors.tr?.message)}
              {...form.register('tr')}
            />
            <TextField
              label={t('admin.genres.nameEn')}
              lang="en"
              error={messageOf(t, errors.en?.message)}
              {...form.register('en')}
            />
            <div className="flex flex-wrap gap-3">
              <button type="submit" className={buttonClass('primary')} disabled={isSubmitting}>
                {isSubmitting ? t('auth.working') : t('admin.save')}
              </button>
              <Dialog.Close asChild>
                <button type="button" className={buttonClass('ghost')}>
                  {t('admin.cancel')}
                </button>
              </Dialog.Close>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
