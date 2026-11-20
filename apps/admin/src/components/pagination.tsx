import { useLocale } from '../i18n';
import { buttonClass } from './buttons';

/** Previous and next under a paged list, with where it is ("2 / 5"); nothing for a single page. */
export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: Readonly<{ page: number; pageSize: number; total: number; onPage: (page: number) => void }>) {
  const { t } = useLocale();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) {
    return null;
  }
  return (
    <nav aria-label={t('admin.pagination')} className="flex items-center gap-3">
      <button
        type="button"
        className={buttonClass('secondary', 'sm')}
        disabled={page <= 1}
        onClick={() => {
          onPage(page - 1);
        }}
      >
        {t('admin.previous')}
      </button>
      <span className="text-sm text-ink-muted">
        {t('admin.pageOf').replace('{page}', String(page)).replace('{pages}', String(pages))}
      </span>
      <button
        type="button"
        className={buttonClass('secondary', 'sm')}
        disabled={page >= pages}
        onClick={() => {
          onPage(page + 1);
        }}
      >
        {t('admin.next')}
      </button>
    </nav>
  );
}
