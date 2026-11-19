import { fieldMessageKeys, problemMessageKey } from '@netboxplus/core';
import { hasMessage, type MessageKey } from '@netboxplus/i18n';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { z } from 'zod';

// The backend decides; these only catch what can be told before sending (Auth's PasswordPolicy: 12–128).
export const passwordMinLength = 12;
export const passwordMaxLength = 128;

export const email = z
  .string()
  .trim()
  .min(1, 'validation.required')
  .pipe(z.email({ error: 'validation.emailInvalid' }));

export const password = z
  .string()
  .min(passwordMinLength, 'validation.passwordTooShort')
  .max(passwordMaxLength, 'validation.passwordTooLong');

/** Rules carry message keys; this turns one into the text, or nothing. */
export function messageOf(t: (key: MessageKey) => string, message: string | undefined): string | undefined {
  if (message === undefined) {
    return undefined;
  }
  return hasMessage(message) ? t(message) : t('error.invalidValue');
}

/**
 * Puts a failed request's messages on the form: per field where the backend named one the form has
 * (matched without case: `NewPassword` is `newPassword`), else as the form's own message.
 */
export function showProblem<Values extends FieldValues>(
  error: unknown,
  fields: readonly Path<Values>[],
  setError: UseFormSetError<Values>,
) {
  let placed = false;
  for (const [field, key] of Object.entries(fieldMessageKeys(error))) {
    const match = fields.find((name) => name.toLowerCase() === field);
    if (match) {
      setError(match, { type: 'server', message: key });
      placed = true;
    }
  }

  if (!placed) {
    setError('root', { type: 'server', message: problemMessageKey(error) });
  }
}
