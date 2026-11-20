import { SelectField } from '@netboxplus/ui';
import { useId } from 'react';
import { useSearchParams } from 'react-router';
import { useGenres } from '../data/catalog';
import type { PublicationStatus } from '../data/movies';
import { useLocale } from '../i18n';
import { pageOf, useAddressSearch } from './address-search';

const statuses: readonly PublicationStatus[] = ['Draft', 'Published'];

function statusOf(value: string | null): PublicationStatus | undefined {
  return statuses.find((status) => status === value);
}

/**
 * A title list's search, status, genre and page, all in the address (`?search=&status=&genreId=&page=`) so
 * the list can be linked and comes back the same. A changed filter goes back to the first page; an unknown
 * status is no filter.
 */
export function useTitleFilters() {
  const [params, setParams] = useSearchParams();
  const search = useAddressSearch();

  /** Sets one filter (empty removes it) and goes back to the first page. */
  function filter(name: 'status' | 'genreId', value: string) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('page');
      if (value) {
        next.set(name, value);
      } else {
        next.delete(name);
      }
      return next;
    });
  }

  return {
    search,
    filter,
    status: statusOf(params.get('status')),
    genreId: params.get('genreId') ?? undefined,
    page: pageOf(params.get('page')),
    toPage: (page: number) => {
      setParams((current) => {
        const next = new URLSearchParams(current);
        next.set('page', String(page));
        return next;
      });
    },
  };
}

/** The search box and the status and genre filters above a title list. */
export function TitleFilters({
  searchLabel,
  filters,
}: Readonly<{ searchLabel: string; filters: ReturnType<typeof useTitleFilters> }>) {
  const { locale, t } = useLocale();
  const searchId = useId();
  const genres = useGenres();
  const { text, setText } = filters.search;

  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={searchId} className="text-sm font-semibold text-ink-strong">
          {searchLabel}
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
      <SelectField
        label={t('admin.filter.status')}
        value={filters.status ?? ''}
        options={[
          { value: '', label: t('admin.filter.all') },
          ...statuses.map((value) => ({ value, label: t(`admin.status.${value}`) })),
        ]}
        onChange={(event) => {
          filters.filter('status', event.target.value);
        }}
      />
      <SelectField
        label={t('admin.filter.genre')}
        value={filters.genreId ?? ''}
        options={[
          { value: '', label: t('admin.filter.all') },
          ...(genres.data ?? []).map((genre) => ({
            value: genre.id,
            label: genre.translations[locale] ?? genre.name,
          })),
        ]}
        onChange={(event) => {
          filters.filter('genreId', event.target.value);
        }}
      />
    </div>
  );
}
