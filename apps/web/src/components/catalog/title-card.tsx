'use client';

import type { TitleSummary } from '@netboxplus/core';
import { classNames } from '@netboxplus/ui';
import Link from 'next/link';
import { useLocale } from '../../i18n/translator';
import { routes } from '../../routes';
import { TitleFacts } from './title-facts';
import { TitleImage } from './title-image';

/**
 * A wide card that opens the title's page. Where the pointer can hover (Tailwind's `hover:` applies only
 * there), resting on it for half a second, or focusing it from the keyboard, grows it and shows the year,
 * rating and genres; on touch a tap opens the page. Growing is left out when the visitor asks for less motion.
 */
export function TitleCard({
  title,
  label,
  className,
}: Readonly<{
  title: TitleSummary;
  /** Read before the title, such as a Top 10 rank. */
  label?: string;
  className?: string;
}>) {
  const { locale } = useLocale();

  return (
    <Link
      href={routes.title(locale, title.kind, title.id)}
      className={classNames(
        'group relative flex flex-col rounded-md outline-none focus-visible:ring-3 focus-visible:ring-focus',
        'motion-safe:transition-transform motion-safe:duration-200',
        'hover:z-10 hover:delay-500 motion-safe:hover:scale-110',
        'focus-visible:z-10 motion-safe:focus-visible:scale-110',
        className,
      )}
    >
      {/* First in the markup, so it is what a screen reader reads first; drawn under the image. */}
      <span className="order-2 mt-2 block truncate text-sm font-semibold text-ink-strong">
        {label && <span className="sr-only">{label}: </span>}
        {title.title}
      </span>
      <span className="relative order-1 block overflow-hidden rounded-md">
        <TitleImage url={title.backdropUrl ?? title.posterUrl} title={title.title} />
        <span
          className={classNames(
            'absolute inset-x-0 bottom-0 bg-linear-to-t from-black/90 via-black/60 to-transparent px-3 pt-8 pb-2',
            'opacity-0 transition-opacity group-hover:opacity-100 group-hover:delay-500',
            'group-focus-visible:opacity-100',
          )}
        >
          <TitleFacts year={title.releaseYear} rating={title.ageRating} genres={title.genres} />
        </span>
      </span>
    </Link>
  );
}
