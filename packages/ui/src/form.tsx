'use client';

import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { classNames } from './class-names';

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

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  readonly label: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly error?: string | undefined;
  readonly hint?: string | undefined;
}

/** A labelled native select: the platform's own picker, keyboard and screen reader support. */
export function SelectField({ label, options, error, hint, className, ...select }: SelectFieldProps) {
  const id = useId();
  const described = [hint ? `${id}-hint` : undefined, error ? `${id}-error` : undefined]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classNames('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-semibold text-ink-strong">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={described || undefined}
        className={classNames(
          'h-12 rounded-md border bg-surface-raised px-3 text-ink-strong',
          'focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-focus',
          error ? 'border-red-400' : 'border-line',
        )}
        {...select}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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

export interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  readonly label: string;
  readonly error?: string | undefined;
  readonly hint?: string | undefined;
}

/** A labelled multi-line field, for longer texts such as a synopsis. */
export function TextAreaField({ label, error, hint, className, ...area }: TextAreaFieldProps) {
  const id = useId();
  const described = [hint ? `${id}-hint` : undefined, error ? `${id}-error` : undefined]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classNames('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-semibold text-ink-strong">
        {label}
      </label>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={described || undefined}
        rows={4}
        className={classNames(
          'rounded-md border bg-surface-raised px-3 py-2 text-ink-strong placeholder:text-ink-muted',
          'focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-focus',
          error ? 'border-red-400' : 'border-line',
        )}
        {...area}
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
