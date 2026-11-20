import { TextAreaField, TextField } from '@netboxplus/ui';
import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useId, useState } from 'react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { buttonClass } from '../components/buttons';
import { messageOf } from '../components/form-errors';
import { useGenres, usePeople } from '../data/catalog';
import type { CreditRole, MovieDetails } from '../data/movies';
import { useLocale } from '../i18n';
import { searchDelayMs } from '../components/address-search';

/** The roles a movie credits; `Creator` belongs to series and is offered there. */
export const movieRoles: readonly CreditRole[] = ['Director', 'Writer', 'Actor'];

/** A series also credits its creators, first. */
export const seriesRoles: readonly CreditRole[] = ['Creator', 'Director', 'Writer', 'Actor'];

const textSchema = {
  title: z.string().trim().max(200, 'error.Content.TitleTooLong'),
  synopsis: z.string().trim().max(2000, 'error.Content.SynopsisTooLong'),
};

/**
 * The title and synopsis per language, as Catalog checks them: Turkish both required, English optional but
 * both together.
 */
export const translationsSchema = z
  .object({
    tr: z.object({
      title: textSchema.title.min(1, 'error.Content.TitleRequired'),
      synopsis: textSchema.synopsis.min(1, 'error.Content.SynopsisRequired'),
    }),
    en: z.object(textSchema),
  })
  .superRefine((value, context) => {
    const { title, synopsis } = value.en;
    if ((title === '') !== (synopsis === '')) {
      context.addIssue({
        code: 'custom',
        path: ['en', title === '' ? 'title' : 'synopsis'],
        message: 'admin.content.englishIncomplete',
      });
    }
  });

export const creditsSchema = z.array(
  z.object({
    personId: z.string(),
    personName: z.string(),
    role: z.enum(['Director', 'Writer', 'Actor', 'Creator']),
    characterName: z.string().trim().max(200, 'error.Content.CharacterNameTooLong'),
  }),
);

/** A whole number from a text box between `min` and `max`, or the message key saying the range. */
export function wholeNumber(min: number, max: number, message: string) {
  return z
    .string()
    .trim()
    .refine((value) => /^\d+$/.test(value) && Number(value) >= min && Number(value) <= max, message);
}

/** What the shared parts of a title's form hold. */
export interface ContentValues {
  translations: { tr: { title: string; synopsis: string }; en: { title: string; synopsis: string } };
  genreIds: string[];
  credits: { personId: string; personName: string; role: CreditRole; characterName: string }[];
}

type Translations = MovieDetails['translations'];
type Credits = MovieDetails['credits'];

/** The form's texts from what Catalog holds; a missing language is empty. */
export function textsOf(translations: Translations | undefined): ContentValues['translations'] {
  const text = (language: 'tr' | 'en') => ({
    title: translations?.[language]?.title ?? '',
    synopsis: translations?.[language]?.synopsis ?? '',
  });
  return { tr: text('tr'), en: text('en') };
}

/** The texts to send: English only when written. */
export function translationsOf(texts: ContentValues['translations']) {
  return { tr: texts.tr, ...(texts.en.title ? { en: texts.en } : {}) };
}

/** The form's credits, in their order. */
export function creditsOf(credits: Credits | undefined): ContentValues['credits'] {
  return [...(credits ?? [])]
    .sort((left, right) => left.order - right.order)
    .map((credit) => ({
      personId: credit.personId,
      personName: credit.personName,
      role: credit.role,
      characterName: credit.characterName ?? '',
    }));
}

/** The credits to send: the order is the place in the list, a character only for an actor. */
export function creditInputs(credits: ContentValues['credits']) {
  return credits.map((credit, order) => ({
    personId: credit.personId,
    role: credit.role,
    characterName: credit.role === 'Actor' && credit.characterName ? credit.characterName : null,
    order,
  }));
}

/** The title and synopsis in Turkish and English. */
export function TextsFields() {
  const { t } = useLocale();
  const form = useFormContext<ContentValues>();
  const errors = form.formState.errors.translations;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {(['tr', 'en'] as const).map((language) => (
        <fieldset key={language} lang={language} className="flex min-w-0 flex-col gap-4">
          <legend className="mb-2 font-display text-lg font-bold text-ink-strong">
            {t(language === 'tr' ? 'admin.content.turkish' : 'admin.content.english')}
          </legend>
          {language === 'en' && (
            <p className="-mt-2 text-sm text-ink-muted">{t('admin.content.englishHint')}</p>
          )}
          <TextField
            label={t('admin.content.title')}
            error={messageOf(t, errors?.[language]?.title?.message)}
            {...form.register(`translations.${language}.title`)}
          />
          <TextAreaField
            label={t('admin.content.synopsis')}
            rows={5}
            error={messageOf(t, errors?.[language]?.synopsis?.message)}
            {...form.register(`translations.${language}.synopsis`)}
          />
        </fieldset>
      ))}
    </div>
  );
}

/** The genres as boxes to tick, named in the panel's language. */
export function GenresField() {
  const { locale, t } = useLocale();
  const form = useFormContext<ContentValues>();
  const genres = useGenres();
  const error = messageOf(t, form.formState.errors.genreIds?.message);
  const errorId = useId();
  return (
    <fieldset aria-describedby={error ? errorId : undefined} className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold text-ink-strong">{t('admin.content.genres')}</legend>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {(genres.data ?? []).map((genre) => (
          <label key={genre.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              value={genre.id}
              className="size-4 accent-brand-strong"
              {...form.register('genreIds')}
            />
            {genre.translations[locale] ?? genre.name}
          </label>
        ))}
      </div>
      {error && (
        <p id={errorId} className="text-sm text-red-300">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/**
 * Cast and crew in order: each row a person, their role and, for an actor, the character; rows move up and
 * down and go. People are added from a search, and the same person twice in one role is refused here.
 */
export function CreditsEditor({
  roles,
  disabled,
}: Readonly<{ roles: readonly CreditRole[]; disabled: boolean }>) {
  const { t } = useLocale();
  const form = useFormContext<ContentValues>();
  const credits = useFieldArray({ control: form.control, name: 'credits' });
  const [adding, setAdding] = useState(false);

  return (
    <section aria-labelledby="credits-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="credits-heading" className="font-display text-lg font-bold text-ink-strong">
          {t('admin.credits.title')}
        </h2>
        {!disabled && (
          <button
            type="button"
            className={buttonClass('secondary', 'sm')}
            onClick={() => {
              setAdding(true);
            }}
          >
            {t('admin.credits.add')}
          </button>
        )}
      </div>
      {credits.fields.length === 0 ? (
        <p className="text-ink-muted">{t('admin.credits.empty')}</p>
      ) : (
        <ol className="flex flex-col divide-y divide-line rounded-md border border-line">
          {credits.fields.map((field, index) => (
            <CreditRow
              key={field.id}
              index={index}
              last={index === credits.fields.length - 1}
              roles={roles}
              disabled={disabled}
              onMove={(to) => {
                credits.move(index, to);
              }}
              onRemove={() => {
                credits.remove(index);
              }}
            />
          ))}
        </ol>
      )}
      {adding && (
        <PersonPicker
          roles={roles}
          taken={(personId, role) =>
            form.getValues('credits').some((credit) => credit.personId === personId && credit.role === role)
          }
          onPick={(person, role) => {
            credits.append({ personId: person.id, personName: person.name, role, characterName: '' });
            setAdding(false);
          }}
          onClose={() => {
            setAdding(false);
          }}
        />
      )}
    </section>
  );
}

/** The form path of a credit row (React Hook Form names list items by their place). */
const creditPath = (index: number) => `credits.${index.toString()}` as `credits.${number}`;

function CreditRow({
  index,
  last,
  roles,
  disabled,
  onMove,
  onRemove,
}: Readonly<{
  index: number;
  last: boolean;
  roles: readonly CreditRole[];
  disabled: boolean;
  onMove: (to: number) => void;
  onRemove: () => void;
}>) {
  const { t } = useLocale();
  const form = useFormContext<ContentValues>();
  const credit = useWatch({ control: form.control, name: creditPath(index) });
  const name = credit.personName;
  // A role this kind of title does not offer (a creator on a movie from older data) stays choosable.
  const choices = roles.includes(credit.role) ? roles : [...roles, credit.role];
  const roleLabel = (role: CreditRole) => t(role === 'Actor' ? 'admin.credits.Actor' : `credits.${role}`);
  const characterError = messageOf(t, form.formState.errors.credits?.[index]?.characterName?.message);

  return (
    <li className="grid items-center gap-2 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1fr)_auto] sm:gap-3">
      <span className="min-w-0 font-semibold break-words text-ink-strong">{name}</span>
      <select
        aria-label={t('admin.credits.roleOf').replace('{name}', name)}
        disabled={disabled}
        className="h-9 rounded-md border border-line bg-surface-raised px-2 text-ink-strong focus-visible:outline-3 focus-visible:outline-focus"
        {...form.register(`${creditPath(index)}.role`)}
      >
        {choices.map((role) => (
          <option key={role} value={role}>
            {roleLabel(role)}
          </option>
        ))}
      </select>
      {credit.role === 'Actor' ? (
        <span className="flex min-w-0 flex-col">
          <input
            aria-label={t('admin.credits.characterOf').replace('{name}', name)}
            aria-invalid={characterError ? true : undefined}
            placeholder={t('admin.credits.character')}
            disabled={disabled}
            className="h-9 rounded-md border border-line bg-surface-raised px-2 text-ink-strong focus-visible:outline-3 focus-visible:outline-focus"
            {...form.register(`${creditPath(index)}.characterName`)}
          />
          {characterError && <span className="text-sm text-red-300">{characterError}</span>}
        </span>
      ) : (
        <span aria-hidden="true" className="hidden sm:block" />
      )}
      {!disabled && (
        <span className="flex gap-1">
          <button
            type="button"
            className={buttonClass('ghost', 'sm')}
            aria-label={t('admin.credits.up').replace('{name}', name)}
            disabled={index === 0}
            onClick={() => {
              onMove(index - 1);
            }}
          >
            ↑
          </button>
          <button
            type="button"
            className={buttonClass('ghost', 'sm')}
            aria-label={t('admin.credits.down').replace('{name}', name)}
            disabled={last}
            onClick={() => {
              onMove(index + 1);
            }}
          >
            ↓
          </button>
          <button
            type="button"
            className={buttonClass('ghost', 'sm')}
            aria-label={t('admin.credits.remove').replace('{name}', name)}
            onClick={onRemove}
          >
            ✕
          </button>
        </span>
      )}
    </li>
  );
}

/** Finds a person by name and adds them in the chosen role. */
function PersonPicker({
  roles,
  taken,
  onPick,
  onClose,
}: Readonly<{
  roles: readonly CreditRole[];
  taken: (personId: string, role: CreditRole) => boolean;
  onPick: (person: { id: string; name: string }, role: CreditRole) => void;
  onClose: () => void;
}>) {
  const { t } = useLocale();
  const searchId = useId();
  const roleId = useId();
  const [role, setRole] = useState<CreditRole>('Actor');
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [duplicate, setDuplicate] = useState(false);
  const people = usePeople(search, 1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(text.trim());
    }, searchDelayMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [text]);

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
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[85dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg bg-surface p-6 shadow-xl"
        >
          <Dialog.Title className="font-display text-xl font-bold text-ink-strong">
            {t('admin.credits.add')}
          </Dialog.Title>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={roleId} className="text-sm font-semibold text-ink-strong">
              {t('admin.credits.role')}
            </label>
            <select
              id={roleId}
              value={role}
              onChange={(event) => {
                setDuplicate(false);
                setRole(roles.find((value) => value === event.target.value) ?? 'Actor');
              }}
              className="h-11 rounded-md border border-line bg-surface-raised px-3 text-ink-strong focus-visible:outline-3 focus-visible:outline-focus"
            >
              {roles.map((value) => (
                <option key={value} value={value}>
                  {t(value === 'Actor' ? 'admin.credits.Actor' : `credits.${value}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={searchId} className="text-sm font-semibold text-ink-strong">
              {t('admin.people.search')}
            </label>
            <input
              id={searchId}
              type="search"
              value={text}
              onChange={(event) => {
                setText(event.target.value);
              }}
              className="h-11 rounded-md border border-line bg-surface-raised px-3 text-ink-strong focus-visible:outline-3 focus-visible:outline-focus"
            />
          </div>
          {duplicate && (
            <p role="alert" className="text-sm text-red-300">
              {t('admin.credits.duplicate')}
            </p>
          )}
          <div className="min-h-0 overflow-y-auto">
            {people.isPending ? (
              <p aria-busy="true" className="text-ink-muted">
                {t('browse.loading')}
              </p>
            ) : people.isError || people.data.items.length === 0 ? (
              <p className="text-ink-muted">{t('admin.credits.noMatch')}</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {people.data.items.map((person) => (
                  <li key={person.id}>
                    <button
                      type="button"
                      className="w-full rounded-md px-3 py-2 text-left hover:bg-white/10 focus-visible:outline-3 focus-visible:outline-focus"
                      onClick={() => {
                        if (taken(person.id, role)) {
                          setDuplicate(true);
                        } else {
                          onPick(person, role);
                        }
                      }}
                    >
                      {person.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Dialog.Close asChild>
            <button type="button" className={buttonClass('ghost')}>
              {t('admin.cancel')}
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
