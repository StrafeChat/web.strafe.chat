import {
  OlmMachine,
  RequestType,
  DeviceLists,
  ProcessedToDeviceEventType,
  type DecryptedToDeviceEvent,
} from '@matrix-org/matrix-sdk-crypto-wasm';
import {
  uploadKeys,
  queryKeys,
  claimKeys,
  sendToDevice,
  pollToDevice,
  ackToDevice,
} from '../../api/devices';
import { getCurrentDeviceId } from './machine';
import { toMatrixUserId, fromMatrixUserId } from './constants';

/**
 * A to-device event the OlmMachine successfully decrypted, with the sender taken from
 * the decryption rather than from the (untrusted) payload.
 *
 * Room keys are consumed by the machine itself and need no handler here; this exists for
 * the event types this app defines on top - currently call media keys.
 */
export interface DecryptedToDeviceEventInfo {
  /** The inner event type, e.g. `chat.strafe.call_key`. */
  type: string;
  /** Local user id of the sending device's owner. */
  senderUserId: string;
  senderDeviceId?: string;
  /** Whether that device is verified out of band (safety numbers). */
  senderVerified: boolean;
  content: unknown;
}

const decryptedHandlers = new Set<(event: DecryptedToDeviceEventInfo) => void>();

/** Subscribe to decrypted to-device events. Returns a disposer. */
export function onDecryptedToDevice(handler: (event: DecryptedToDeviceEventInfo) => void): () => void {
  decryptedHandlers.add(handler);
  return () => decryptedHandlers.delete(handler);
}

/** Turn the machine's processed events into app-level ones and fan them out. */
function dispatchDecrypted(processed: unknown[]): void {
  if (decryptedHandlers.size === 0) return;
  for (const entry of processed) {
    const event = entry as DecryptedToDeviceEvent;
    if (event?.type !== ProcessedToDeviceEventType.Decrypted) continue;
    let raw: { type?: unknown; content?: unknown };
    try {
      raw = JSON.parse(event.rawEvent) as { type?: unknown; content?: unknown };
    } catch {
      continue;
    }
    if (typeof raw.type !== 'string') continue;
    const info = event.encryptionInfo;
    const decoded: DecryptedToDeviceEventInfo = {
      type: raw.type,
      senderUserId: fromMatrixUserId(info.sender.toString()),
      senderDeviceId: info.senderDevice?.toString(),
      senderVerified: info.isSenderVerified(),
      content: raw.content ?? {},
    };
    for (const handler of decryptedHandlers) {
      try {
        handler(decoded);
      } catch (err) {
        console.error('[e2ee] decrypted to-device handler failed', decoded.type, err);
      }
    }
  }
}

/**
 * Last known one-time-key counts, keyed by algorithm - receiveSyncChanges treats a
 * *missing* entry as "zero keys of that type on the server", so passing an empty map on
 * every call would make the machine think its key pool is permanently empty and keep
 * trying to replenish. Updated whenever a KeysUpload response gives us a fresh count;
 * empty until the first upload happens, which is correct (there genuinely are zero keys
 * on the server before that).
 */
let lastKnownOtpCounts: Map<string, number> = new Map();

/** Record one-time-key counts learned from a key upload made outside the request loop. */
export function noteOneTimeKeyCounts(counts: Record<string, number>): void {
  lastKnownOtpCounts = new Map(Object.entries(counts));
}

/**
 * Drain OlmMachine.outgoingRequests() and relay each one over our own transport (the
 * machine is a "no network IO" state machine by design - it tells the app what it wants
 * sent, the app sends it however it likes). Every request body/response here is the
 * standard Matrix Client-Server API shape the machine itself produces/expects; equinox's
 * /devices/* endpoints speak that same shape, so this is pure relay, not translation.
 */
export async function processOutgoingRequests(machine: OlmMachine): Promise<void> {
  const requests = await machine.outgoingRequests();
  // The union type's `id` is typed optional on some request kinds even though every
  // variant we actually handle always sets it - `any` here matches dispatchRequest's own
  // treatment of the same union rather than fighting TS's discrimination on it.
  for (const req of requests as any[]) {
    try {
      const response = await dispatchRequest(req);
      await machine.markRequestAsSent(req.id, req.type, JSON.stringify(response));
    } catch (e) {
      console.error('[e2ee] outgoing request failed', req.type, e);
      // Leave unsent - it'll be retried on the next processOutgoingRequests() call.
    }
  }
}

async function dispatchRequest(req: any): Promise<unknown> {
  switch (req.type) {
    case RequestType.KeysUpload: {
      const body = JSON.parse(req.body);
      const deviceId = getCurrentDeviceId();
      if (!deviceId) throw new Error('no local device id');
      const res = await uploadKeys(deviceId, body);
      lastKnownOtpCounts = new Map(Object.entries(res.one_time_key_counts ?? {}));
      return res;
    }
    case RequestType.KeysQuery: {
      const body = JSON.parse(req.body);
      return queryKeys(body.device_keys ?? {});
    }
    case RequestType.KeysClaim: {
      const body = JSON.parse(req.body);
      return claimKeys(body.one_time_keys ?? {});
    }
    case RequestType.ToDevice: {
      const body = JSON.parse(req.body);
      const deviceId = getCurrentDeviceId();
      if (!deviceId) throw new Error('no local device id');
      await sendToDevice(req.event_type, req.txn_id, deviceId, body.messages ?? {});
      return {};
    }
    default:
      // SignatureUpload / RoomMessage / KeysBackup: not used by this app's flow (no
      // cross-signing, and chat content goes through the existing /rooms/:id/messages
      // endpoint rather than a machine-generated RoomMessageRequest). Mark as sent with
      // an empty response so the machine doesn't keep re-queuing something we'll never
      // service, rather than silently dropping it.
      console.warn('[e2ee] ignoring unsupported outgoing request type', req.type);
      return {};
  }
}

/**
 * Feed inbound to-device messages (Olm session setup, Megolm room-key distribution,
 * revocation notices) into the machine, then ack them so they aren't redelivered.
 * Called both on the live gateway push and on reconnect (to drain anything that arrived
 * while offline).
 */
export async function receiveToDeviceMessages(
  machine: OlmMachine,
  deviceId: string,
  messages: Array<{ id: string; type: string; sender_user_id: string; sender_device_id: string; sender_fid?: string; content: unknown }>
): Promise<void> {
  if (messages.length === 0) return;
  const events = messages.map((m) => ({
    type: m.type,
    // Prefer the server-provided federated id (exact for senders on other instances);
    // otherwise derive it from the local id via the identity registry.
    sender: m.sender_fid || toMatrixUserId(m.sender_user_id),
    content: m.content,
  }));
  const processed = await machine.receiveSyncChanges(
    JSON.stringify(events),
    new DeviceLists(),
    lastKnownOtpCounts,
    new Set()
  );
  // Room keys are applied by the machine itself; anything else this app defines (call
  // media keys) is handed to its own handler with the authenticated sender attached.
  dispatchDecrypted(processed as unknown[]);
  await ackToDevice(deviceId, messages.map((m) => m.id));
  // A room-key (Megolm) to-device message may have just been processed - flush any
  // resulting outgoing requests (e.g. key-claim follow-ups) right away.
  await processOutgoingRequests(machine);
}

/** Poll for any to-device messages that arrived while this device was offline. */
export async function drainPendingToDevice(machine: OlmMachine, deviceId: string): Promise<void> {
  const pending = await pollToDevice(deviceId);
  await receiveToDeviceMessages(machine, deviceId, pending);
}
