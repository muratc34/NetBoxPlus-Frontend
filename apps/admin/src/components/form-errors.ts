import { isApiError } from '@netboxplus/api';
import { fieldMessageKeys, problemMessageKey } from '@netboxplus/core';
import { hasMessage, type MessageKey } from '@netboxplus/i18n';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

/** Rules carry message keys; this turns one into the text, or nothing. */
export function messageOf(t: (key: MessageKey) => string, message: string | undefined): string | undefined {
  if (message === undefined) {
    return undefined;
  }
  return hasMessage(message) ? t(message) : t('error.invalidValue');
}

/**
 * Puts a failed request's message on the form: on the field `byCode` names for its code, else per field
 * the backend named (without case), else as the form's own message.
 */
export function showProblem<Values extends FieldValues>(
  error: unknown,
  fields: readonly Path<Values>[],
  setError: UseFormSetError<Values>,
  byCode: Readonly<Record<string, Path<Values>>> = {},
) {
  const field = isApiError(error) && error.code !== undefined ? byCode[error.code] : undefined;
  if (field) {
    setError(field, { type: 'server', message: problemMessageKey(error) });
    return;
  }

  let placed = false;
  for (const [name, key] of Object.entries(fieldMessageKeys(error))) {
    const match = fields.find((candidate) => candidate.toLowerCase() === name);
    if (match) {
      setError(match, { type: 'server', message: key });
      placed = true;
    }
  }
  if (!placed) {
    setError('root', { type: 'server', message: problemMessageKey(error) });
  }
}
