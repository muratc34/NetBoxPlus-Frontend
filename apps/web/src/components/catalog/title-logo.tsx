import { classNames } from '@netboxplus/ui';
import Image from 'next/image';
import { mediaSource } from './media';

/**
 * A title's logo: its name as designed for it, drawn over its image as streaming services do. `alt` is the
 * name where the logo stands for it (a heading), empty where the name is written next to it (a card).
 * Transparent, so it is never stretched or cropped: it keeps its own shape inside the box it is given.
 */
export function TitleLogo({
  url,
  alt,
  sizes,
  priority = false,
  className,
}: Readonly<{
  url: string;
  alt: string;
  /** How wide it may be drawn, for the optimizer. */
  sizes: string;
  /** Part of the page's first paint (the billboard, a title's page). */
  priority?: boolean;
  className?: string;
}>) {
  const local = mediaSource(url);
  return (
    <Image
      src={local ?? url}
      alt={alt}
      // The real shape is the file's; these only give the optimizer a size to start from.
      width={800}
      height={300}
      unoptimized={local === undefined}
      sizes={sizes}
      preload={priority}
      loading={priority ? 'eager' : 'lazy'}
      className={classNames(
        'h-auto w-auto object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.75)]',
        className,
      )}
    />
  );
}
