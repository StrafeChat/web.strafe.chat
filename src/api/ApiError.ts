/** Thrown by `api()` when the response is not OK; carries HTTP status for messaging. */
export class ApiError extends Error {
  readonly status: number;
  /** The server's `error_description`, when it sent one (OAuth2-style errors). */
  readonly description?: string;

  constructor(message: string, status: number, description?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.description = description;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}
