import { classNames } from '@netboxplus/ui';
import Image from 'next/image';

/**
 * A title's wide (16:9) or tall (2:3) image. Decorative: the title is always written next to it. Without
 * an image, a tile with the title keeps the layout. `unoptimized`: Catalog keeps one size per image, and in
 * containers the web server cannot reach the storage address the browser uses, so Next's optimizer is out.
 */
export function TitleImage({
  url,
  title,
  shape = 'wide',
  priority = false,
  className,
}: Readonly<{
  url: string | null | undefined;
  title: string;
  shape?: 'wide' | 'tall';
  /** For the image that is the page's largest paint (the billboard): loaded first, not lazily. */
  priority?: boolean;
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

  return (
    <Image
      src={url}
      alt=""
      width={shape === 'wide' ? 640 : 400}
      height={shape === 'wide' ? 360 : 600}
      unoptimized
      preload={priority}
      loading={priority ? 'eager' : 'lazy'}
      className={frame}
    />
  );
}
