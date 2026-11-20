'use client';

import { useTitleRow, type TitleFilter } from '@netboxplus/core';
import { useEffect, useRef, useState } from 'react';
import { useLocale } from '../../i18n/translator';
import { TitleRow, TitleRowSkeleton } from './title-row';

/**
 * A row the server did not render: its titles are asked for when it comes near the screen, so a long page
 * of genres costs only the rows the visitor scrolls to. A row with no titles disappears.
 */
export function LazyTitleRow({ heading, filter }: Readonly<{ heading: string; filter: TitleFilter }>) {
  const { t } = useLocale();
  const anchor = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const row = useTitleRow(filter, near);

  useEffect(() => {
    const element = anchor.current;
    if (!element || near) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
        }
      },
      { rootMargin: '400px 0px' },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [near]);

  if (row.isError) {
    return (
      <section aria-label={heading} className="px-4 sm:px-8">
        <h2 className="font-display text-lg font-bold text-ink-strong sm:text-xl">{heading}</h2>
        <p className="py-4 text-sm text-ink-muted">{t('browse.rowFailed')}</p>
      </section>
    );
  }

  if (row.data) {
    return row.data.items.length > 0 ? <TitleRow heading={heading} titles={row.data.items} /> : null;
  }

  return (
    <div ref={anchor}>
      <TitleRowSkeleton heading={heading} />
    </div>
  );
}
