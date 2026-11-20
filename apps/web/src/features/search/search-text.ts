import { maxSearchLength } from '@netboxplus/core/reads';

/** The text of `?q=`, trimmed and cut to what Catalog accepts. */
export function searchText(value: string | string[] | undefined): string {
  const text = (Array.isArray(value) ? value[0] : value) ?? '';
  return text.trim().slice(0, maxSearchLength);
}
