/** Joins the class names that are set, skipping empty and false values. */
export function classNames(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}
