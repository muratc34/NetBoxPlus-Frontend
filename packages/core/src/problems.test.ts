import { ApiError, readProblem } from '@netboxplus/api';
import { describe, expect, it } from 'vitest';
import { fieldMessageKeys, problemMessageKey } from './problems';

const problem = (status: number, body: unknown) => new ApiError(readProblem(status, body));

describe('problemMessageKey', () => {
  it("takes the text written for the backend's code", () => {
    expect(problemMessageKey(problem(400, { code: 'User.InvalidCredentials' }))).toBe(
      'error.User.InvalidCredentials',
    );
  });

  it('falls back by the kind of failure for codes without a text', () => {
    expect(problemMessageKey(problem(429, { code: 'Something.New' }))).toBe('error.RateLimit.Exceeded');
    expect(problemMessageKey(problem(503, {}))).toBe('error.unavailable');
    expect(problemMessageKey(problem(409, { code: 'Something.New' }))).toBe('error.unknown');
    expect(problemMessageKey(new TypeError('Failed to fetch'))).toBe('error.network');
  });

  it('never builds a key from anything but a code with a text', () => {
    expect(problemMessageKey(problem(400, { code: 'constructor' }))).toBe('error.unknown');
  });
});

describe('fieldMessageKeys', () => {
  it("maps each field's first code to its text, by the field's name in lower case", () => {
    const error = problem(400, {
      code: 'Validation.Failed',
      errorCodes: {
        Email: ['User.EmailInvalid'],
        NewPassword: ['User.PasswordTooShort', 'User.PasswordTooLong'],
        Other: ['Unknown.Code'],
      },
    });

    expect(fieldMessageKeys(error)).toEqual({
      email: 'error.User.EmailInvalid',
      newpassword: 'error.User.PasswordTooShort',
      other: 'error.invalidValue',
    });
    expect(fieldMessageKeys(new Error('not from the API'))).toEqual({});
  });
});
