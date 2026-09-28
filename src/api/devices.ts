import { api } from './client';

// Mirrors the Matrix Client-Server API's key-management endpoints
// (https://spec.matrix.org/latest/client-server-api/#end-to-end-encryption) - the backend
// speaks this exact wire shape rather than a bespoke one, since it's what an
// OlmMachine-based client already produces/expects. Everything below is opaque JSON as
// far as this file is concerned; @matrix-org/matrix-sdk-crypto-wasm is what actually
// builds/reads it.

export interface DeviceInfo {
  device_id: string;
  has_keys: boolean;
  created_at: string;
  updated_at: string;
}

export function createDevice() {
  return api<{ device_id: string }>('/devices', { method: 'POST' });
}

export function listOwnDevices() {
  return api<DeviceInfo[]>('/devices');
}

export function revokeDevice(deviceId: string) {
  return api<void>(`/devices/${deviceId}`, { method: 'DELETE' });
}

export interface UploadKeysInput {
  device_keys?: unknown;
  one_time_keys?: Record<string, unknown>;
  fallback_keys?: Record<string, unknown>;
}

export function uploadKeys(deviceId: string, input: UploadKeysInput) {
  return api<{ one_time_key_counts: Record<string, number> }>(`/devices/${deviceId}/keys/upload`, {
    method: 'POST',
    json: input,
  });
}

export function queryKeys(deviceKeys: Record<string, string[]>) {
  return api<{ device_keys: Record<string, Record<string, unknown>>; failures?: unknown }>('/devices/keys/query', {
    method: 'POST',
    json: { device_keys: deviceKeys },
  });
}

export function claimKeys(oneTimeKeys: Record<string, Record<string, string>>) {
  return api<{ one_time_keys: Record<string, Record<string, unknown>>; failures?: unknown }>('/devices/keys/claim', {
    method: 'POST',
    json: { one_time_keys: oneTimeKeys },
  });
}

export function sendToDevice(
  eventType: string,
  txnId: string,
  senderDeviceId: string,
  messages: Record<string, Record<string, unknown>>
) {
  return api<void>(
    `/devices/send_to_device/${encodeURIComponent(eventType)}/${encodeURIComponent(txnId)}?sender_device_id=${encodeURIComponent(senderDeviceId)}`,
    { method: 'PUT', json: { messages } }
  );
}

export interface ToDeviceMessage {
  id: string;
  type: string;
  sender_user_id: string;
  sender_device_id: string;
  /** Sender's federated id (@id:domain) when known - set on live pushes. */
  sender_fid?: string;
  content: unknown;
}

export function pollToDevice(deviceId: string) {
  return api<ToDeviceMessage[]>(`/devices/${deviceId}/to_device`);
}

export function ackToDevice(deviceId: string, messageIds: string[]) {
  return api<void>(`/devices/${deviceId}/to_device/ack`, {
    method: 'POST',
    json: { message_ids: messageIds },
  });
}

// --- Asymmetric key backup (m.megolm_backup.v1.curve25519-aes-sha2). Mirrors Matrix's
// /room_keys endpoints, so the crypto engine's own request bodies and responses pass
// straight through. See lib/e2ee/keyBackup.ts for what the pieces mean.

export const BACKUP_ALGORITHM = 'm.megolm_backup.v1.curve25519-aes-sha2';

export interface BackupVersionResponse {
  exists: boolean;
  version?: string;
  algorithm?: string;
  /** Public parameters of the scheme: `{ public_key }`. Devices need only this to add keys. */
  auth_data?: { public_key?: string };
  etag?: string;
  /** How many room keys the backup currently holds. */
  count?: number;
  created_at?: string;
}

/** Public parameters. Safe and cheap to read; carries no recovery material. */
export function getBackupVersion() {
  return api<BackupVersionResponse>('/devices/backup/version');
}

export interface BackupRecoveryResponse {
  exists: boolean;
  version?: string;
  algorithm?: string;
  auth_data?: { public_key?: string };
  /** The backup's private key, encrypted under the user's recovery code. */
  wrapped_private_key?: string;
  salt?: string;
}

/** The wrapped private key. Only a restore needs it, and it is rate limited accordingly. */
export function getBackupRecovery() {
  return api<BackupRecoveryResponse>('/devices/backup/recovery');
}

export function createBackupVersion(input: {
  algorithm: string;
  auth_data: Record<string, unknown>;
  wrapped_private_key: string;
  salt: string;
}) {
  return api<{ version: string }>('/devices/backup/version', { method: 'POST', json: input });
}

export function deleteBackupVersion(version: string) {
  return api<void>(`/devices/backup/version?version=${encodeURIComponent(version)}`, { method: 'DELETE' });
}

/**
 * `body` is the crypto engine's KeysBackupRequest.body, forwarded verbatim - it is already
 * serialized JSON, so it goes through as a raw body rather than being parsed and re-encoded.
 */
export function putBackupKeys(version: string, body: string) {
  return api<{ count: number; etag: string }>(`/devices/backup/keys?version=${encodeURIComponent(version)}`, {
    method: 'PUT',
    body,
    headers: { 'Content-Type': 'application/json' },
  });
}

export interface BackupSessionData {
  first_message_index: number;
  forwarded_count: number;
  is_verified: boolean;
  /** Encrypted to the backup's public key; only the recovery code can open it. */
  session_data: { ciphertext: string; mac: string; ephemeral: string };
}

export interface BackupKeysPage {
  rooms: Record<string, { sessions: Record<string, BackupSessionData> }>;
  /** Cursor for the next page; absent on the last one. */
  next?: string;
}

/** One page of a backup. Paged because a busy account's whole backup is far too large to
 * assemble into a single response. */
export function getBackupKeys(version: string, after?: string) {
  const query = `version=${encodeURIComponent(version)}${after ? `&after=${encodeURIComponent(after)}` : ''}`;
  return api<BackupKeysPage>(`/devices/backup/keys?${query}`);
}

// --- Legacy PIN-wrapped backup. Read and delete only: accounts that predate the asymmetric
// scheme still have their history's keys here, and the client folds them into the new backup
// once (see lib/e2ee/legacyBackup.ts) before deleting this row.

export interface KeyBackupResponse {
  exists: boolean;
  encrypted_backup?: string;
  salt?: string;
  /** Megolm session export, encrypted under the store passphrase. */
  room_keys?: string;
}

export function getKeyBackup() {
  return api<KeyBackupResponse>('/devices/backup');
}

export function deleteKeyBackup() {
  return api<void>('/devices/backup', { method: 'DELETE' });
}
