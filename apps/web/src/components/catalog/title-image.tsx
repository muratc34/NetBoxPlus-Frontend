import { classNames } from '@netboxplus/ui';
import Image from 'next/image';
import { gridSizes, mediaSource } from './media';

/**
 * A title's wide (16:9) or tall (2:3) image. Decorative: the title is always written next to it. Without
 * an image, a tile with the title keeps the layout. Catalog keeps one size per image; Next's optimizer
 * resizes it through the web app's /media route to the width `sizes` says is drawn (a card's by default,
 * the whole screen for the page's largest paint).
 */
export function TitleImage({
  url,
  title,
  shape = 'wide',
  priority = false,
  eager = false,
  sizes,
  className,
}: Readonly<{
  url: string | null | undefined;
  title: string;
  shape?: 'wide' | 'tall';
  /** For the image that is the page's largest paint (the billboard): loaded first, not lazily. */
  priority?: boolean;
  /** Above the fold without being the largest paint (a grid's first cards): not lazy, but not first. */
  eager?: boolean;
  /** How wide it is drawn, for the optimizer; a grid card's width unless it is the page's largest paint. */
  sizes?: string;
  className?: string;
}>) {
  const frame = classNames(
    'block w-full bg-surface-raised object-cover',
    shape === 'wide' ? 'aspect-video' : 'aspect-[2/3]',
    className,
  );

  if (!url) {
    return (
      <span
        aria-hidden="true"
        className={classNames(
          frame,
          'flex items-center justify-center bg-linear-to-br from-surface-raised to-brand-strong/40 p-3 text-center font-display font-bold text-ink-strong',
        )}
      >
        {title}
      </span>
    );
  }

  const local = mediaSource(url);
  return (
    <Image
      src={local ?? url}
      alt=""
      width={shape === 'wide' ? 640 : 400}
      height={shape === 'wide' ? 360 : 600}
      unoptimized={local === undefined}
      sizes={sizes ?? (priority ? '100vw' : gridSizes)}
      preload={priority}
      // `preload` alone leaves the request at the browser's low priority for images.
      fetchPriority={priority ? 'high' : undefined}
      loading={priority || eager ? 'eager' : 'lazy'}
      className={frame}
    />
  );
}
