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
import { spaces, initSpaceHandlers } from '../stores/spaces';
import { initSpaceMembersHandlers, markSpaceMembersStale } from '../stores/spaceMembers';
import { initUserProfileHandler } from '../stores/userProfile';
import { initE2EESyncHandlers } from '../stores/e2eeSync';
import { bootstrapE2EEDevice } from '../stores/e2eeBootstrap';
import { initCustomEmojiHandlers, loadCustomEmojis } from '../stores/customEmojis';
import { initRoomNotifySettingsHandler } from '../lib/roomNotify';
import { resyncDevice } from '../lib/e2ee/service';
import { applyVoiceSettingsToSession, initPushToTalk, initVoiceHandlers, voice } from '../stores/voice';
import { voiceSettings } from '../stores/voiceSettings';
import { initInstanceHandlers, loadInstanceCapabilities, loadInstanceInfo } from '../stores/instance';
import { on } from 'solid-js';

// How long to wait for the WS READY payload before falling back to REST. Only matters
// when the socket is slow/stuck (never fires on the happy path - cleared as soon as
// READY arrives), so keep it short enough that a broken connection doesn't stall the UI.
const READY_FALLBACK_MS = 5000;

/** Connects Stargate WebSocket when authenticated; bootstrap from READY (skip REST). */
export const StargateProvider: Component<{ children?: import('solid-js').JSX.Element }> = (props) => {
  onMount(() => {
    initStargateMessageHandler();
    initPresenceHandler();
    initReadStateHandler();
    initTypingHandler();
    initRelationshipHandlers();
    initRoomHandlers();
    initSpaceHandlers();
    initSpaceMembersHandlers();
    initUserProfileHandler();
    initE2EESyncHandlers();
    initCustomEmojiHandlers();
    initRoomNotifySettingsHandler();
    initVoiceHandlers();
    onCleanup(initInstanceHandlers());
    onCleanup(initPushToTalk());
    // Whether this instance has voice (and a captcha, federation...) - decides which
    // call controls exist at all.
    void loadInstanceInfo();
  });

  onMount(() => {
    const unsub = onStargateReady((payload) => {
      hydrateFromReady(payload);
      // Custom emoji aren't part of READY; one REST fetch per connection keeps the picker
      // and <:name:id> rendering warm across reconnects (membership may have changed).
      void loadCustomEmojis();
      // Member lists are cached per connection: whatever changed while the socket was
      // down was never seen, so the next visit to each space re-fetches its list.
      markSpaceMembersStale();
      // Likewise for E2EE: drain any to-device messages (room keys) that were pushed
      // while this client was disconnected.
      const uid = auth.user?.id;
      if (uid) void resyncDevice(uid).catch((err) => console.warn('[e2ee] device resync after reconnect failed', err));
      // Whether this account administers the instance - decides if the dashboard exists.
      void loadInstanceCapabilities();
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

  // Device and processing changes made in settings reach a live call at once: the
  // microphone pipeline is rebuilt for input changes, the output device switched, and
  // volume / sensitivity re-applied.
  createEffect(
    on(
      () => [voiceSettings.inputDeviceId, voiceSettings.echoCancellation, voiceSettings.noiseSuppression, voiceSettings.autoGainControl] as const,
      () => {
        if (voice.session.status !== 'idle') void applyVoiceSettingsToSession({ input: true });
      },
      { defer: true }
    )
  );
  createEffect(
    on(
      () => voiceSettings.outputDeviceId,
      () => {
        if (voice.session.status !== 'idle') void applyVoiceSettingsToSession({ output: true });
      },
      { defer: true }
    )
  );
  createEffect(
    on(
      () => voiceSettings.cameraDeviceId,
      () => {
        if (voice.session.status !== 'idle') void applyVoiceSettingsToSession({ camera: true });
      },
      { defer: true }
    )
  );
  createEffect(
    on(
      () => [voiceSettings.inputVolume, voiceSettings.outputVolume, voiceSettings.sensitivityDb, voiceSettings.autoSensitivity] as const,
      () => {
        if (voice.session.status !== 'idle') void applyVoiceSettingsToSession({});
      },
      { defer: true }
    )
  );

  createEffect(() => {
    const token = auth.token;
    const hydrated = auth.hydrated;
    if (!token || hydrated) return;
    const t = setTimeout(() => {
      if (!auth.hydrated && auth.token) bootstrapFromRest();
    }, READY_FALLBACK_MS);
    onCleanup(() => clearTimeout(t));
  });

  createEffect(() => {
    const uid = auth.user?.id;
    if (uid) {
      bootstrapE2EEDevice(uid).catch((err) => console.error('E2EE device bootstrap failed:', err));
    }
  });

  createEffect(() => {
    if (stargate.ready && auth.user?.id) {
      subscribe(undefined, auth.user.id);
    }
  });

  createEffect(() => {
    if (!stargate.ready) return;
    const list = spaces.spaces;
    for (const s of list) {
      if (s.id) subscribe(s.id, undefined);
    }
    onCleanup(() => {
      for (const s of list) {
        if (s.id) unsubscribe(s.id, undefined);
      }
    });
  });

  // Subscribe to every channel in every space the user belongs to, not just the space
  // container (which only carries space-wide events like renames/role changes) and not
  // just whichever single channel RoomPage/SpacePage is actively viewing. Without this,
  // MESSAGE_CREATE/MESSAGE_ACK for a channel you aren't currently looking at never
  // reaches this client, so sidebar/space-icon unread badges for it go stale until a
  // full reload - the "doesn't update in real time" and "doesn't clear after reading"
  // complaints are the same root cause: no live signal for backgrounded channels.
  createEffect(() => {
    if (!stargate.ready) return;
    const roomIds = new Set<string>();
    for (const list of Object.values(spaces.spaceRoomsBySpaceId)) {
      for (const r of list) {
        if (r.id) roomIds.add(r.id);
      }
    }
    for (const id of roomIds) subscribe(id, undefined);
    onCleanup(() => {
      for (const id of roomIds) unsubscribe(id, undefined);
    });
  });

  createEffect(() => {
    if (!stargate.ready) return;
    const list = rooms.rooms;
    for (const r of list) {
      if (r.id) subscribe(r.id, undefined);
    }
    onCleanup(() => {
      for (const r of list) {
        if (r.id) unsubscribe(r.id, undefined);
      }
    });
  });

  onCleanup(() => disconnectStargate());
  return <>{props.children}</>;
};
