import { api } from './client';

export interface PrekeyBundle {
  identity_key: string;
  signed_prekey: string;
  signed_prekey_id: number;
  signed_prekey_signature: string;
  one_time_prekey?: {
    key_id: number;
    public_key: string;
  };
  registration_id: number;
}

export interface OneTimePrekeyUpload {
  key_id: number;
  public_key: string;
}

export interface RegisterDeviceInput {
  device_id: number;
  identity_key: string;
  signed_prekey: string;
  signed_prekey_signature: string;
  signed_prekey_id: number;
  registration_id: number;
  one_time_prekeys?: OneTimePrekeyUpload[];
}

export interface DeviceInfo {
  device_id: number;
}

export function registerDevice(input: RegisterDeviceInput) {
  return api<{ ok: boolean }>('/devices', {
    method: 'POST',
    json: input,
  });
}

export function listDevices(userId: string) {
  return api<DeviceInfo[]>(`/users/${userId}/devices`);
}

export function getPrekeyBundle(userId: string, deviceId: string) {
  return api<PrekeyBundle>(`/users/${userId}/devices/${deviceId}/prekey_bundle`);
}

export interface KeyBackupResponse {
  exists: boolean;
  encrypted_backup?: string;
  salt?: string;
}

export function getKeyBackup() {
  return api<KeyBackupResponse>('/devices/backup');
}

export function setKeyBackup(encryptedBackup: string, salt: string) {
  return api<{ ok: boolean }>('/devices/backup', {
    method: 'PUT',
    json: { encrypted_backup: encryptedBackup, salt },
  });
}
