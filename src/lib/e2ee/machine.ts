import { initAsync, OlmMachine, UserId, DeviceId } from '@matrix-org/matrix-sdk-crypto-wasm';
import { toMatrixUserId } from './constants';
import { createDevice as apiCreateDevice, listOwnDevices, revokeDevice } from '../../api/devices';
import { instance, loadInstanceInfo } from '../../stores/instance';

const DB_NAME_PREFIX = 'strafe-e2ee-';
const PASSPHRASE_DB = 'strafe-e2ee-store-key';
const PASSPHRASE_STORE = 'passphrase';

/**
 * The local store exists but cannot be used: IndexedDB refused to open it, or the engine
 * could not read it. Seen in the field when the web engine is *older* than the one that
 * wrote the store - the desktop app's bundled WebKitGTK after switching from a locally built
 * AppImage (2.52) to the CI one (2.50), whose IndexedDB files carry a metadata version the
 * older engine rejects - and it would equally cover a damaged file or a lost passphrase.
 *
 * Nothing in the account is lost: room keys come back from the recovery backup. What has to
 * go is this device's identity, so the fix (resetLocalE2eeStore) is offered to the person
 * rather than applied silently. Until then every encrypt/decrypt rejects with this, which is
 * what lets the UI say what is wrong instead of showing a blank safety number and a backup
 * status that never finishes "checking".
 */
export class E2eeStoreUnusableError extends Error {
  /** `name: message` of the underlying failure, for the dialog's fine print. */
  readonly detail: string;

  constructor(
    readonly storeName: string,
    cause: unknown,
  ) {
    const detail = describeError(cause);
    super(`E2EE store ${storeName} cannot be used: ${detail}`);
    this.name = 'E2eeStoreUnusableError';
    this.detail = detail;
  }
}

function describeError(e: unknown): string {
  if (e instanceof Error) return e.name && e.name !== 'Error' ? `${e.name}: ${e.message}` : e.message;
  return String(e);
}

let wasmInitialized: Promise<void> | null = null;
function ensureWasm(): Promise<void> {
  if (!wasmInitialized) wasmInitialized = initAsync().then(() => undefined);
  return wasmInitialized;
}

/**
 * The OlmMachine's own IndexedDB store is encrypted at rest with this passphrase - this
 * is the real fix for the old design storing raw private key bytes in IndexedDB
 * unencrypted. The passphrase itself still has to live somewhere accessible to bootstrap
 * the store (there's no way around *some* local secret existing for a pure-web app with
 * no hardware-backed keystore - the same tradeoff Signal Desktop/Element make), so what
 * actually matters is that it's the *only* thing exposed this way, not the key material
 * itself.
 *
 * It is purely local and deliberately not backed up anywhere. Losing it (clearing site data)
 * costs this browser its device identity, not the account's history: a fresh device is
 * provisioned and the key backup - which is keyed by the user's recovery code, not by this
 * passphrase - puts the room keys back. See keyBackup.ts.
 *
 * Keyed per-user (like LOCAL_DEVICE_KEY below), not a single fixed key: a browser profile
 * can plausibly see more than one account over its lifetime (a shared/family computer, or
 * just signing into a second account), and a fixed key would hand every account in that
 * browser the *same* passphrase - letting any of them decrypt any other's IndexedDB store
 * by name, entirely defeating "encrypted at rest" as an at-rest protection.
 */
function passphraseKey(userId: string): string {
  return `passphrase:${userId}`;
}

async function getOrCreateStorePassphrase(userId: string): Promise<string> {
  try {
    return await readOrCreateStorePassphrase(userId);
  } catch (e) {
    throw new E2eeStoreUnusableError(PASSPHRASE_DB, e);
  }
}

function readOrCreateStorePassphrase(userId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PASSPHRASE_DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(PASSPHRASE_STORE);
    };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(PASSPHRASE_STORE, 'readwrite');
      const store = tx.objectStore(PASSPHRASE_STORE);
      const key = passphraseKey(userId);
      const getReq = store.get(key);
      getReq.onsuccess = () => {
        if (typeof getReq.result === 'string' && getReq.result) {
          db.close();
          resolve(getReq.result);
          return;
        }
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        const passphrase = btoa(String.fromCharCode(...bytes));
        const putReq = store.put(passphrase, key);
        putReq.onsuccess = () => {
          db.close();
          resolve(passphrase);
        };
        putReq.onerror = () => {
          db.close();
          reject(putReq.error);
        };
      };
      getReq.onerror = () => {
        db.close();
        reject(getReq.error);
      };
    };
  });
}

const LOCAL_DEVICE_KEY = 'strafe_e2ee_device_id';

/**
 * What the local device id and crypto store are keyed by. Before federation that is the
 * bare user id; once an instance federates its users are named @id:<domain> and the
 * engine won't reuse an account created under the old @id:strafe.internal name, so the
 * federated identity gets its own scope (and a one-time migration, see getMachine) rather
 * than trying to wipe a store the failed open may still hold a connection to.
 */
function identityScope(userId: string): string {
  return instance.federationEnabled && instance.domain ? `${userId}@${instance.domain}` : userId;
}

function readLocalDeviceId(scope: string): string | null {
  try {
    return localStorage.getItem(`${LOCAL_DEVICE_KEY}:${scope}`);
  } catch {
    return null;
  }
}

function getLocalDeviceId(userId: string): string | null {
  return readLocalDeviceId(identityScope(userId));
}

function setLocalDeviceId(userId: string, deviceId: string): void {
  try {
    localStorage.setItem(`${LOCAL_DEVICE_KEY}:${identityScope(userId)}`, deviceId);
  } catch {
    // best-effort; worst case we re-provision a device next load
  }
}

/**
 * First open after this instance turned federation on: the pre-federation device and its
 * store belong to the @id:strafe.internal identity and can't be carried over, so retire
 * them (best effort) and let the caller provision a fresh device. Room keys the old device
 * had are still recoverable from the key backup, which is not tied to a device identity.
 */
async function migrateLegacyIdentity(userId: string): Promise<void> {
  if (identityScope(userId) === userId) return;
  const legacyDeviceId = readLocalDeviceId(userId);
  if (!legacyDeviceId) return;
  console.warn('[e2ee] this instance now names us', toMatrixUserId(userId), '- retiring pre-federation device', legacyDeviceId, 'and starting fresh');
  await deleteStore(`${DB_NAME_PREFIX}${userId}`);
  revokeDevice(legacyDeviceId).catch((err) => console.warn('[e2ee] could not revoke pre-federation device', legacyDeviceId, err));
  try {
    localStorage.removeItem(`${LOCAL_DEVICE_KEY}:${userId}`);
  } catch {
    // ignore
  }
}

let machinePromise: Promise<OlmMachine> | null = null;
let currentUserId: string | null = null;
let currentDeviceId: string | null = null;

function storeNameFor(userId: string): string {
  return `${DB_NAME_PREFIX}${identityScope(userId)}`;
}

/**
 * The engine refuses to open a store that was created for a different device of the same
 * user ("the account in the store doesn't match the account in the constructor: expected
 * @u:server:DEVICE, got @u:server:OTHER"). Pull DEVICE out of that message so the caller
 * can decide what to do with the store, rather than failing every send and decrypt.
 */
function mismatchedStoreDeviceId(err: unknown): string | null {
  const message = err instanceof Error ? err.message : String(err);
  if (!message.includes("doesn't match")) return null;
  const m = /expected\s+\S*?:(\d+)(?!\d)/.exec(message);
  return m ? m[1]! : null;
}

/**
 * The *user* part of the stored account differs from what we're opening with. That
 * happens exactly once per device when an instance turns federation on: local users go
 * from @id:strafe.internal to @id:<domain>, and the engine (rightly) refuses to reuse an
 * account signed under another name. Returns the stored user id for logging.
 */
function mismatchedStoreUserId(err: unknown, expectedUser: string): string | null {
  const message = err instanceof Error ? err.message : String(err);
  if (!message.includes("doesn't match")) return null;
  const m = /expected\s+(@[^:\s]+:[^:\s]+):\d+/.exec(message);
  if (!m) return null;
  return m[1] !== expectedUser ? m[1]! : null;
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    // Another open connection (a second tab) is holding the database; the delete goes
    // through once it closes. Don't hang forever waiting for that.
    req.onblocked = () => setTimeout(resolve, 2000);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Wipe the engine's local store for one store name. The wasm SDK keeps a store as two
 * IndexedDB databases named `<store>::matrix-sdk-crypto` and `<store>::matrix-sdk-crypto-meta`
 * - deleting only `<store>` itself is a silent no-op, which leaves the next initialize
 * tripping over the very account the wipe was meant to discard. `strict` rethrows a failed
 * delete instead of logging it, for the reset a person asked for.
 */
async function deleteStore(storeName: string, opts: { strict?: boolean } = {}): Promise<void> {
  await Promise.all([
    `${storeName}::matrix-sdk-crypto`,
    `${storeName}::matrix-sdk-crypto-meta`,
    storeName,
  ].map((name) =>
    deleteDatabase(name).catch((err) => {
      if (opts.strict) throw err;
      console.warn('[e2ee] could not delete store', name, err);
    }),
  ));
}

/**
 * Can the passphrase database be opened at all? It is shared by every account on this
 * origin, so a reset leaves it alone when it works (the other accounts' stores stay
 * readable) and drops it only when it is as unreadable as the store that triggered the
 * reset. Opening a database that does not exist creates an empty one; that case reports
 * false so the caller deletes the empty shell and the next start creates it properly.
 */
function passphraseDbUsable(): Promise<boolean> {
  return new Promise((resolve) => {
    let created = false;
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(PASSPHRASE_DB);
    } catch {
      resolve(false);
      return;
    }
    req.onupgradeneeded = () => {
      created = true;
    };
    req.onsuccess = () => {
      req.result.close();
      resolve(!created);
    };
    req.onerror = () => resolve(false);
    // Another page holds it open: it exists and works.
    req.onblocked = () => resolve(true);
  });
}

/**
 * Throw away this device's encryption identity because its store cannot be used (see
 * E2eeStoreUnusableError), so the next start provisions a fresh device and the backup flow
 * offers to restore history. The old device is revoked server-side (best effort) so peers
 * stop encrypting to keys nobody can read any more. The caller reloads the page afterwards:
 * every store, the gateway and the engine belong to one device identity.
 */
export async function resetLocalE2eeStore(userId: string): Promise<void> {
  // The scope needs the instance's domain, which getMachine had loaded before it failed;
  // make sure of it in case this runs from a page that never got that far.
  await loadInstanceInfo();
  const scope = identityScope(userId);
  const oldDeviceId = readLocalDeviceId(scope);
  await deleteStore(storeNameFor(userId), { strict: true });
  if (!(await passphraseDbUsable())) await deleteDatabase(PASSPHRASE_DB);
  try {
    localStorage.removeItem(`${LOCAL_DEVICE_KEY}:${scope}`);
  } catch {
    // Worst case the next start finds the old id, fails to open the (now missing) store
    // and provisions a fresh device through the mismatch path.
  }
  if (oldDeviceId) {
    revokeDevice(oldDeviceId).catch((err) => console.warn('[e2ee] could not revoke device', oldDeviceId, 'after a store reset', err));
  }
  machinePromise = null;
  currentUserId = null;
  currentDeviceId = null;
  console.warn('[e2ee] local store reset for', toMatrixUserId(userId), '- a fresh device will be provisioned');
}

/**
 * The part of a reset that does not touch IndexedDB, for when something else wipes the
 * stores (the desktop shell, at restart): revoke this user's device and forget *every*
 * account's device id on this origin. All of their stores go with the wipe, and a device id
 * that outlives its store would make the engine recreate that device with new keys under the
 * old id - which the server already holds keys for, so peers would keep encrypting to keys
 * nobody has. A fresh id per account avoids that.
 */
export async function forgetLocalDeviceIdentities(userId: string): Promise<void> {
  await loadInstanceInfo();
  const oldDeviceId = readLocalDeviceId(identityScope(userId));
  if (oldDeviceId) {
    try {
      await revokeDevice(oldDeviceId);
    } catch (err) {
      console.warn('[e2ee] could not revoke device', oldDeviceId, 'before a storage wipe', err);
    }
  }
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(`${LOCAL_DEVICE_KEY}:`));
    for (const k of keys) localStorage.removeItem(k);
  } catch {
    // The mismatch path still ends up provisioning a fresh device.
  }
  machinePromise = null;
  currentUserId = null;
  currentDeviceId = null;
}

/**
 * Open the machine for (userId, deviceId). If the local store turns out to belong to a
 * different device of this user - the device id went missing from localStorage while the
 * encrypted store survived, so a new device got provisioned - prefer the device the store
 * knows about: it still has every Olm/Megolm session this browser ever established, and
 * the server still knows its keys, so peers' existing room-key shares keep working. The
 * just-provisioned device is an orphan nothing has shared anything with; revoke it. Only
 * if the stored device no longer exists server-side is the store wiped and started fresh.
 */
async function openMachine(userId: string, deviceId: string, passphrase: string): Promise<{ machine: OlmMachine; deviceId: string }> {
  const storeName = storeNameFor(userId);
  const matrixUser = () => new UserId(toMatrixUserId(userId));
  try {
    const machine = await OlmMachine.initialize(matrixUser(), new DeviceId(deviceId), storeName, passphrase);
    return { machine, deviceId };
  } catch (e) {
    const renamedFrom = mismatchedStoreUserId(e, toMatrixUserId(userId));
    if (renamedFrom) {
      // Identity renamed (federation enabled on this instance): the old account can't be
      // carried over, so start a fresh device under the new name. Peers re-establish
      // sessions on their next key share; older E2EE history stays readable only on
      // devices that still hold the old sessions.
      console.warn('[e2ee] local store belongs to', renamedFrom, 'but this instance now names us', toMatrixUserId(userId), '- starting a fresh device');
      await deleteStore(storeName);
      const created = await apiCreateDevice();
      revokeDevice(deviceId).catch(() => undefined);
      setLocalDeviceId(userId, created.device_id);
      const machine = await OlmMachine.initialize(matrixUser(), new DeviceId(created.device_id), storeName, passphrase);
      return { machine, deviceId: created.device_id };
    }
    const storedDeviceId = mismatchedStoreDeviceId(e);
    // Not a device or user mismatch: the store itself cannot be opened or read.
    if (!storedDeviceId) throw new E2eeStoreUnusableError(storeName, e);
    let storedStillRegistered = false;
    try {
      storedStillRegistered = (await listOwnDevices()).some((d) => d.device_id === storedDeviceId);
    } catch {
      // Can't tell - assume it is, since that's the only path that keeps existing sessions.
      storedStillRegistered = true;
    }
    if (storedStillRegistered) {
      console.warn('[e2ee] local store belongs to device', storedDeviceId, 'not', deviceId, '- reopening as the stored device');
      const machine = await OlmMachine.initialize(matrixUser(), new DeviceId(storedDeviceId), storeName, passphrase);
      setLocalDeviceId(userId, storedDeviceId);
      revokeDevice(deviceId).catch((err) => console.warn('[e2ee] could not revoke orphaned device', deviceId, err));
      return { machine, deviceId: storedDeviceId };
    }
    console.warn('[e2ee] local store belongs to revoked device', storedDeviceId, '- discarding it and starting fresh as', deviceId);
    await deleteStore(storeName);
    const machine = await OlmMachine.initialize(matrixUser(), new DeviceId(deviceId), storeName, passphrase);
    return { machine, deviceId };
  }
}

/**
 * Get (creating if needed) the current user's OlmMachine. Device IDs are always
 * server-assigned (see equinox devices.Service.CreateDevice) - fixes the old design's
 * hardcoded `device_id: 1`, where two genuinely independent devices for the same user
 * would silently collide and overwrite each other's keys.
 */
export async function getMachine(userId: string): Promise<OlmMachine> {
  if (machinePromise && currentUserId === userId) return machinePromise;
  currentUserId = userId;
  const promise = (async () => {
    await ensureWasm();
    // The engine's user id depends on whether this instance federates (its domain) - make
    // sure that's known before the first UserId is built.
    await loadInstanceInfo();
    await migrateLegacyIdentity(userId);
    let deviceId = getLocalDeviceId(userId);
    if (!deviceId) {
      const created = await apiCreateDevice();
      deviceId = created.device_id;
      setLocalDeviceId(userId, deviceId);
    }
    const passphrase = await getOrCreateStorePassphrase(userId);
    const opened = await openMachine(userId, deviceId, passphrase);
    currentDeviceId = opened.deviceId;
    return opened.machine;
  })();
  machinePromise = promise;
  return promise;
}

export function getCurrentDeviceId(): string | null {
  return currentDeviceId;
}

/**
 * Import a Megolm key export; returns how many sessions were actually new. Idempotent -
 * keys already present are counted but change nothing.
 *
 * Only the legacy PIN backup still speaks this format (see legacyBackup.ts). The current
 * backup hands the engine its own per-session structures instead, via
 * importBackedUpRoomKeys, so nothing has to be exported in the clear even momentarily.
 */
export async function importRoomKeys(machine: OlmMachine, exported: string): Promise<number> {
  const result = await machine.importExportedRoomKeys(exported, () => {});
  return Number(result.importedCount ?? 0);
}
