import type { Component } from 'solid-js';
import { createEffect, onMount, onCleanup } from 'solid-js';
import { auth } from '../stores/auth';
import { stargate } from '../stores/stargate';
import { connectStargate, disconnectStargate, subscribe } from '../services/stargate/client';
import { initStargateMessageHandler } from '../stores/messages';
import { initPresenceHandler } from '../stores/presence';
import { initTypingHandler } from '../stores/typing';
import { ensureDevice } from '../lib/e2ee';

/** Connects Stargate WebSocket when authenticated, disconnects on logout. */
export const StargateProvider: Component<{ children?: import('solid-js').JSX.Element }> = (props) => {
  onMount(() => {
    initStargateMessageHandler();
    initPresenceHandler();
    initTypingHandler();
  });

  createEffect(() => {
    const token = auth.token;
    if (token) {
      connectStargate(token);
    } else {
      disconnectStargate();
    }
  });
  // Register E2EE device for current user when authenticated (enables receiving messages)
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
  onCleanup(() => disconnectStargate());
  return <>{props.children}</>;
};
