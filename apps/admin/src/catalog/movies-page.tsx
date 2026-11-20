import { useEffect } from 'react';
import { Link } from 'react-router';
import { buttonClass } from '../components/buttons';
import { TitleFilters, useTitleFilters } from '../components/title-filters';
import { moviesPageSize, useMovies } from '../data/movies';
import { can, useAdminSession } from '../data/session';
import { useLocale } from '../i18n';
import { paths } from '../paths';
import { TitleList } from './title-list';

/**
 * The movies, a page at a time: searched by title and filtered by status and genre, all in the address so
 * the list can be linked and comes back the same.
 */
export function MoviesPage() {
  const { t } = useLocale();
  const session = useAdminSession();
  const filters = useTitleFilters();
  const movies = useMovies({
    search: filters.search.search,
    status: filters.status,
    genreId: filters.genreId,
    page: filters.page,
  });

  useEffect(() => {
    document.title = t('admin.movies.title');
  }, [t]);

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
      <TitleFilters searchLabel={t('admin.movies.search')} filters={filters} />
      <TitleList
        query={movies}
        empty={t('admin.movies.empty')}
        href={paths.movie}
        page={filters.page}
        pageSize={moviesPageSize}
        onPage={filters.toPage}
      />
    </>
  );
}
