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
  /** The parsed error body, for the odd field a flow needs beyond `code` (the login page
   * reads `verification_email_sent` off an `email_unverified` 403). Data from the server -
   * read it defensively. */
  readonly body?: Record<string, unknown>;

  constructor(message: string, status: number, description?: string, code?: string, body?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.description = description;
    this.code = code;
    this.body = body;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}
