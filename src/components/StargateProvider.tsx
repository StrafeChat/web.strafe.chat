import type { Component } from 'solid-js';
import { createEffect, onMount, onCleanup } from 'solid-js';
import { auth } from '../stores/auth';
import { stargate } from '../stores/stargate';
import { connectStargate, disconnectStargate, subscribe, unsubscribe, onStargateReady } from '../services/stargate/client';
import { hydrateFromReady, bootstrapFromRest } from '../stores/auth';
import { rooms } from '../stores/rooms';
import { initStargateMessageHandler } from '../stores/messages';
import { initPresenceHandler } from '../stores/presence';
import { initReadStateHandler } from '../stores/readState';
import { initTypingHandler } from '../stores/typing';
import { initRelationshipHandlers } from '../stores/relationships';
import { initRoomHandlers } from '../stores/rooms';
import { ensureDevice } from '../lib/e2ee';

const READY_FALLBACK_MS = 12000;

/** Connects Stargate WebSocket when authenticated; bootstrap from READY (skip REST). */
export const StargateProvider: Component<{ children?: import('solid-js').JSX.Element }> = (props) => {
  onMount(() => {
    initStargateMessageHandler();
    initPresenceHandler();
    initReadStateHandler();
    initTypingHandler();
    initRelationshipHandlers();
    initRoomHandlers();
  });

  onMount(() => {
    const unsub = onStargateReady((payload) => {
      hydrateFromReady(payload);
    });
    onCleanup(unsub);
  });

  createEffect(() => {
    const token = auth.token;
    if (token) {
      connectStargate(token);
    } else {
      disconnectStargate();
    }
  });

  createEffect(() => {
    const token = auth.token;
    const hydrated = auth.hydrated;
    if (!token || hydrated) return;
    const t = setTimeout(() => {
      if (!auth.hydrated && auth.token) bootstrapFromRest();
    }, READY_FALLBACK_MS);
    return () => clearTimeout(t);
  });

  createEffect(() => {
    const uid = auth.user?.id;
    if (uid) {
      ensureDevice(uid).catch((err) => console.error('ensureDevice failed:', err));
    }
  });

  createEffect(() => {
    if (stargate.ready && auth.user?.id) {
      subscribe(undefined, auth.user.id);
    }
  });

  createEffect(() => {
    if (!stargate.ready) return;
    const list = rooms.rooms;
    for (const r of list) {
      if (r.id) subscribe(r.id, undefined);
    }
    return () => {
      for (const r of list) {
        if (r.id) unsubscribe(r.id, undefined);
      }
    };
  });

  onCleanup(() => disconnectStargate());
  return <>{props.children}</>;
};
