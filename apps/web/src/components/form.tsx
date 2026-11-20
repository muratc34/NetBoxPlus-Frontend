'use client';

import type { ReactNode } from 'react';

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

export {
  FormAlert,
  SelectField,
  TextField,
  type SelectFieldProps,
  type TextFieldProps,
} from '@netboxplus/ui';
