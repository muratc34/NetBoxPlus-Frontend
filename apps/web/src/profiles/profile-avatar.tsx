import { classNames } from '@netboxplus/ui';

// White initials stay readable on each (the 700 shades pass 4.5:1 with white).
const palette = [
  'bg-sky-700',
  'bg-rose-700',
  'bg-amber-700',
  'bg-emerald-700',
  'bg-violet-700',
  'bg-teal-700',
];

/** The same colour for a profile wherever it appears: picked from its id. */
export function avatarColor(id: string): string {
  let hash = 0;
  for (const character of id) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return palette[hash % palette.length] ?? 'bg-sky-700';
}

/** The backend has no pictures: a coloured tile with the name's first letter. Decorative, the name is next to it. */
export function ProfileAvatar({
  id,
  name,
  className,
}: Readonly<{ id: string; name: string; className?: string }>) {
  return (
    <span
      aria-hidden="true"
      className={classNames(
        'flex items-center justify-center rounded-md font-display font-bold text-white select-none',
        avatarColor(id),
        className,
      )}
    >
      {Array.from(name)[0]?.toLocaleUpperCase() ?? '?'}
    </span>
  );
}
