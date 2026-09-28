/**
 * Safety numbers / device verification - the out-of-band backstop that makes the
 * signed-prekey fix actually matter. Even with real signatures, a compromised server
 * could in principle serve a substituted key bundle for a brand-new device; comparing a
 * fingerprint out of band (in person, over a call, etc.) is what catches that. The old
 * implementation had no equivalent at all - "encrypted" gave no way to detect a MITM.
 *
 * Deliberately device-level, not cross-signing: this app doesn't implement Matrix's
 * cross-signing identity model (a bigger feature than E2EE messaging itself needs), so
 * verification here is per-device, matching Signal's classic per-conversation safety
 * number rather than Element's per-user cross-signed trust.
 */
import { OlmMachine, UserId, DeviceId, DeviceKeyAlgorithmName, LocalTrust } from '@matrix-org/matrix-sdk-crypto-wasm';
import { toMatrixUserId } from './constants';

export interface DeviceSafetyInfo {
  deviceId: string;
  /** Human-comparable, grouped Ed25519 fingerprint (empty if the device has no Ed25519 key, which shouldn't happen for a real device). */
  fingerprint: string;
  verified: boolean;
}

/** Groups a base64 fingerprint into blocks of 4 for easier visual/verbal comparison,
 * the same convention Signal/Matrix safety-number UIs use. */
function formatFingerprint(base64: string): string {
  const compact = base64.replace(/[^A-Za-z0-9]/g, '');
  return (compact.match(/.{1,4}/g) ?? []).join(' ');
}

export async function getOwnFingerprint(machine: OlmMachine): Promise<string> {
  return formatFingerprint(machine.identityKeys.ed25519.toBase64());
}

export async function getPeerDevices(machine: OlmMachine, peerUserId: string): Promise<DeviceSafetyInfo[]> {
  const userDevices = await machine.getUserDevices(new UserId(toMatrixUserId(peerUserId)));
  return userDevices.devices().map((d) => {
    const key = d.getKey(DeviceKeyAlgorithmName.Ed25519);
    const fingerprint = key?.ed25519 ? formatFingerprint(key.ed25519.toBase64()) : '';
    return {
      deviceId: d.deviceId.toString(),
      fingerprint,
      verified: d.localTrustState === LocalTrust.Verified,
    };
  });
}

export async function markDeviceVerified(machine: OlmMachine, peerUserId: string, deviceId: string): Promise<void> {
  const userDevices = await machine.getUserDevices(new UserId(toMatrixUserId(peerUserId)));
  const device = userDevices.get(new DeviceId(deviceId));
  if (!device) throw new Error('device not found');
  await device.setLocalTrust(LocalTrust.Verified);
}

export async function clearDeviceVerification(machine: OlmMachine, peerUserId: string, deviceId: string): Promise<void> {
  const userDevices = await machine.getUserDevices(new UserId(toMatrixUserId(peerUserId)));
  const device = userDevices.get(new DeviceId(deviceId));
  if (!device) return;
  await device.setLocalTrust(LocalTrust.Unset);
}
