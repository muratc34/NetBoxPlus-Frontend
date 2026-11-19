import { isApiError } from '@netboxplus/api';
import { hasMessage, type MessageKey } from '@netboxplus/i18n';

/**
 * The text to show for a failed request: the one written for the backend's error code
 * (`error.User.EmailTaken`), else one for the kind of failure. `detail` from the backend is for
 * developers and never shown.
 */
export function problemMessageKey(error: unknown): MessageKey {
  if (!isApiError(error)) {
    return 'error.network';
  }

  const key = error.code === undefined ? undefined : `error.${error.code}`;
  if (key !== undefined && hasMessage(key)) {
    return key;
  }

  if (error.status === 429) {
    return 'error.RateLimit.Exceeded';
  }

  return error.status >= 500 ? 'error.unavailable' : 'error.unknown';
}

/**
 * The text per form field for a validation problem, keyed by the field's name in lower case (the
 * backend names fields after its own properties: `Email`, `NewPassword`). The first code of a field wins.
 */
export function fieldMessageKeys(error: unknown): Readonly<Record<string, MessageKey>> {
  if (!isApiError(error)) {
    return {};
  }

  const result: Record<string, MessageKey> = {};
  for (const [field, codes] of Object.entries(error.problem.fieldErrorCodes)) {
    const key = codes[0] === undefined ? undefined : `error.${codes[0]}`;
    result[field.toLowerCase()] = key !== undefined && hasMessage(key) ? key : 'error.invalidValue';
  }
  return result;
}
