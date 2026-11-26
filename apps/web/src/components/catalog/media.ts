/** A Catalog image's name in storage: its upload id and type, the same for as long as the image exists. */
export const imageName = /^[0-9a-f]{32}\.(?:jpe?g|png|webp)$/;

/**
 * Where the web app serves a Catalog image from (`/media/<name>`), for Next's optimizer to resize; or
 * nothing when the address is not one (then it is shown as it is).
 */
export function mediaSource(url: string): string | undefined {
  try {
    const name = new URL(url).pathname.split('/').pop() ?? '';
    return imageName.test(name) ? `/media/${name}` : undefined;
  } catch {
    return undefined;
  }
}

/** A card's width in a grid (`PagedGrid`'s columns: 2, 3 from sm, 4 from lg, 5 from xl). */
export const gridSizes = '(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw';
