import { describe, expect, it } from 'vitest';
import { ApiError, isApiError, readProblem, unwrap } from './errors';

describe('readProblem', () => {
  it('reads the standard members and the code', () => {
    const problem = readProblem(409, {
      type: 'https://netboxplus.dev/problems/user-email-taken',
      title: 'Conflict',
      status: 409,
      detail: 'The e-mail address is already in use.',
      code: 'User.EmailTaken',
    });

    expect(problem).toEqual({
      status: 409,
      code: 'User.EmailTaken',
      title: 'Conflict',
      detail: 'The e-mail address is already in use.',
      type: 'https://netboxplus.dev/problems/user-email-taken',
      fieldErrors: {},
      fieldErrorCodes: {},
    });
  });

  it('reads the messages and codes per field of a validation problem', () => {
    const problem = readProblem(400, {
      status: 400,
      code: 'Validation.Failed',
      errors: { email: ['Enter a valid e-mail address.'], password: ['Too short.', 'Needs a digit.'] },
      errorCodes: { email: ['Email.Invalid'], password: ['Password.TooShort', 'Password.NoDigit'] },
    });

    expect(problem.fieldErrors).toEqual({
      email: ['Enter a valid e-mail address.'],
      password: ['Too short.', 'Needs a digit.'],
    });
    expect(problem.fieldErrorCodes.password).toEqual(['Password.TooShort', 'Password.NoDigit']);
  });

  it('takes the status from the response, not from the body', () => {
    expect(readProblem(503, { status: 200 }).status).toBe(503);
  });

  it('yields an empty problem for a body that is not a problem', () => {
    for (const body of [undefined, null, 'Bad gateway', 42, ['code']]) {
      expect(readProblem(502, body)).toEqual({
        status: 502,
        code: undefined,
        title: undefined,
        detail: undefined,
        type: undefined,
        fieldErrors: {},
        fieldErrorCodes: {},
      });
    }
  });

  it('ignores members of the wrong type', () => {
    const problem = readProblem(400, {
      code: 7,
      title: '',
      errors: { email: 'not a list', name: [1, 'Required.'], other: [] },
      errorCodes: ['Email.Invalid'],
    });

    expect(problem.code).toBeUndefined();
    expect(problem.title).toBeUndefined();
    expect(problem.fieldErrors).toEqual({ name: ['Required.'] });
    expect(problem.fieldErrorCodes).toEqual({});
  });
});

describe('ApiError', () => {
  it('exposes the status and code, with the detail as its message', () => {
    const error = new ApiError(
      readProblem(403, { code: 'Playback.AgeRestricted', detail: 'Not for this profile.' }),
    );

    expect(error.status).toBe(403);
    expect(error.code).toBe('Playback.AgeRestricted');
    expect(error.message).toBe('Not for this profile.');
    expect(error.name).toBe('ApiError');
  });

  it('falls back to the title, then to the status, for its message', () => {
    expect(new ApiError(readProblem(429, { title: 'Too Many Requests' })).message).toBe('Too Many Requests');
    expect(new ApiError(readProblem(500, null)).message).toBe('The request failed with status 500.');
  });
});

describe('isApiError', () => {
  const error = new ApiError(readProblem(409, { code: 'MyList.Full' }));

  it('recognizes an ApiError, optionally by code', () => {
    expect(isApiError(error)).toBe(true);
    expect(isApiError(error, 'MyList.Full')).toBe(true);
    expect(isApiError(error, 'Data.Conflict')).toBe(false);
  });

  it('rejects other errors', () => {
    expect(isApiError(new Error('MyList.Full'))).toBe(false);
    expect(isApiError({ code: 'MyList.Full' }, 'MyList.Full')).toBe(false);
  });
});

describe('unwrap', () => {
  it('returns the data of a successful call', async () => {
    const data = await unwrap(
      Promise.resolve({ data: { id: '1' }, response: new Response(null, { status: 200 }) }),
    );

    expect(data).toEqual({ id: '1' });
  });

  it('turns an error status into an ApiError', async () => {
    const pending = unwrap(
      Promise.resolve({ error: { code: 'Session.Expired' }, response: new Response(null, { status: 401 }) }),
    );

    await expect(pending).rejects.toSatisfy((error) => isApiError(error, 'Session.Expired'));
  });

  it('lets a network failure through as it is', async () => {
    const failure = new TypeError('fetch failed');

    await expect(unwrap(Promise.reject(failure))).rejects.toBe(failure);
  });
});
