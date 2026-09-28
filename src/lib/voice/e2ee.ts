/**
 * The LiveKit half of end-to-end encrypted calls: a key provider fed by the media keys
 * that lib/e2ee/callKeys.ts moves over the Olm to-device channel.
 *
 * LiveKit encrypts and decrypts each media frame in a worker, so the SFU forwards
 * ciphertext it cannot read. Keys are per participant identity (LiveKit's default mode),
 * which is why no two participants ever have to agree on a shared secret.
 *
 * A provider and its worker are created per call and thrown away with it, so one call's
 * keys are never in memory during the next.
 */

import { BaseKeyProvider, createKeyMaterialFromBuffer, isE2EESupported } from 'livekit-client';
import E2EEWorker from 'livekit-client/e2ee-worker?worker';
import { MEDIA_KEY_RING_SIZE } from '../e2ee/callKeys';

/** Whether this browser can do encrypted calls at all (insertable streams / transforms). */
export function callEncryptionSupported(): boolean {
  return isE2EESupported();
}

/**
 * BaseKeyProvider only exposes key setting to subclasses, and the shared-passphrase
 * provider LiveKit ships can't express per-participant keys - hence this.
 */
export class CallKeyProvider extends BaseKeyProvider {
  constructor() {
    // keySize is left at LiveKit's 128-bit default: it is the only size the non-web
    // SDKs accept, so a future native client can join the same call.
    super({ sharedKey: false, keyringSize: MEDIA_KEY_RING_SIZE });
  }

  /** Install a participant's media key at a key-ring slot. */
  async setParticipantKey(raw: Uint8Array, identity: string, keyIndex: number): Promise<void> {
    // Copy out of the view: createKeyMaterialFromBuffer takes the whole ArrayBuffer, and
    // a decoded key can be a window onto a larger one.
    const bytes = raw.slice().buffer as ArrayBuffer;
    const material = await createKeyMaterialFromBuffer(bytes);
    this.onSetEncryptionKey(material, identity, keyIndex);
  }
}

/** The worker that runs the frame cryptor. Terminate it when the call ends. */
export function createE2EEWorker(): Worker {
  return new E2EEWorker();
}
