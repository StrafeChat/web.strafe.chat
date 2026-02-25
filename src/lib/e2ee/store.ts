/**
 * IndexedDB store for E2EE keys and sessions
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { DeviceIdentity, Session } from './types';

const DB_NAME = 'strafe-e2ee';
const DB_VERSION = 2;
const STORE_DEVICE = 'device';
const STORE_SESSIONS = 'sessions';
const STORE_SENT_PLAINTEXTS = 'sent_plaintexts';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_DEVICE)) {
          db.createObjectStore(STORE_DEVICE, { keyPath: 'deviceId' });
        }
        if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
          const s = db.createObjectStore(STORE_SESSIONS, { keyPath: ['recipientUserId', 'recipientDeviceId'] });
          s.createIndex('by-recipient', 'recipientUserId');
        }
        if (!db.objectStoreNames.contains(STORE_SENT_PLAINTEXTS)) {
          db.createObjectStore(STORE_SENT_PLAINTEXTS, { keyPath: 'messageId' });
        }
      },
    });
  }
  return dbPromise;
}

export async function setSentPlaintext(messageId: string, plaintext: string): Promise<void> {
  const db = await getDB();
  await db.put(STORE_SENT_PLAINTEXTS, { messageId, plaintext });
}

export async function getSentPlaintext(messageId: string): Promise<string | null> {
  const db = await getDB();
  const row = await db.get(STORE_SENT_PLAINTEXTS, messageId);
  return row?.plaintext ?? null;
}

export async function getDeviceIdentity(): Promise<DeviceIdentity | null> {
  const db = await getDB();
  return db.get(STORE_DEVICE, 1) ?? null; // single device, key=1
}

export async function setDeviceIdentity(device: DeviceIdentity): Promise<void> {
  const db = await getDB();
  await db.put(STORE_DEVICE, device);
}

export async function getSession(recipientUserId: string, recipientDeviceId: number): Promise<Session | null> {
  const db = await getDB();
  return db.get(STORE_SESSIONS, [recipientUserId, recipientDeviceId]) ?? null;
}

export async function setSession(session: Session): Promise<void> {
  const db = await getDB();
  await db.put(STORE_SESSIONS, session);
}

export async function getSessionsForRecipient(recipientUserId: string): Promise<Session[]> {
  const db = await getDB();
  return db.getAllFromIndex(STORE_SESSIONS, 'by-recipient', recipientUserId);
}
