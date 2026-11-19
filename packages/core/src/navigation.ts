const probe = 'http://next.invalid';

/**
 * A `next` address from the query string, if it stays on this site: a path, never another origin
 * (`//evil.example`, `/\evil.example`, `https://…`). Anything else is dropped, so a crafted sign-in
 * link cannot send the visitor elsewhere after signing in.
 */
export function safeNextPath(value: string | null | undefined): string | undefined {
  if (!value?.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return undefined;
  }

  try {
    // The parser drops tabs and line breaks, which could turn "/\t/evil" into "//evil"; check what it made.
    const url = new URL(value, probe);
    return url.origin === probe ? url.pathname + url.search + url.hash : undefined;
  } catch {
    return undefined;
  }
}
