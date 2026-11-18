import type { ButtonHTMLAttributes } from 'react';
import { classNames } from './class-names';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2.5 rounded-md font-semibold transition-colors ' +
  'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-brand-strong text-white hover:bg-brand-strong-hover',
  secondary: 'bg-white/15 text-white hover:bg-white/25',
  ghost: 'bg-transparent text-ink hover:bg-white/10',
};

const sizes: Record<ButtonSize, string> = {
  md: 'h-11 px-5 text-[15px]',
  lg: 'h-12 px-6 text-base',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** A button that is never a form submit unless asked: `type` defaults to `button`. */
export function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  className,
  ...props
}: ButtonProps) {
  return (
    <button type={type} className={classNames(base, variants[variant], sizes[size], className)} {...props} />
  );
}
