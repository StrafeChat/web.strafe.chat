/**
 * Client-side attachment encryption for E2EE rooms (the same shape Matrix uses for
 * encrypted media): each file gets a fresh random AES-256-GCM key, the ciphertext is what
 * gets uploaded, and the key + IV travel inside the Megolm-encrypted message so only room
 * members who can read the message can read the file. Nebula and equinox only ever see an
 * opaque blob with no name, type, or dimensions.
 */

export interface AttachmentKeyMaterial {
  /** base64 raw AES-256 key. */
  key: string;
  /** base64 12-byte GCM nonce. */
  iv: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  // Explicit ArrayBuffer backing so the result satisfies WebCrypto's BufferSource type.
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export async function encryptAttachment(file: Blob): Promise<{ blob: Blob; material: AttachmentKeyMaterial }> {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = await file.arrayBuffer();
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  const rawKey = new Uint8Array(await crypto.subtle.exportKey('raw', key));
  return {
    blob: new Blob([ciphertext], { type: 'application/octet-stream' }),
    material: { key: bytesToBase64(rawKey), iv: bytesToBase64(iv) },
  };
}

export async function decryptAttachment(ciphertext: ArrayBuffer, material: AttachmentKeyMaterial, contentType: string): Promise<Blob> {
  const key = await crypto.subtle.importKey('raw', base64ToBytes(material.key), { name: 'AES-GCM' }, false, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(material.iv) }, key, ciphertext);
  return new Blob([plaintext], { type: contentType || 'application/octet-stream' });
}
