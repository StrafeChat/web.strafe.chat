/**
 * Shared pieces of the email-change flow, used by the web Security settings and
 * /confirm-email page and by the mobile app (which runs this file in Hermes - hence regexes
 * only, no URL API).
 */

/** Where the confirmation link in the mail to the new address points. */
export const CONFIRM_EMAIL_PATH = '/confirm-email';

/** A shape check before asking the server, which is the authority (normalisation, blocklist). */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const BARE_TOKEN = /^[0-9a-fA-F]{64}$/;
// `/confirm-email`, then a query string holding token=<64 hex> (not followed by more hex).
const LINK_TOKEN = /\/confirm-email\/?\?(?:[^#\s]*&)?token=([0-9a-fA-F]{64})(?![0-9a-fA-F])/;

/**
 * The token from what the person pasted: the whole link from the email, or just the token.
 * Returns it lowercased, or null when the text is neither.
 */
export function parseEmailChangeToken(raw: string): string | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  if (BARE_TOKEN.test(s)) return s.toLowerCase();
  const m = LINK_TOKEN.exec(s);
  return m ? m[1].toLowerCase() : null;
}
