'use client';

import type { TitleSummary } from '@netboxplus/core';
import { classNames } from '@netboxplus/ui';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocale } from '../../i18n/translator';
import { TitleCard } from './title-card';

const cardWidth = 'w-[70vw] shrink-0 snap-start sm:w-[40vw] md:w-[28vw] lg:w-[22vw] xl:w-[18vw]';
// A ranked card is the same size whatever its rank's width; the rank stands beside it.
const rankedCardWidth = 'w-[55vw] shrink-0 sm:w-[30vw] md:w-[21vw] lg:w-[16vw] xl:w-[13vw]';

/** A heading and its titles in one line: swiped on touch, scrolled with the arrows on a desktop. */
export function TitleRow({
  heading,
  titles,
  ranked = false,
}: Readonly<{
  heading: string;
  titles: readonly TitleSummary[];
  /** Top 10: a large rank beside each card, and the rank read out before the title. */
  ranked?: boolean;
}>) {
  const { t } = useLocale();

  return (
    <RowFrame heading={heading}>
      {titles.map((title, index) =>
        ranked ? (
          <li key={title.id} className="flex shrink-0 snap-start items-end">
            <span
              aria-hidden="true"
              className="-mr-3 font-display text-[5.5rem] leading-none font-extrabold text-canvas [-webkit-text-stroke:2px_var(--color-ink-muted)] sm:text-[7rem]"
            >
              {index + 1}
            </span>
            <TitleCard
              title={title}
              label={t('browse.rank').replace('{rank}', String(index + 1))}
              className={rankedCardWidth}
            />
          </li>
        ) : (
          <li key={title.id} className={cardWidth}>
            <TitleCard title={title} />
          </li>
        ),
      )}
    </RowFrame>
  );
}

/** The cards' place while a row's titles load, the same height so nothing jumps. */
export function TitleRowSkeleton({ heading }: Readonly<{ heading: string }>) {
  const { t } = useLocale();
  return (
    <RowFrame heading={heading} busy>
      {Array.from({ length: 6 }, (_, index) => (
        <li key={index} className={cardWidth} aria-hidden="true">
          <span className="block aspect-video animate-pulse rounded-md bg-surface-raised motion-reduce:animate-none" />
          <span className="mt-2 block h-5 w-2/3 animate-pulse rounded-sm bg-surface motion-reduce:animate-none" />
        </li>
      ))}
      <li className="sr-only">{t('browse.loading')}</li>
    </RowFrame>
  );
}

function RowFrame({
  heading,
  busy = false,
  children,
}: Readonly<{ heading: string; busy?: boolean; children: ReactNode }>) {
  const { t } = useLocale();
  const scroller = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const measure = useCallback(() => {
    const list = scroller.current;
    if (!list) {
      return;
    }
    setEdges({
      start: list.scrollLeft <= 1,
      end: list.scrollLeft + list.clientWidth >= list.scrollWidth - 1,
    });
  }, []);

  useEffect(() => {
    const list = scroller.current;
    if (!list) {
      return;
    }
    // Also called once right after observing, which gives the first measurement.
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    list.addEventListener('scroll', measure, { passive: true });
    return () => {
      observer.disconnect();
      list.removeEventListener('scroll', measure);
    };
  }, [measure]);

  const scroll = (direction: 1 | -1) => {
    const list = scroller.current;
    if (!list) {
      return;
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    list.scrollBy({ left: direction * list.clientWidth * 0.9, behavior: reduced ? 'auto' : 'smooth' });
  };

  const arrow =
    'absolute top-4 bottom-12 z-20 hidden w-12 items-center justify-center bg-canvas/70 text-3xl text-white ' +
    'opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 hover:bg-canvas/90 ' +
    'focus-visible:outline-3 focus-visible:outline-focus md:flex';

  return (
    <section aria-label={heading} aria-busy={busy || undefined} className="group/row relative">
      <h2 className="px-4 font-display text-lg font-bold text-ink-strong sm:px-8 sm:text-xl">{heading}</h2>
      <ul
        ref={scroller}
        className="flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 py-4 [scrollbar-width:none] sm:scroll-px-8 sm:px-8"
      >
        {children}
      </ul>
      {!edges.start && (
        <button
          type="button"
          className={classNames(arrow, 'left-0')}
          onClick={() => {
            scroll(-1);
          }}
        >
          <span aria-hidden="true">‹</span>
          <span className="sr-only">{t('browse.previous')}</span>
        </button>
      )}
      {!edges.end && (
        <button
          type="button"
          className={classNames(arrow, 'right-0')}
          onClick={() => {
            scroll(1);
          }}
        >
          <span aria-hidden="true">›</span>
          <span className="sr-only">{t('browse.next')}</span>
        </button>
      )}
    </section>
  );
}
