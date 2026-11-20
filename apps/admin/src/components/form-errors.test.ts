import { ApiError } from '@netboxplus/api';
import { createTranslator } from '@netboxplus/i18n';
import { describe, expect, it, vi } from 'vitest';
import { messageOf, showProblem } from './form-errors';

function validation(errorCodes: Record<string, string[]>, code = 'Validation.Failed') {
  return new ApiError({
    status: 400,
    code,
    title: undefined,
    detail: undefined,
    type: undefined,
    fieldErrors: {},
    fieldErrorCodes: errorCodes,
  });
}

describe('showProblem', () => {
  it('puts each named field error on its field, whatever its case', () => {
    const setError = vi.fn();

    showProblem(
      validation({ BioTr: ['Person.BiographyTooLong'], Name: ['Person.NameTooLong'] }),
      ['name', 'bioTr'],
      setError,
    );

    expect(setError.mock.calls).toEqual([
      ['bioTr', { type: 'server', message: 'error.Person.BiographyTooLong' }],
      ['name', { type: 'server', message: 'error.Person.NameTooLong' }],
    ]);
  });

  it('puts a problem without a known field on the form', () => {
    const setError = vi.fn();

    showProblem(validation({ Other: ['Person.NameTooLong'] }, 'Person.NotFound'), ['name'], setError);

    expect(setError.mock.calls).toEqual([['root', { type: 'server', message: 'error.Person.NotFound' }]]);
  });

  it('puts a code on the field it is mapped to', () => {
    const setError = vi.fn();

    showProblem(validation({}, 'Genre.NameTaken'), ['tr'], setError, { 'Genre.NameTaken': 'tr' });

    expect(setError.mock.calls).toEqual([['tr', { type: 'server', message: 'error.Genre.NameTaken' }]]);
  });
});

describe('messageOf', () => {
  const t = createTranslator('tr');

  it('turns a message key into its text and anything else into a general one', () => {
    expect(messageOf(t, 'validation.required')).toBe('Bu alan zorunlu.');
    expect(messageOf(t, 'not.a.key')).toBe(t('error.invalidValue'));
    expect(messageOf(t, undefined)).toBeUndefined();
  });
});
