import { problemMessageKey } from '@netboxplus/core';
import { SelectField } from '@netboxplus/ui';
import { useEffect, useId } from 'react';
import { Link, useSearchParams } from 'react-router';
import { pageOf, useAddressSearch } from '../components/address-search';
import { buttonClass } from '../components/buttons';
import { Pagination } from '../components/pagination';
import { StatusBadge } from '../components/status-badge';
import { useGenres } from '../data/catalog';
import { moviesPageSize, useMovies, type PublicationStatus } from '../data/movies';
import { can, useAdminSession } from '../data/session';
import { useLocale } from '../i18n';
import { paths } from '../paths';

const statuses: readonly PublicationStatus[] = ['Draft', 'Published'];

function statusOf(value: string | null): PublicationStatus | undefined {
  return statuses.find((status) => status === value);
}

/**
 * The movies, a page at a time: searched by title and filtered by status and genre, all in the address so
 * the list can be linked and comes back the same.
 */
export function MoviesPage() {
  const { locale, t } = useLocale();
  const searchId = useId();
  const session = useAdminSession();
  const [params, setParams] = useSearchParams();
  const { text, setText, search } = useAddressSearch();
  const status = statusOf(params.get('status'));
  const genreId = params.get('genreId') ?? undefined;
  const page = pageOf(params.get('page'));
  const movies = useMovies({ search, status, genreId, page });
  const genres = useGenres();

  useEffect(() => {
    document.title = t('admin.movies.title');
  }, [t]);

  /** Sets one filter (empty removes it) and goes back to the first page. */
  function filter(name: string, value: string) {
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

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold text-ink-strong">{t('admin.movies.title')}</h1>
        {can(session.data, 'catalog:movies:write') && (
          <Link to={paths.newMovie} className={buttonClass('primary')}>
            {t('admin.movies.new')}
          </Link>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={searchId} className="text-sm font-semibold text-ink-strong">
            {t('admin.movies.search')}
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
          value={status ?? ''}
          options={[
            { value: '', label: t('admin.filter.all') },
            ...statuses.map((value) => ({ value, label: t(`admin.status.${value}`) })),
          ]}
          onChange={(event) => {
            filter('status', event.target.value);
          }}
        />
        <SelectField
          label={t('admin.filter.genre')}
          value={genreId ?? ''}
          options={[
            { value: '', label: t('admin.filter.all') },
            ...(genres.data ?? []).map((genre) => ({
              value: genre.id,
              label: genre.translations[locale] ?? genre.name,
            })),
          ]}
          onChange={(event) => {
            filter('genreId', event.target.value);
          }}
        />
      </div>

      {movies.isPending ? (
        <p aria-busy="true" className="text-ink-muted">
          {t('browse.loading')}
        </p>
      ) : movies.isError ? (
        <p role="alert" className="text-ink-muted">
          {t(problemMessageKey(movies.error))}
        </p>
      ) : movies.data.items.length === 0 ? (
        <p className="text-ink-muted">{t('admin.movies.empty')}</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="text-ink-muted">
                <tr className="border-b border-line">
                  <th scope="col" className="px-4 py-3 font-normal">
                    {t('admin.content.title')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-normal">
                    {t('admin.content.releaseYear')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-normal">
                    {t('admin.content.ageRating')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-normal">
                    {t('admin.content.genres')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-normal">
                    {t('admin.content.status')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {movies.data.items.map((movie) => (
                  <tr key={movie.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        to={paths.movie(movie.id)}
                        className="flex items-center gap-3 font-semibold text-ink-strong hover:underline focus-visible:outline-3 focus-visible:outline-focus"
                      >
                        {movie.posterUrl ? (
                          <img src={movie.posterUrl} alt="" className="h-12 w-8 rounded object-cover" />
                        ) : (
                          <span aria-hidden="true" className="h-12 w-8 rounded bg-white/10" />
                        )}
                        {movie.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{movie.releaseYear}</td>
                    <td className="px-4 py-3">{t(`age.${movie.ageRating}`)}</td>
                    <td className="px-4 py-3">{movie.genres.map((genre) => genre.name).join(', ')}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={movie.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={moviesPageSize}
            total={movies.data.totalCount}
            onPage={(next) => {
              setParams((current) => {
                const updated = new URLSearchParams(current);
                updated.set('page', String(next));
                return updated;
              });
            }}
          />
        </>
      )}
    </>
  );
}
