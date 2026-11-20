import { useEffect } from 'react';
import { Link } from 'react-router';
import { buttonClass } from '../components/buttons';
import { TitleFilters, useTitleFilters } from '../components/title-filters';
import { seriesPageSize, useSeriesList } from '../data/series';
import { can, useAdminSession } from '../data/session';
import { useLocale } from '../i18n';
import { paths } from '../paths';
import { TitleList } from './title-list';

/**
 * The series, a page at a time, with how many seasons and episodes each has: searched by title and
 * filtered by status and genre, all in the address.
 */
export function SeriesListPage() {
  const { t } = useLocale();
  const session = useAdminSession();
  const filters = useTitleFilters();
  const series = useSeriesList({
    search: filters.search.search,
    status: filters.status,
    genreId: filters.genreId,
    page: filters.page,
  });

  useEffect(() => {
    document.title = t('admin.series.title');
  }, [t]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold text-ink-strong">{t('admin.series.title')}</h1>
        {can(session.data, 'catalog:series:write') && (
          <Link to={paths.newSeries} className={buttonClass('primary')}>
            {t('admin.series.new')}
          </Link>
        )}
      </div>
      <TitleFilters searchLabel={t('admin.series.search')} filters={filters} />
      <TitleList
        query={series}
        empty={t('admin.series.empty')}
        href={paths.seriesItem}
        extra={[
          { header: t('admin.series.seasonCount'), cell: (row) => row.seasonCount },
          { header: t('admin.series.episodeCount'), cell: (row) => row.episodeCount },
        ]}
        page={filters.page}
        pageSize={seriesPageSize}
        onPage={filters.toPage}
      />
    </>
  );
}
