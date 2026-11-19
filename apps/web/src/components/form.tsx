'use client';

import { classNames } from '@netboxplus/ui';
import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

/** The frame of the account pages: a centred card with its heading. */
export function AuthCard({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <main className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center">
      <section className="w-full max-w-md rounded-lg bg-surface p-6 shadow-lg sm:p-10">
        <h1 className="mb-6 font-display text-3xl font-bold text-ink-strong">{title}</h1>
        {children}
      </section>
    </main>
  );
}

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly label: string;
  readonly error?: string | undefined;
  readonly hint?: string | undefined;
}

/** A labelled input whose hint and error are announced with it. */
export function TextField({ label, error, hint, className, ...input }: TextFieldProps) {
  const id = useId();
  const described = [hint ? `${id}-hint` : undefined, error ? `${id}-error` : undefined]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classNames('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-semibold text-ink-strong">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={described || undefined}
        className={classNames(
          'h-12 rounded-md border bg-surface-raised px-3 text-ink-strong placeholder:text-ink-muted',
          'focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-focus',
          error ? 'border-red-400' : 'border-line',
        )}
        {...input}
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="text-sm text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

/** A message about the whole form, read out when it appears. */
export function FormAlert({ tone, children }: Readonly<{ tone: 'error' | 'success'; children: ReactNode }>) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={classNames(
        'rounded-md px-4 py-3 text-sm',
        tone === 'error' ? 'bg-red-950/60 text-red-100' : 'bg-brand-strong/30 text-ink-strong',
      )}
    >
      {children}
    </p>
  );
}
