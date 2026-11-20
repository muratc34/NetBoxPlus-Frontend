/**
 * The site's public address (`SITE_URL`), for absolute links in meta tags and the sitemap. Locally the
 * development server's address.
 */
export function siteUrl(env: Readonly<Record<string, string | undefined>> = process.env): URL {
  const value = env.SITE_URL?.length ? env.SITE_URL : 'http://localhost:5173';
  try {
    return new URL(value);
  } catch {
    throw new Error(
      `SITE_URL must be an absolute address such as https://app.netboxplus.dev, not "${value}".`,
    );
  }
}
