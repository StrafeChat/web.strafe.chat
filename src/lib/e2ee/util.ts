/**
 * Shared E2EE utilities – base64 encode/decode with URL-safe support.
 */

export function b64Decode(s: string): Uint8Array {
  const normalized = (s ?? '').trim().replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(normalized);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function b64Encode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}
