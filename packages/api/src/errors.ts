/**
 * An RFC 9457 problem as the backend writes it: the standard members plus `code` (the error's stable
 * name, such as `User.EmailTaken`) and, for validation problems, the failures per field. Show users a
 * text chosen by `code`; `detail` is an English message for developers.
 */
export interface Problem {
  readonly status: number;
  readonly code: string | undefined;
  readonly title: string | undefined;
  readonly detail: string | undefined;
  readonly type: string | undefined;
  /** Messages per field (`errors`), for validation problems. */
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;
  /** Codes per field (`errorCodes`), for validation problems; what a form reacts to. */
  readonly fieldErrorCodes: Readonly<Record<string, readonly string[]>>;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function lists(value: unknown): Record<string, readonly string[]> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }
  const result: Record<string, readonly string[]> = {};
  for (const [field, entries] of Object.entries(value)) {
    if (Array.isArray(entries)) {
      const strings = entries.filter((entry): entry is string => typeof entry === 'string');
      if (strings.length > 0) {
        result[field] = strings;
      }
    }
  }
  return result;
}

/** Reads a problem body defensively: anything that is not a problem object still yields the status. */
export function readProblem(status: number, body: unknown): Problem {
  const problem = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  return {
    status,
    code: text(problem.code),
    title: text(problem.title),
    detail: text(problem.detail),
    type: text(problem.type),
    fieldErrors: lists(problem.errors),
    fieldErrorCodes: lists(problem.errorCodes),
  };
}

/** A request the gateway or a service answered with an error status. */
export class ApiError extends Error {
  readonly problem: Problem;

  constructor(problem: Problem) {
    super(problem.detail ?? problem.title ?? `The request failed with status ${String(problem.status)}.`);
    this.name = 'ApiError';
    this.problem = problem;
  }

  get status(): number {
    return this.problem.status;
  }

  get code(): string | undefined {
    return this.problem.code;
  }
}

/** True for an {@link ApiError}, and when `code` is given, only for that error code. */
export function isApiError(error: unknown, code?: string): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}

/** What every openapi-fetch call resolves to. */
export interface ClientResult<T> {
  readonly data?: T;
  readonly error?: unknown;
  readonly response: Response;
}

/**
 * The response data of a successful call; an error status becomes an {@link ApiError}. Network failures
 * are not caught here: they reject as the fetch implementation's own error.
 */
export async function unwrap<T>(pending: Promise<ClientResult<T>>): Promise<T> {
  const { data, error, response } = await pending;
  if (!response.ok) {
    throw new ApiError(readProblem(response.status, error));
  }
  return data as T;
}
