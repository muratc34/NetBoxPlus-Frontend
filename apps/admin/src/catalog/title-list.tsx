import { problemMessageKey } from '@netboxplus/core';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Pagination } from '../components/pagination';
import { StatusBadge } from '../components/status-badge';
import type { AgeRating, PublicationStatus } from '../data/movies';
import { useLocale } from '../i18n';

/** What a row of a title list shows, whichever kind of title. */
export interface TitleRow {
  readonly id: string;
  readonly title: string;
  readonly releaseYear: number;
  readonly ageRating: AgeRating;
  readonly status: PublicationStatus;
  readonly posterUrl: string | null;
  readonly genres: readonly { readonly name: string }[];
}

export interface ExtraColumn<Row> {
  readonly header: string;
  readonly cell: (row: Row) => ReactNode;
}

/**
 * A page of titles as a table: the poster and title linking to the title's page, year, age, genres, any
 * columns of the kind, and the status; then the pages.
 */
export function TitleList<Row extends TitleRow>({
  query,
  empty,
  href,
  extra = [],
  page,
  pageSize,
  onPage,
}: Readonly<{
  query: UseQueryResult<{ items: Row[]; totalCount: number }>;
  empty: string;
  href: (id: string) => string;
  extra?: readonly ExtraColumn<Row>[];
  page: number;
  pageSize: number;
  onPage: (page: number) => void;
}>) {
  const { t } = useLocale();

  if (query.isPending) {
    return (
      <p aria-busy="true" className="text-ink-muted">
        {t('browse.loading')}
      </p>
    );
  }
  if (query.isError) {
    return (
      <p role="alert" className="text-ink-muted">
        {t(problemMessageKey(query.error))}
      </p>
    );
  }
  if (query.data.items.length === 0) {
    return <p className="text-ink-muted">{empty}</p>;
  }

  const headers = [
    t('admin.content.title'),
    t('admin.content.releaseYear'),
    t('admin.content.ageRating'),
    t('admin.content.genres'),
    ...extra.map((column) => column.header),
    t('admin.content.status'),
  ];
  return (
    <>
      <div className="overflow-x-auto rounded-lg bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="text-ink-muted">
            <tr className="border-b border-line">
              {headers.map((header) => (
                <th key={header} scope="col" className="px-4 py-3 font-normal">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {query.data.items.map((row) => (
              <tr key={row.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <Link
                    to={href(row.id)}
                    className="flex items-center gap-3 font-semibold text-ink-strong hover:underline focus-visible:outline-3 focus-visible:outline-focus"
                  >
                    {row.posterUrl ? (
                      <img src={row.posterUrl} alt="" className="h-12 w-8 rounded object-cover" />
                    ) : (
                      <span aria-hidden="true" className="h-12 w-8 rounded bg-white/10" />
                    )}
                    {row.title}
                  </Link>
                </td>
                <td className="px-4 py-3 tabular-nums">{row.releaseYear}</td>
                <td className="px-4 py-3">{t(`age.${row.ageRating}`)}</td>
                <td className="px-4 py-3">{row.genres.map((genre) => genre.name).join(', ')}</td>
                {extra.map((column) => (
                  <td key={column.header} className="px-4 py-3 tabular-nums">
                    {column.cell(row)}
                  </td>
                ))}
                <td className="px-4 py-3">
                  <StatusBadge status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageSize={pageSize} total={query.data.totalCount} onPage={onPage} />
    </>
  );
}
