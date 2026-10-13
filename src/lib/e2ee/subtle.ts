/**
 * Web Crypto SubtleCrypto is only available in a "secure context":
 * - https://
 * - http://localhost, http://127.0.0.1, http://[::1]
 *
 * http://192.168.x.x / http://10.x etc. are NOT secure contexts, so subtle is
 * undefined. Desktop dev on localhost works; a phone opening the LAN IP does not.
 */

/**
 * Web Crypto is missing. The message is for the console and whoever is debugging; what the
 * user sees is the localized e2ee.environmentBody (E2eeEnvironmentModal).
 */
export class E2eeUnavailableError extends Error {
  constructor() {
    super(
      'Web Crypto is unavailable: this page is not a secure context. Serve it over HTTPS or open it at http://localhost ' +
        '(in development: mkcert + vite --https, or adb reverse / an SSH tunnel so a phone reaches localhost).'
    );
    this.name = 'E2eeUnavailableError';
  }
}

export function getSubtleCrypto(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) {
    throw new E2eeUnavailableError();
  }
  return s;
}
