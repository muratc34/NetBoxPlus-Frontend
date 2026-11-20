import { classNames } from '@netboxplus/ui';

export type ButtonTone = 'primary' | 'secondary' | 'ghost' | 'danger';

const tones: Record<ButtonTone, string> = {
  primary: 'bg-brand-strong text-white hover:bg-brand-strong-hover',
  secondary: 'bg-white/15 text-white hover:bg-white/25',
  ghost: 'bg-transparent text-ink hover:bg-white/10',
  danger: 'bg-red-700 text-white hover:bg-red-600',
};

/** The look of a button or of a link that acts as one. */
export function buttonClass(tone: ButtonTone, size: 'md' | 'sm' = 'md'): string {
  return classNames(
    'inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors',
    'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus',
    'disabled:cursor-not-allowed disabled:opacity-50',
    size === 'md' ? 'h-11 px-5 text-[15px]' : 'h-9 px-3 text-sm',
    tones[tone],
  );
}
