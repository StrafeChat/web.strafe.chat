/**
 * Browser-side WebAuthn ceremonies (passkeys / security keys). Both the login step
 * (`Login.tsx`) and the "add a passkey" settings flow (`SecuritySettingsPage.tsx`) go
 * through here, so the JSON<->ArrayBuffer conversion - exactly where a hand-rolled WebAuthn
 * integration tends to go wrong - lives in one place. It relies on the native
 * `PublicKeyCredential.parse*OptionsFromJSON` / `credential.toJSON()` methods (Chrome 116+,
 * Safari 18+, Firefox 122+) instead of hand-decoding base64url, matching how the equinox
 * side (go-webauthn) already produces and expects exactly those JSON shapes.
 */

// The installed TS lib types PublicKeyCredential.toJSON()'s return as `PublicKeyCredentialJSON
// = any` (it has no dedicated Registration/AuthenticationResponseJSON interfaces yet) - these
// aliases exist purely so call sites read as what the value actually is instead of `any`.
export type PasskeyRegistrationResponse = PublicKeyCredentialJSON;
export type PasskeyAssertionResponse = PublicKeyCredentialJSON;

export function webauthnSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential !== 'undefined';
}

/** Runs navigator.credentials.create() against the `publicKey` field of a
 * BeginWebAuthnRegistration/BeginWebAuthnLogin response and returns the JSON-safe result to
 * post back to the server as-is (its body, unmodified). */
export async function createPasskey(
  optionsJSON: PublicKeyCredentialCreationOptionsJSON
): Promise<PasskeyRegistrationResponse> {
  const options = PublicKeyCredential.parseCreationOptionsFromJSON(optionsJSON);
  const cred = (await navigator.credentials.create({ publicKey: options })) as PublicKeyCredential | null;
  if (!cred) throw new Error('no credential returned');
  return cred.toJSON();
}

export async function getPasskeyAssertion(
  optionsJSON: PublicKeyCredentialRequestOptionsJSON
): Promise<PasskeyAssertionResponse> {
  const options = PublicKeyCredential.parseRequestOptionsFromJSON(optionsJSON);
  const cred = (await navigator.credentials.get({ publicKey: options })) as PublicKeyCredential | null;
  if (!cred) throw new Error('no credential returned');
  return cred.toJSON();
}

/** True for the "you clicked Cancel / dismissed the OS prompt" case, which is not a real
 * error and should not show a scary message. */
export function isWebauthnCancellation(err: unknown): boolean {
  return err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'AbortError');
}
