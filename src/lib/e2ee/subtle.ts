/**
 * Web Crypto SubtleCrypto is only available in a "secure context":
 * - https://
 * - http://localhost, http://127.0.0.1, http://[::1]
 *
 * http://192.168.x.x / http://10.x etc. are NOT secure contexts, so subtle is
 * undefined. Desktop dev on localhost works; a phone opening the LAN IP does not.
 */

export class E2eeUnavailableError extends Error {
  constructor() {
    super(
      [
        'This browser only exposes encryption (Web Crypto) on HTTPS or http://localhost.',
        '',
        'If you opened the app using your computer\'s LAN address (http://192.168.… or http://10.…), that is not a secure context on a phone — your PIN is correct, but decryption cannot run.',
        '',
        'Fix: use HTTPS in dev (e.g. mkcert + vite --https), use adb reverse / SSH tunnel so the phone uses http://localhost, or deploy behind HTTPS.',
      ].join('\n')
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
