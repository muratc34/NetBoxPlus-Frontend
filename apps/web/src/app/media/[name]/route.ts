import { imageName } from '../../../components/catalog/media';

/**
 * A Catalog image from storage, for Next's optimizer (`/_next/image?url=/media/<name>`), which resizes it
 * to what the page draws. `CATALOG_IMAGES_URL` is the images container as this server reaches it, which in
 * containers is not the address the browser would use; the browser never asks storage for an image itself.
 * Only image names pass: the route reaches nothing else in storage.
 */
export const dynamic = 'force-dynamic';

const imageTypes = /^image\/(?:jpeg|png|webp)$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
): Promise<Response> {
  const { name } = await params;
  if (!imageName.test(name)) {
    return new Response(null, { status: 404 });
  }
  const base = process.env.CATALOG_IMAGES_URL;
  if (!base) {
    console.error('CATALOG_IMAGES_URL is not set: Catalog images cannot be served.');
    return new Response(null, { status: 503 });
  }

  const upstream = await fetch(`${base.replace(/\/+$/, '')}/${name}`, { cache: 'no-store' }).catch(
    () => undefined,
  );
  const type = upstream?.headers.get('content-type') ?? '';
  if (!upstream?.ok || !imageTypes.test(type)) {
    return new Response(null, { status: upstream?.status === 404 ? 404 : 502 });
  }
  // An image keeps its name for as long as it exists: a new one gets a new name.
  return new Response(upstream.body, {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
