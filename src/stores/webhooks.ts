import { createStore, produce } from 'solid-js/store';
import { listRoomWebhooks, type Webhook } from '../api/webhooks';
import { onStargateEvent } from '../services/stargate/client';

/**
 * A room's webhooks, for the people who manage them (room settings > Integrations, the
 * "created by" line on a webhook's card). Loaded only when one of those surfaces asks - the
 * list needs Manage Webhooks - and refetched on WEBHOOKS_UPDATE, which says only "something
 * about this room's webhooks changed" (Discord's shape), never what.
 */
interface WebhooksState {
  byRoom: Record<string, Webhook[] | undefined>;
  /** Rooms a surface has loaded: a WEBHOOKS_UPDATE refetches only these. */
  watched: Record<string, boolean>;
}

const [webhooks, setWebhooks] = createStore<WebhooksState>({ byRoom: {}, watched: {} });
export { webhooks };

const inflight = new Map<string, Promise<Webhook[]>>();

/** Load (or reload) a room's webhooks; concurrent calls share one request. */
export function refreshRoomWebhooks(roomId: string): Promise<Webhook[]> {
  const pending = inflight.get(roomId);
  if (pending) return pending;
  const p = listRoomWebhooks(roomId)
    .then((list) => {
      const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
      setWebhooks(
        produce((s) => {
          s.byRoom[roomId] = sorted;
          s.watched[roomId] = true;
        })
      );
      return sorted;
    })
    .finally(() => inflight.delete(roomId));
  inflight.set(roomId, p);
  return p;
}

/** Put one webhook (a create, an edit or a token reset answered with it) into its room's list,
 * without its token: the secret is shown once and never kept in a store. */
export function upsertWebhook(w: Webhook): void {
  const { token: _token, url: _url, ...rest } = w;
  void _token;
  void _url;
  setWebhooks(
    produce((s) => {
      // A move to another room takes it out of the old list.
      for (const [rid, list] of Object.entries(s.byRoom)) {
        if (rid !== rest.room_id && list?.some((x) => x.id === rest.id)) s.byRoom[rid] = list.filter((x) => x.id !== rest.id);
      }
      const list = s.byRoom[rest.room_id];
      if (!list) return;
      const idx = list.findIndex((x) => x.id === rest.id);
      if (idx >= 0) list[idx] = rest;
      else list.push(rest);
      list.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    })
  );
}

export function removeWebhook(roomId: string, webhookId: string): void {
  setWebhooks(
    produce((s) => {
      const list = s.byRoom[roomId];
      if (list) s.byRoom[roomId] = list.filter((x) => x.id !== webhookId);
    })
  );
}

/** The webhook with this id among the rooms loaded so far. */
export function findLoadedWebhook(webhookId: string): Webhook | undefined {
  for (const list of Object.values(webhooks.byRoom)) {
    const w = list?.find((x) => x.id === webhookId);
    if (w) return w;
  }
  return undefined;
}

/** Drop what a client signing out (or switching accounts) must not keep. */
export function clearWebhooks(): void {
  setWebhooks({ byRoom: {}, watched: {} });
  inflight.clear();
}

export function initWebhooksHandler(): () => void {
  return onStargateEvent((evt) => {
    if (evt.t !== 'WEBHOOKS_UPDATE') return;
    const data = ((evt.d as Record<string, unknown> | undefined)?.d ?? evt.d) as Record<string, unknown> | undefined;
    const roomId = data?.room_id != null ? String(data.room_id) : evt.room_id ? String(evt.room_id) : '';
    if (!roomId || !webhooks.watched[roomId]) return;
    // Someone lost Manage Webhooks meanwhile: forget the list rather than keep a stale one.
    void refreshRoomWebhooks(roomId).catch(() =>
      setWebhooks(
        produce((s) => {
          delete s.byRoom[roomId];
          delete s.watched[roomId];
        })
      )
    );
  });
}
