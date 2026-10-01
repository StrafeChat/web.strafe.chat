/** Thrown by `api()` when the response is not OK; carries HTTP status for messaging. */
export class ApiError extends Error {
  readonly status: number;
  /** The server's `error_description`, when it sent one (OAuth2-style errors). */
  readonly description?: string;
  /** The server's machine-readable `code`, when it sent one (e.g. `mfa_token_invalid`).
   * Status alone is ambiguous - a 401 is "wrong code" or "token expired", a 429 is the IP
   * limiter or a burned pending login - and the message is English prose; this is the
   * field a flow should branch on. */
  readonly code?: string;

  constructor(message: string, status: number, description?: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.description = description;
    this.code = code;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}
