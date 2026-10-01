/**
 * Voice and video: who is in which voice room (server-authoritative voice states,
 * delivered in READY and kept current by VOICE_STATE_UPDATE), the PM calls that are
 * ringing or running, and this device's own connection to LiveKit - microphone,
 * camera, screen share, deafen, per-user volumes, speaking indicators.
 *
 * The media runs on LiveKit; the API decides who may be where (permissions, user
 * limits, moderator actions) and hands out a room-scoped token. Everything the UI
 * renders comes from this store; components never touch the LiveKit room directly.
 */

import { createSignal, batch } from 'solid-js';
import { createStore, produce, reconcile } from 'solid-js/store';
import {
  ConnectionQuality,
  ConnectionState,
  DisconnectReason,
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  type LocalTrackPublication,
  type Participant,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from 'livekit-client';
import {
  declineCall,
  disconnectVoiceMember,
  joinVoice,
  leaveVoice,
  moderateVoice,
  patchVoiceState,
  ringCall,
  type VoiceCall,
  type VoiceState,
} from '../api/voice';
import { auth } from './auth';
import { registerUserIdentity } from './federationIds';
import { onStargateEvent } from '../services/stargate/client';
import { audioConstraints, setVoiceSettings, voiceSettings } from './voiceSettings';
import { comboFromEvent } from './keybinds';
import { createMicPipeline, createVadGate, createVoiceAudioContext, type MicPipeline } from '../lib/voice/micPipeline';
import { screenShareCaptureOptions, screenShareEncoding } from '../lib/voice/screenShare';
import type { ScreenShareFps, ScreenShareResolution } from './voiceSettings';
import { sampleVoiceStats, type VoiceStatsSample, type VoiceStatsSnapshot } from '../lib/voice/stats';
import { playRingtone, stopRingtone } from '../lib/voice/ringtone';
import { CallKeyProvider, callEncryptionSupported, createE2EEWorker } from '../lib/voice/e2ee';
import {
  MEDIA_KEY_RING_SIZE,
  generateMediaKey,
  onIncomingMediaKey,
  sendMediaKey,
  userIdOfIdentity,
  type IncomingMediaKey,
} from '../lib/e2ee/callKeys';

export type VoiceSessionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting';
export type VoiceQuality = 'excellent' | 'good' | 'poor' | 'lost' | 'unknown';

export interface VoiceSession {
  roomId: string | null;
  spaceId: string | null;
  status: VoiceSessionStatus;
  selfMute: boolean;
  selfDeaf: boolean;
  camera: boolean;
  screen: boolean;
  /** Imposed by a moderator (mirrors our own voice state). */
  serverMute: boolean;
  serverDeaf: boolean;
  /** No Speak permission here: no microphone at all. */
  suppress: boolean;
  quality: VoiceQuality;
  /** The browser refused to play audio without a gesture; show the "enable audio" prompt. */
  audioBlocked: boolean;
  /** Likewise for video: a browser set to block all autoplay leaves the tiles black
   * until a click (Firefox's strictest setting does this even for muted video). */
  videoBlocked: boolean;
  /** Last microphone / camera / screen error to show the user (i18n key). */
  error: string | null;
  /** Bitrate the room asked for (bits per second). */
  bitrate: number;
  /** Media is end-to-end encrypted (always true once connected - see joinVoiceRoom). */
  encrypted: boolean;
  /** Participants we hold a media key for, by LiveKit identity. Anyone connected but
   * missing here cannot be decrypted yet (their key is still in flight). */
  keyed: string[];
}

/** Track sids a participant is currently publishing, by kind. */
export interface ParticipantMedia {
  camera?: string;
  screen?: string;
  screenAudio?: string;
}

export interface IncomingCall {
  roomId: string;
  startedBy: string;
  /** When we were last rung; the prompt expires RING_TIMEOUT_MS after this. */
  since: number;
}

interface VoiceStoreState {
  /** Every voice state we know, by room. */
  byRoom: Record<string, VoiceState[]>;
  /** Ringing / running PM calls by room. */
  calls: Record<string, VoiceCall>;
  /** A call ringing this device, if any. */
  incoming: IncomingCall | null;
  session: VoiceSession;
  /** Who is talking right now (user id -> true), local user included. */
  speaking: Record<string, boolean>;
  /** Published camera / screen tracks by user id (sids; see trackFor). */
  media: Record<string, ParticipantMedia>;
  /** Tile a viewer chose to spotlight: "<userId>" or "<userId>:screen". */
  focus: string | null;
  /** Per-user playback volume, 0..200 (%). Persisted. */
  userVolumes: Record<string, number>;
  /** Locally muted users (this device only). Persisted. */
  localMuted: Record<string, boolean>;
  /** Microphone input level while connected (dBFS), for meters. */
  micLevel: number;
  /** True while a VoiceStage is on screen (the dock hides its duplicate controls). */
  stageVisible: boolean;
}

const VOLUMES_KEY = 'strafe_voice_volumes';
const LOCAL_MUTED_KEY = 'strafe_voice_local_muted';
/** How long an incoming call rings before the prompt gives up. */
export const RING_TIMEOUT_MS = 45_000;

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* ignore */
  }
  return fallback;
}

function saveJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

/** Per-user volume ceiling, percent. Playback is a Web Audio gain, so a boost is possible. */
export const MAX_USER_VOLUME = 200;

function clampVolumes(raw: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [uid, v] of Object.entries(raw)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[uid] = Math.min(MAX_USER_VOLUME, Math.max(0, Math.round(v)));
  }
  return out;
}

const idleSession: VoiceSession = {
  roomId: null,
  spaceId: null,
  status: 'idle',
  selfMute: false,
  selfDeaf: false,
  camera: false,
  screen: false,
  serverMute: false,
  serverDeaf: false,
  suppress: false,
  quality: 'unknown',
  audioBlocked: false,
  videoBlocked: false,
  error: null,
  bitrate: 64_000,
  encrypted: false,
  keyed: [],
};

export const [voice, setVoice] = createStore<VoiceStoreState>({
  byRoom: {},
  calls: {},
  incoming: null,
  session: { ...idleSession },
  speaking: {},
  media: {},
  focus: null,
  userVolumes: clampVolumes(loadJSON<Record<string, number>>(VOLUMES_KEY, {})),
  localMuted: loadJSON<Record<string, boolean>>(LOCAL_MUTED_KEY, {}),
  micLevel: -100,
  stageVisible: false,
});

// ---- selectors ----------------------------------------------------------------------------

export function voiceStatesForRoom(roomId: string): VoiceState[] {
  return voice.byRoom[roomId] ?? [];
}

export function myVoiceState(): VoiceState | undefined {
  const rid = voice.session.roomId;
  const uid = auth.user?.id;
  if (!rid || !uid) return undefined;
  return voice.byRoom[rid]?.find((s) => s.user_id === uid);
}

/** The room the current user is in according to the server (any device). */
export function voiceRoomOfUser(userId: string): string | undefined {
  for (const [rid, list] of Object.entries(voice.byRoom)) {
    if (list.some((s) => s.user_id === userId)) return rid;
  }
  return undefined;
}

export function isConnectedTo(roomId: string): boolean {
  return voice.session.roomId === roomId && voice.session.status !== 'idle';
}

export function effectiveUserVolume(userId: string): number {
  if (voice.localMuted[userId]) return 0;
  return ((voice.userVolumes[userId] ?? 100) / 100) * (voiceSettings.outputVolume / 100);
}

// ---- LiveKit session -----------------------------------------------------------------------

/** Live objects that must not go through the reactive store. */
const live = {
  room: null as Room | null,
  /**
   * One AudioContext for the whole call, capture and playback alike. It is created (or
   * resumed) synchronously inside the click that joins, because that is the only moment
   * browsers that gate audio behind a gesture (Safari above all) let one start; a
   * context created later, after the join request came back, would sit suspended and
   * the call would be silent until the user tapped something. Kept across calls and
   * suspended in between, so a rejoin the user did not click for (a moderator move, a
   * reconnect) reuses a context that is already allowed to run.
   */
  audioContext: null as AudioContext | null,
  mic: null as MicPipeline | null,
  micPub: null as LocalTrackPublication | null,
  /** Incremented per join so callbacks from a superseded room are ignored. */
  gen: 0,
  tracks: new Map<string, Track>(),
  audioElements: new Map<string, HTMLMediaElement>(),
  pttHeld: false,
  pttReleaseTimer: 0 as number,
  vad: createVadGate(),
  /** A move by a moderator: the room we were told to rejoin. */
  movingTo: null as string | null,
  /** A priority speaker is talking: everyone else is ducked. */
  ducked: false,
  /** Keeps the ducking on for a moment after the priority speaker pauses (see below). */
  duckReleaseTimer: 0 as number,
  /** Counters from the last statistics sample, for per-interval rates. */
  statsSample: null as VoiceStatsSample | null,
  /**
   * Microphone rebuilds run one at a time. Two overlapping rebuilds each unpublish what
   * they found and publish their own track, which leaves a publication nobody is tracking
   * - still transmitting, and out of reach of mute. `micRebuildPending` folds a request
   * made while one is already queued into that one, since a queued rebuild reads the
   * settings when it runs rather than when it was asked for.
   */
  micWork: Promise.resolve() as Promise<void>,
  micRebuildPending: false,
  // ---- end-to-end encryption (see lib/voice/e2ee.ts and lib/e2ee/callKeys.ts) ----
  keyProvider: null as CallKeyProvider | null,
  e2eeWorker: null as Worker | null,
  /** This device's own media key for the current call, and its key-ring slot. */
  mediaKey: null as Uint8Array | null,
  mediaKeyIndex: 0,
  /** Our LiveKit participant identity ("<user id>.<session id>") for this call. */
  identity: null as string | null,
  /** Keys that arrived before the provider existed, replayed once it does. */
  pendingKeys: [] as IncomingMediaKey[],
  /** The participant set our key was last distributed to, to spot membership changes. */
  keyedMemberSig: '',
  /** Coalesces a burst of joins/leaves into one rotation. */
  rotateTimer: 0 as number,
  /** Rotations run one after another; a second membership change waits for the first. */
  rotation: Promise.resolve(),
};

const [trackVersion, setTrackVersion] = createSignal(0);

/** How long others stay ducked after a priority speaker stops talking. */
const DUCK_RELEASE_MS = 700;

/** A published track by sid; reactive on publication changes. */
export function trackFor(sid: string | undefined): Track | undefined {
  void trackVersion();
  return sid ? live.tracks.get(sid) : undefined;
}

function userIdOf(p: Participant | string): string {
  return userIdOfIdentity(typeof p === 'string' ? p : p.identity);
}

function audioSink(): HTMLElement {
  let el = document.getElementById('voice-audio-sink');
  if (!el) {
    el = document.createElement('div');
    el.id = 'voice-audio-sink';
    el.setAttribute('aria-hidden', 'true');
    el.style.display = 'none';
    document.body.appendChild(el);
  }
  return el;
}

/**
 * Recompute what a remote participant should play at: their volume, deafen, ducking.
 * Playback goes through the call's AudioContext (LiveKit's `webAudioMix` with our
 * context), so the value is a gain and may exceed 1.
 */
function applyVolume(p: RemoteParticipant) {
  const uid = userIdOf(p);
  let v = effectiveUserVolume(uid);
  if (voice.session.selfDeaf || voice.session.serverDeaf) v = 0;
  const st = voice.byRoom[voice.session.roomId ?? '']?.find((s) => s.user_id === uid);
  if (live.ducked && !st?.priority_speaker) v *= 0.35;
  const vol = Math.min(2, Math.max(0, v));
  p.setVolume(vol, Track.Source.Microphone);
  p.setVolume(vol, Track.Source.ScreenShareAudio);
}

function applyAllVolumes() {
  live.room?.remoteParticipants.forEach((p) => applyVolume(p));
}

/** Whether our microphone should be transmitting right now. */
function computeGate(): boolean {
  const s = voice.session;
  if (s.selfMute || s.selfDeaf || s.serverMute || s.serverDeaf || s.suppress) return false;
  if (voiceSettings.inputMode === 'ptt') return live.pttHeld;
  return live.vad.update(live.mic?.level() ?? -100, voiceSettings.sensitivityDb, voiceSettings.autoSensitivity);
}

function refreshGate() {
  live.mic?.setOpen(computeGate());
}

/** The call's AudioContext, created on first use and resumed (see `live.audioContext`). */
function callAudioContext(): AudioContext {
  let ctx = live.audioContext;
  if (!ctx || ctx.state === 'closed') {
    ctx = createVoiceAudioContext();
    live.audioContext = ctx;
  }
  if (ctx.state !== 'running') void ctx.resume().catch(() => undefined);
  return ctx;
}

/** Every microphone publication on this connection, tracked or not. */
function micPublications(room: Room): LocalTrackPublication[] {
  return [...room.localParticipant.trackPublications.values()].filter((p) => p.source === Track.Source.Microphone);
}

/**
 * Swap the microphone for one built from the current settings. Capture-time options
 * (device, noise suppression, echo cancellation, gain control) cannot be changed on a
 * running track, so the pipeline is rebuilt and the published track replaced.
 *
 * Unpublishing goes by *source* rather than by the publication we happen to be holding:
 * that also clears anything a previous overlapping rebuild left behind, so a session that
 * has already been broken heals on the next change instead of accumulating microphones.
 */
async function rebuildMicrophone(room: Room): Promise<void> {
  const gen = live.gen;
  const old = live.mic;
  live.mic = null;
  live.micPub = null;
  for (const pub of micPublications(room)) {
    if (pub.track) await room.localParticipant.unpublishTrack(pub.track, true).catch(() => undefined);
  }
  old?.close();
  if (gen !== live.gen || live.room !== room) return;
  await publishMicrophone(room, gen);
}

/**
 * Run something that publishes or unpublishes the microphone, after whatever is already
 * doing so. Everything that touches the microphone goes through here - the join's first
 * publish included - because a settings change landing while the join publishes would
 * otherwise overlap it exactly the way two rebuilds do.
 */
function queueMicWork(fn: () => Promise<void>): Promise<void> {
  live.micWork = live.micWork.catch(() => undefined).then(fn);
  return live.micWork;
}

/** Queue a microphone rebuild, folding it into one already waiting. */
function queueMicRebuild(room: Room): Promise<void> {
  if (live.micRebuildPending) return live.micWork;
  live.micRebuildPending = true;
  return queueMicWork(async () => {
    // Cleared as the rebuild *starts*: a change made while it runs needs its own pass.
    live.micRebuildPending = false;
    if (live.room !== room) return;
    await rebuildMicrophone(room);
  });
}

async function publishMicrophone(room: Room, gen: number) {
  if (voice.session.suppress) return;
  try {
    const pipeline = await createMicPipeline({
      constraints: audioConstraints(),
      inputGain: voiceSettings.inputVolume / 100,
      noiseSuppression: voiceSettings.noiseSuppression,
      context: callAudioContext(),
      onLevel: (db) => {
        setVoice('micLevel', db);
        if (voiceSettings.inputMode === 'vad' && !voiceSettings.autoSensitivity) refreshGate();
      },
    });
    if (gen !== live.gen || live.room !== room) {
      pipeline.close();
      return;
    }
    live.mic = pipeline;
    // Losing the device (unplugged) shows as the source track ending.
    pipeline.source.addEventListener('ended', () => {
      if (live.mic === pipeline) {
        setVoice('session', 'error', 'voice.errors.micLost');
      }
    });
    const pub = await room.localParticipant.publishTrack(pipeline.track, {
      source: Track.Source.Microphone,
      name: 'microphone',
      // No Opus DTX: with it the encoder stops sending between words and the far end
      // fills the gaps with generated comfort noise, so the noise floor audibly switches
      // on and off around speech - a breathing, pulsing sound. The gate already sends
      // digital silence when closed, which Opus VBR encodes in a few bytes a frame, so
      // continuous frames cost almost nothing. (Discord does not use DTX either.)
      dtx: false,
      red: true,
      audioPreset: { maxBitrate: voice.session.bitrate },
    });
    if (gen !== live.gen) return;
    live.micPub = pub;
    if (voice.session.selfMute || voice.session.selfDeaf || voice.session.serverMute) await pub.mute();
    refreshGate();
  } catch (err) {
    console.warn('[voice] microphone unavailable', err);
    setVoice('session', 'error', err instanceof Error && err.name === 'NotAllowedError' ? 'voice.errors.micDenied' : 'voice.errors.micFailed');
  }
}

function wireRoom(room: Room, gen: number) {
  const mine = () => gen === live.gen && live.room === room;

  room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, pub: RemoteTrackPublication, participant: RemoteParticipant) => {
    if (!mine()) return;
    const uid = userIdOf(participant);
    if (track.kind === Track.Kind.Audio) {
      live.audioElements.get(pub.trackSid)?.remove();
      const el = track.attach();
      audioSink().appendChild(el);
      live.audioElements.set(pub.trackSid, el);
      applyVolume(participant);
      return;
    }
    live.tracks.set(pub.trackSid, track);
    setMedia(uid, pub.source === Track.Source.ScreenShare ? 'screen' : 'camera', pub.trackSid);
  });

  room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, pub: RemoteTrackPublication, participant: RemoteParticipant) => {
    if (!mine()) return;
    const uid = userIdOf(participant);
    if (track.kind === Track.Kind.Audio) {
      // Our own map, not detach()'s return value: after a server-side subscription
      // revoke the SDK has already forgotten the element and would leave it playing.
      const el = live.audioElements.get(pub.trackSid);
      if (el) {
        track.detach(el);
        el.remove();
      }
      track.detach().forEach((x) => x.remove());
      live.audioElements.delete(pub.trackSid);
      return;
    }
    track.detach();
    live.tracks.delete(pub.trackSid);
    setMedia(uid, pub.source === Track.Source.ScreenShare ? 'screen' : 'camera', undefined);
    if (voice.focus === `${uid}:screen` && pub.source === Track.Source.ScreenShare) setVoice('focus', null);
  });

  room.on(RoomEvent.LocalTrackPublished, (pub: LocalTrackPublication) => {
    if (!mine() || !pub.track) return;
    const uid = auth.user?.id ?? userIdOf(room.localParticipant);
    if (pub.source === Track.Source.Camera || pub.source === Track.Source.ScreenShare) {
      live.tracks.set(pub.trackSid, pub.track);
      setMedia(uid, pub.source === Track.Source.ScreenShare ? 'screen' : 'camera', pub.trackSid);
    }
  });

  room.on(RoomEvent.LocalTrackUnpublished, (pub: LocalTrackPublication) => {
    if (!mine()) return;
    const uid = auth.user?.id ?? userIdOf(room.localParticipant);
    if (pub.source === Track.Source.Camera || pub.source === Track.Source.ScreenShare) {
      live.tracks.delete(pub.trackSid);
      setMedia(uid, pub.source === Track.Source.ScreenShare ? 'screen' : 'camera', undefined);
      // The browser's own "Stop sharing" button ends the screen track; keep our state
      // and the server's in step with what is actually published.
      if (pub.source === Track.Source.ScreenShare && voice.session.screen) {
        setVoice('session', 'screen', false);
        void patchVoiceState({ self_stream: false }).catch(() => undefined);
      }
      if (pub.source === Track.Source.Camera && voice.session.camera) {
        setVoice('session', 'camera', false);
        void patchVoiceState({ self_video: false }).catch(() => undefined);
      }
    }
  });

  room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
    if (!mine()) return;
    const next: Record<string, boolean> = {};
    for (const p of speakers) next[userIdOf(p)] = true;
    // reconcile, not a plain set: a store setter merges objects, so someone who stopped
    // talking would otherwise keep their "speaking" flag forever.
    setVoice('speaking', reconcile(next));
    // Priority speaker: while one talks, everyone else is turned down. Releasing is
    // held back a little, because speaker detection flips on every pause for breath and
    // ducking that follows each flip pumps everyone else's volume up and down.
    const rid = voice.session.roomId ?? '';
    const me = auth.user?.id;
    const ducked = speakers.some((p) => {
      const uid = userIdOf(p);
      if (uid === me) return false;
      return voice.byRoom[rid]?.find((s) => s.user_id === uid)?.priority_speaker === true;
    });
    window.clearTimeout(live.duckReleaseTimer);
    if (ducked && !live.ducked) {
      live.ducked = true;
      applyAllVolumes();
    } else if (!ducked && live.ducked) {
      live.duckReleaseTimer = window.setTimeout(() => {
        if (!mine()) return;
        live.ducked = false;
        applyAllVolumes();
      }, DUCK_RELEASE_MS);
    }
  });

  room.on(RoomEvent.ParticipantConnected, (p: RemoteParticipant) => {
    if (!mine()) return;
    applyVolume(p);
    // The server's state change usually gets here first and has already rotated; this
    // covers the case where LiveKit sees them before the gateway event lands.
    syncCallKeys();
  });

  room.on(RoomEvent.EncryptionError, (error: Error) => {
    if (!mine()) return;
    // Almost always a key that hasn't arrived yet - it resolves itself when the peer's
    // to-device message lands, so this is a note, not a failure.
    console.warn('[voice-e2ee] frame encryption error', error.message);
  });

  room.on(RoomEvent.ConnectionQualityChanged, (quality: ConnectionQuality, participant: Participant) => {
    if (!mine() || participant !== room.localParticipant) return;
    const map: Record<ConnectionQuality, VoiceQuality> = {
      [ConnectionQuality.Excellent]: 'excellent',
      [ConnectionQuality.Good]: 'good',
      [ConnectionQuality.Poor]: 'poor',
      [ConnectionQuality.Lost]: 'lost',
      [ConnectionQuality.Unknown]: 'unknown',
    };
    setVoice('session', 'quality', map[quality] ?? 'unknown');
  });

  room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
    if (!mine()) return;
    if (state === ConnectionState.Reconnecting || state === ConnectionState.SignalReconnecting) {
      setVoice('session', 'status', 'reconnecting');
    } else if (state === ConnectionState.Connected) {
      setVoice('session', 'status', 'connected');
    }
  });

  room.on(RoomEvent.AudioPlaybackStatusChanged, (playing: boolean) => {
    if (mine()) setVoice('session', 'audioBlocked', !playing);
  });
  room.on(RoomEvent.VideoPlaybackStatusChanged, (playing: boolean) => {
    if (mine()) setVoice('session', 'videoBlocked', !playing);
  });

  room.on(RoomEvent.MediaDevicesError, (err: Error, kind?: MediaDeviceKind) => {
    if (!mine()) return;
    const denied = err.name === 'NotAllowedError';
    setVoice('session', 'error', kind === 'videoinput' ? (denied ? 'voice.errors.cameraDenied' : 'voice.errors.cameraFailed') : denied ? 'voice.errors.micDenied' : 'voice.errors.micFailed');
  });

  room.on(RoomEvent.ParticipantPermissionsChanged, (_prev, participant: Participant) => {
    if (!mine() || participant !== room.localParticipant) return;
    // The server just changed what we may publish (server mute / unmute, deafen);
    // our voice state carries the why, this only keeps the gate honest.
    refreshGate();
  });

  room.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
    if (!mine()) return;
    const wasIn = voice.session.roomId;
    const moving = live.movingTo;
    teardownLocal();
    if (moving) {
      live.movingTo = null;
      void joinVoiceRoom(moving).catch((err) => console.warn('[voice] rejoin after move failed', err));
      return;
    }
    if (reason === DisconnectReason.CLIENT_INITIATED) return;
    // LiveKit dropped us: a moderator moved or disconnected us, another device took
    // over, the room ended, or the connection died. The server's word on where we are
    // arrives over the gateway and may land just after this - give it a moment, then
    // act on it: rejoin where we were moved to, do nothing if we were removed, and
    // clear a state the server still holds only when the link itself died.
    window.setTimeout(() => {
      if (voice.session.status !== 'idle') return; // something else already reconnected
      const me = auth.user?.id;
      const now = me ? voiceRoomOfUser(me) : undefined;
      if (now && now !== wasIn) {
        void joinVoiceRoom(now).catch((err) => console.warn('[voice] rejoin after move failed', err));
      } else if (now && now === wasIn) {
        void leaveVoice().catch(() => undefined);
      }
    }, 1500);
  });
}

/** Drop everything about the current LiveKit connection (not the server-side state). */
function teardownLocal() {
  live.gen += 1;
  const room = live.room;
  live.room = null;
  live.micPub = null;
  if (live.mic) {
    live.mic.close();
    live.mic = null;
  }
  if (room) {
    void room.disconnect(true).catch(() => undefined);
  }
  for (const el of live.audioElements.values()) el.remove();
  live.audioElements.clear();
  live.tracks.clear();
  live.ducked = false;
  window.clearTimeout(live.duckReleaseTimer);
  live.pttHeld = false;
  window.clearTimeout(live.pttReleaseTimer);
  live.statsSample = null;
  live.micRebuildPending = false;
  live.micWork = Promise.resolve();
  // Idle between calls: a running context keeps the audio hardware (and on phones the
  // audio session) awake. Resumed again by the next join.
  if (live.audioContext?.state === 'running') void live.audioContext.suspend().catch(() => undefined);
  // Drop this call's key material and the worker holding it.
  window.clearTimeout(live.rotateTimer);
  live.keyProvider = null;
  live.e2eeWorker?.terminate();
  live.e2eeWorker = null;
  live.mediaKey = null;
  live.mediaKeyIndex = 0;
  live.identity = null;
  live.pendingKeys = [];
  live.keyedMemberSig = '';
  live.rotation = Promise.resolve();
  setTrackVersion((v) => v + 1);
  batch(() => {
    setVoice('session', { ...idleSession, selfMute: voice.session.selfMute, selfDeaf: voice.session.selfDeaf });
    setVoice(
      produce((s) => {
        s.speaking = {};
        s.media = {};
        s.focus = null;
        s.micLevel = -100;
      })
    );
  });
}

/** Record (or clear, with undefined) the sid of a user's camera / screen track. */
function setMedia(userId: string, kind: 'camera' | 'screen', sid: string | undefined) {
  // One batch: written separately, a tile's attach effect ran twice per change and the
  // second run detached and re-attached the video - which, under adaptive stream, told
  // the server to stop and restart the track.
  batch(() => {
    setVoice(
      produce((s) => {
        const m = (s.media[userId] ??= {});
        if (sid) m[kind] = sid;
        else delete m[kind];
      })
    );
    setTrackVersion((v) => v + 1);
  });
}

// ---- end-to-end encryption -------------------------------------------------------------

/** Thrown when the browser cannot do encrypted media; we never fall back to plaintext. */
export class CallEncryptionUnsupportedError extends Error {
  constructor() {
    super('this browser cannot encrypt call media');
    this.name = 'CallEncryptionUnsupportedError';
  }
}

/** Other people currently in the room, by user id (the key recipients). */
function otherParticipantUserIds(roomId: string): string[] {
  const me = auth.user?.id;
  const ids = new Set<string>();
  for (const st of voice.byRoom[roomId] ?? []) {
    if (st.user_id !== me) ids.add(st.user_id);
  }
  return [...ids];
}

/** Stable signature of the room's participant set, to spot membership changes. */
function memberSignature(roomId: string): string {
  return otherParticipantUserIds(roomId).sort().join(',');
}

function markKeyed(identity: string): void {
  if (voice.session.keyed.includes(identity)) return;
  setVoice('session', 'keyed', (list) => [...list, identity]);
}

/** Install a peer's media key, or hold it until the provider exists. */
function applyIncomingKey(key: IncomingMediaKey): void {
  if (!live.keyProvider || key.roomId !== voice.session.roomId) {
    // Arrived while we were still connecting: replay it once we are up. Keep the
    // buffer small - only the newest key per identity can still be useful.
    live.pendingKeys = live.pendingKeys.filter((k) => k.identity !== key.identity).concat(key);
    if (live.pendingKeys.length > 64) live.pendingKeys.shift();
    return;
  }
  void live.keyProvider
    .setParticipantKey(key.key, key.identity, key.keyIndex)
    .then(() => markKeyed(key.identity))
    .catch((err) => console.warn('[voice-e2ee] could not install peer media key', key.identity, err));
}

function flushPendingKeys(): void {
  const pending = live.pendingKeys;
  live.pendingKeys = [];
  for (const key of pending) applyIncomingKey(key);
}

/** Hand a key (ours, or the one we are about to switch to) to everyone now in the room. */
async function distributeMediaKey(announce?: { key: Uint8Array; index: number }): Promise<void> {
  const me = auth.user?.id;
  const roomId = voice.session.roomId;
  const identity = live.identity;
  const key = announce?.key ?? live.mediaKey;
  const keyIndex = announce?.index ?? live.mediaKeyIndex;
  if (!me || !roomId || !identity || !key) return;
  const targets = otherParticipantUserIds(roomId);
  live.keyedMemberSig = targets.slice().sort().join(',');
  if (targets.length === 0) return;
  try {
    await sendMediaKey(me, { roomId, identity, keyIndex, key }, targets);
  } catch (err) {
    console.error('[voice-e2ee] could not distribute media key', err);
    setVoice('session', 'error', 'voice.errors.keyShareFailed');
  }
}

/**
 * Roll this device's media key onto the next key-ring slot. Called on every membership
 * change: someone who left can no longer decrypt what follows, and someone who joined
 * cannot decrypt what the SFU already carried.
 *
 * The new key goes out *before* a single frame uses it. Switching first meant every
 * peer lost our audio and video for as long as the to-device delivery took (and their
 * video then sat on a missing keyframe); with the key already installed on their side,
 * the changeover is silent.
 */
async function rotateMediaKey(): Promise<void> {
  const provider = live.keyProvider;
  const identity = live.identity;
  if (!provider || !identity) return;
  const key = generateMediaKey();
  const index = (live.mediaKeyIndex + 1) % MEDIA_KEY_RING_SIZE;
  await distributeMediaKey({ key, index });
  // Hung up (or rejoined) while the key was in flight: that call's provider is gone.
  if (live.keyProvider !== provider || live.identity !== identity) return;
  live.mediaKey = key;
  live.mediaKeyIndex = index;
  await provider.setParticipantKey(key, identity, index);
}

/**
 * React to the room's participant set changing: rotate and redistribute. Debounced so a
 * burst of joins costs one rotation rather than one each, and serialised so a change
 * that lands mid-rotation queues the next one instead of racing it.
 */
function syncCallKeys(): void {
  const roomId = voice.session.roomId;
  // While connecting, joinVoiceRoom hands the key out itself and calls back here after.
  if (!roomId || !live.keyProvider || voice.session.status === 'connecting') return;
  if (memberSignature(roomId) === live.keyedMemberSig) return;
  window.clearTimeout(live.rotateTimer);
  live.rotateTimer = window.setTimeout(() => {
    const rid = voice.session.roomId;
    if (!live.keyProvider || !rid || memberSignature(rid) === live.keyedMemberSig) return;
    live.rotation = live.rotation
      .then(() => rotateMediaKey())
      .catch((err) => console.error('[voice-e2ee] rotation failed', err));
  }, 300);
}

/**
 * Join a voice room (a space voice room, or start / answer the call in a PM). Leaves
 * the current one first. Resolves once the media connection is up.
 */
export async function joinVoiceRoom(roomId: string, opts: { video?: boolean } = {}): Promise<void> {
  const me = auth.user?.id;
  if (!me) return;
  // Calls are end-to-end encrypted, with no plaintext fallback: a browser that cannot
  // encrypt media is told so rather than quietly joining in the clear.
  if (!callEncryptionSupported()) throw new CallEncryptionUnsupportedError();
  // Before the first await, i.e. still inside the click that started this join: the
  // audio context must be started by a gesture on browsers that require one.
  const audioContext = callAudioContext();
  if (live.room && voice.session.roomId !== roomId) teardownLocal();
  const gen = ++live.gen;
  batch(() => {
    setVoice('session', {
      ...voice.session,
      roomId,
      status: 'connecting',
      error: null,
      audioBlocked: false,
      videoBlocked: false,
      camera: false,
      screen: false,
    });
    setVoice('incoming', (inc) => (inc?.roomId === roomId ? null : inc));
  });
  stopRingtone();
  let res;
  try {
    res = await joinVoice(roomId, { self_mute: voice.session.selfMute, self_deaf: voice.session.selfDeaf });
  } catch (err) {
    if (gen === live.gen) setVoice('session', { ...voice.session, roomId: null, status: 'idle' });
    throw err;
  }
  if (gen !== live.gen) return;
  applyStates(res.states);
  if (res.call) setVoice('calls', roomId, res.call);
  batch(() => {
    setVoice('session', {
      ...voice.session,
      spaceId: res.state.space_id ?? null,
      serverMute: res.state.mute,
      serverDeaf: res.state.deaf,
      suppress: res.state.suppress,
      bitrate: res.bitrate,
    });
  });

  // One provider and worker per call, so a previous call's keys are never in memory.
  const keyProvider = new CallKeyProvider();
  const e2eeWorker = createE2EEWorker();
  live.keyProvider = keyProvider;
  live.e2eeWorker = e2eeWorker;
  // The identity the token was minted for - federated form in a room shared with
  // another instance - must be what our own media key is published under.
  live.identity = res.state.identity ?? `${res.state.user_id}.${res.state.session_id}`;
  live.mediaKey = generateMediaKey();
  live.mediaKeyIndex = 0;
  live.keyedMemberSig = '';

  const room = new Room({
    e2ee: { keyProvider, worker: e2eeWorker },
    adaptiveStream: true,
    dynacast: true,
    stopLocalTrackOnUnpublish: true,
    disconnectOnPageLeave: true,
    // Remote audio is mixed through the call's own context - the one the join click
    // started - so playback is allowed wherever the click was, and per-user volume is a
    // gain. LiveKit keeps a muted <audio> element per track underneath, which is what
    // feeds Chrome's echo canceller its reference.
    webAudioMix: { audioContext },
    videoCaptureDefaults: {
      ...(voiceSettings.cameraDeviceId ? { deviceId: { ideal: voiceSettings.cameraDeviceId } } : {}),
      resolution: VideoPresets.h720.resolution,
    },
    publishDefaults: {
      dtx: false,
      red: true,
      simulcast: true,
      audioPreset: { maxBitrate: res.bitrate },
      videoCodec: 'vp8',
    },
  });
  live.room = room;
  wireRoom(room, gen);
  try {
    await room.connect(res.url, res.token, { autoSubscribe: true });
  } catch (err) {
    if (gen === live.gen) {
      teardownLocal();
      void leaveVoice().catch(() => undefined);
    }
    throw err;
  }
  if (gen !== live.gen) return;

  // Turn on frame encryption and install our own key *before* anything is published,
  // so no frame can ever leave this device unencrypted. If either step fails we hang up
  // rather than continue in the clear.
  try {
    await room.setE2EEEnabled(true);
    await keyProvider.setParticipantKey(live.mediaKey, live.identity, live.mediaKeyIndex);
  } catch (err) {
    if (gen === live.gen) {
      teardownLocal();
      void leaveVoice().catch(() => undefined);
    }
    throw err;
  }
  if (gen !== live.gen) return;
  batch(() => {
    setVoice('session', 'encrypted', true);
    setVoice('session', 'keyed', [live.identity!]);
  });
  flushPendingKeys();

  setVoice('session', 'status', 'connected');
  if (voiceSettings.outputDeviceId) {
    void room.switchActiveDevice('audiooutput', voiceSettings.outputDeviceId).catch(() => undefined);
  }
  applyAllVolumes();
  // Everyone already here needs our key before they can make sense of a single frame
  // from us, so it goes out before the microphone is published - not after.
  await distributeMediaKey();
  if (gen !== live.gen) return;
  // Through the same queue as every later rebuild, so a settings change made while this
  // is in flight waits its turn instead of publishing a second microphone.
  await queueMicWork(() => publishMicrophone(room, gen));
  if (gen !== live.gen) return;
  // Anyone who arrived while we were connecting is covered by a rotation.
  syncCallKeys();
  if (opts.video) await setCameraEnabled(true);
}

/** Leave whatever voice room we are in. */
export async function leaveVoiceRoom(): Promise<void> {
  live.movingTo = null;
  teardownLocal();
  // Unconditional, not guarded on the session's room: if the client desynced (a
  // Disconnected handler or a stale-state sweep reset the session while the server
  // still holds our state), guarding on session.roomId would skip the one call that
  // tells the server to drop us, and the state would linger until the reconciler.
  // The server returns 204 when there is nothing to leave, so this is always safe.
  try {
    await leaveVoice();
  } catch {
    /* the webhook / reconciler clean up regardless */
  }
}

// ---- self controls ---------------------------------------------------------------------

async function syncMicMute() {
  const s = voice.session;
  const muted = s.selfMute || s.selfDeaf || s.serverMute;
  // Every microphone publication, not only the one we are holding: muting has to be true
  // of the connection, so anything stray must be silenced too rather than keep
  // transmitting behind a UI that says muted.
  const room = live.room;
  const pubs = room ? micPublications(room) : live.micPub ? [live.micPub] : [];
  for (const pub of pubs) {
    if (muted && !pub.isMuted) await pub.mute().catch(() => undefined);
    else if (!muted && pub.isMuted) await pub.unmute().catch(() => undefined);
  }
  refreshGate();
}

export async function setMuted(muted: boolean): Promise<void> {
  setVoice('session', 'selfMute', muted);
  await syncMicMute();
  if (voice.session.roomId) void patchVoiceState({ self_mute: muted }).catch(() => undefined);
}

export function toggleMute(): void {
  // Undeafening by unmuting is Discord's behaviour: you can't hear-but-not-speak by
  // toggling mute while deafened, the deafen comes off too.
  if (voice.session.selfDeaf) {
    void setDeafened(false);
    return;
  }
  void setMuted(!voice.session.selfMute);
}

export async function setDeafened(deaf: boolean): Promise<void> {
  batch(() => {
    setVoice('session', 'selfDeaf', deaf);
    // Deafen implies mute; undeafen restores the mic (Discord semantics).
    if (deaf) setVoice('session', 'selfMute', true);
    else setVoice('session', 'selfMute', false);
  });
  applyAllVolumes();
  await syncMicMute();
  if (voice.session.roomId) {
    void patchVoiceState({ self_deaf: deaf, self_mute: voice.session.selfMute }).catch(() => undefined);
  }
}

export function toggleDeafen(): void {
  void setDeafened(!voice.session.selfDeaf);
}

export async function setCameraEnabled(on: boolean): Promise<void> {
  const room = live.room;
  if (!room) return;
  try {
    setVoice('session', 'error', null);
    await room.localParticipant.setCameraEnabled(
      on,
      on
        ? {
            ...(voiceSettings.cameraDeviceId ? { deviceId: { ideal: voiceSettings.cameraDeviceId } } : {}),
            resolution: VideoPresets.h720.resolution,
          }
        : undefined
    );
    setVoice('session', 'camera', on);
    void patchVoiceState({ self_video: on }).catch(() => undefined);
  } catch (err) {
    console.warn('[voice] camera', err);
    setVoice('session', 'error', err instanceof Error && err.name === 'NotAllowedError' ? 'voice.errors.cameraDenied' : 'voice.errors.cameraFailed');
  }
}

export function toggleCamera(): void {
  void setCameraEnabled(!voice.session.camera);
}

/**
 * Start or stop sharing the screen. `quality` overrides the remembered default for this
 * share only (the picker passes what the user chose); both halves matter - the capture
 * constraints decide what the browser grabs, the encoding what LiveKit may spend sending
 * it, and a high frame rate with a low ceiling just looks smeared.
 */
export async function setScreenShareEnabled(
  on: boolean,
  quality?: { resolution: ScreenShareResolution; fps: ScreenShareFps }
): Promise<void> {
  const room = live.room;
  if (!room) return;
  const resolution = quality?.resolution ?? voiceSettings.screenShareResolution;
  const fps = quality?.fps ?? voiceSettings.screenShareFps;
  try {
    setVoice('session', 'error', null);
    await room.localParticipant.setScreenShareEnabled(
      on,
      on ? screenShareCaptureOptions(resolution, fps) : undefined,
      on ? { simulcast: false, screenShareEncoding: screenShareEncoding(resolution, fps) } : undefined
    );
    // The user may have cancelled the picker: only report what is really published.
    const published = room.localParticipant.isScreenShareEnabled;
    setVoice('session', 'screen', published);
    void patchVoiceState({ self_stream: published }).catch(() => undefined);
  } catch (err) {
    console.warn('[voice] screen share', err);
    // Cancelling the picker is not an error worth a banner.
    if (!(err instanceof Error && (err.name === 'NotAllowedError' || err.name === 'AbortError'))) {
      setVoice('session', 'error', 'voice.errors.screenFailed');
    }
  }
}

export function toggleScreenShare(): void {
  void setScreenShareEnabled(!voice.session.screen);
}

/** Whether the microphone is being de-noised right now. */
export function noiseSuppressionEnabled(): boolean {
  return voiceSettings.noiseSuppression !== 'off';
}

/**
 * The in-call noise-suppression switch. Turning it back on restores whichever suppressor
 * was last chosen in settings rather than always jumping to RNNoise, and a live call
 * rebuilds its microphone pipeline at once - suppression is applied at capture, so it
 * cannot be changed on a track that is already running.
 */
export async function setNoiseSuppressionEnabled(on: boolean): Promise<void> {
  const next = on ? voiceSettings.noiseSuppressionPreferred : 'off';
  if (voiceSettings.noiseSuppression === next) return;
  setVoiceSettings({ noiseSuppression: next });
  if (voice.session.status !== 'idle') await applyVoiceSettingsToSession({ input: true });
}

export function toggleNoiseSuppression(): void {
  void setNoiseSuppressionEnabled(!noiseSuppressionEnabled());
}

/**
 * The last resort for a browser that still refused playback (an autoplay setting that
 * blocks even after a click, iOS Low Power Mode for video): call from the banner's click.
 */
export async function enableAudioPlayback(): Promise<void> {
  const room = live.room;
  if (!room) return;
  // Everything directly in the gesture: each only counts as user-initiated while it lasts.
  void live.audioContext?.resume().catch(() => undefined);
  const [audio, video] = await Promise.allSettled([room.startAudio(), room.startVideo()]);
  batch(() => {
    if (audio.status === 'fulfilled') setVoice('session', 'audioBlocked', false);
    if (video.status === 'fulfilled') setVoice('session', 'videoBlocked', false);
  });
}

/**
 * One reading of the call's transport statistics (loss, jitter, concealment, RTT, how
 * the media travels), for the statistics popover. Rates are over the interval since the
 * previous reading.
 */
export async function readVoiceStats(): Promise<VoiceStatsSnapshot | null> {
  const room = live.room;
  if (!room) return null;
  const { snapshot, sample } = await sampleVoiceStats(room, live.statsSample);
  if (live.room !== room) return null;
  live.statsSample = sample;
  return snapshot;
}

export function setUserVolume(userId: string, percent: number): void {
  const v = Math.min(MAX_USER_VOLUME, Math.max(0, Math.round(percent)));
  setVoice('userVolumes', userId, v);
  saveJSON(VOLUMES_KEY, { ...voice.userVolumes });
  applyAllVolumes();
}

export function setUserLocalMuted(userId: string, muted: boolean): void {
  setVoice(
    produce((s) => {
      if (muted) s.localMuted[userId] = true;
      else delete s.localMuted[userId];
    })
  );
  saveJSON(LOCAL_MUTED_KEY, { ...voice.localMuted });
  applyAllVolumes();
}

export function setVoiceFocus(key: string | null): void {
  setVoice('focus', voice.focus === key ? null : key);
}

export function setVoiceStageVisible(visible: boolean): void {
  setVoice('stageVisible', visible);
}

// ---- calls ---------------------------------------------------------------------------------

export async function acceptIncomingCall(video = false): Promise<void> {
  const inc = voice.incoming;
  if (!inc) return;
  stopRingtone();
  setVoice('incoming', null);
  await joinVoiceRoom(inc.roomId, { video });
}

export async function declineIncomingCall(): Promise<void> {
  const inc = voice.incoming;
  if (!inc) return;
  stopRingtone();
  setVoice('incoming', null);
  try {
    await declineCall(inc.roomId);
  } catch {
    /* already over */
  }
}

/** Ring group members who are not in the call (all of them when userIds is omitted). */
export async function ringMembers(roomId: string, userIds?: string[]): Promise<void> {
  const call = await ringCall(roomId, userIds);
  setVoice('calls', roomId, call);
}

/** Moderator actions; permission-checked by the server. */
export function serverMute(spaceId: string, userId: string, mute: boolean) {
  return moderateVoice(spaceId, userId, { mute });
}
export function serverDeafen(spaceId: string, userId: string, deaf: boolean) {
  return moderateVoice(spaceId, userId, { deaf });
}
export function moveMember(spaceId: string, userId: string, roomId: string) {
  return moderateVoice(spaceId, userId, { room_id: roomId });
}
export function disconnectMember(spaceId: string, userId: string) {
  return disconnectVoiceMember(spaceId, userId);
}

// ---- server state ----------------------------------------------------------------------------

function applyStates(states: VoiceState[]) {
  // A participant from another instance arrives with their federated identity; make
  // sure the registry can map it back to our row for them before any tile asks.
  for (const st of states) registerUserIdentity(st.user);
  setVoice(
    produce((s) => {
      for (const st of states) {
        // One voice room per user: drop them from wherever else we had them.
        for (const [rid, list] of Object.entries(s.byRoom)) {
          if (rid !== st.room_id) {
            const i = list.findIndex((x) => x.user_id === st.user_id);
            if (i >= 0) list.splice(i, 1);
          }
        }
        const list = (s.byRoom[st.room_id] ??= []);
        const i = list.findIndex((x) => x.user_id === st.user_id);
        if (i >= 0) list[i] = st;
        else list.push(st);
      }
    })
  );
}

function removeState(roomId: string, userId: string) {
  setVoice(
    produce((s) => {
      const list = s.byRoom[roomId];
      if (!list) return;
      const i = list.findIndex((x) => x.user_id === userId);
      if (i >= 0) list.splice(i, 1);
      if (list.length === 0) delete s.byRoom[roomId];
    })
  );
}

/** Our own state changed on the server: a moderator acted, or we moved. */
function applyOwnState(st: VoiceState & { left?: boolean; moved_to?: string }) {
  const s = voice.session;
  if (st.left) {
    // Left the room we are connected to - by a moderator's disconnect or move, another
    // of our devices joining elsewhere, or our own leave echoing back. Only react when
    // it is the live room and we did not initiate it. A move names the destination;
    // anything else (another device took over) must not make this one rejoin.
    if (s.roomId === st.room_id && s.status !== 'idle' && live.room && !live.movingTo) {
      teardownLocal();
      if (st.moved_to) {
        void joinVoiceRoom(st.moved_to).catch((err) => console.warn('[voice] rejoin after move failed', err));
      }
    }
    return;
  }
  if (s.status === 'idle') return;
  if (st.room_id !== s.roomId) {
    // Moved by a moderator: rejoin there with a fresh token. LiveKit may already have
    // dropped the old connection (the server removes the old participant), in which
    // case the Disconnected handler's grace timer finds the new room; otherwise leave
    // the old room ourselves first.
    if (!live.room) {
      void joinVoiceRoom(st.room_id).catch((err) => console.warn('[voice] rejoin after move failed', err));
      return;
    }
    const to = st.room_id;
    live.movingTo = to;
    const room = live.room;
    live.room = null;
    void room
      .disconnect(true)
      .catch(() => undefined)
      .then(() => {
        if (live.movingTo === to) {
          live.movingTo = null;
          teardownLocal();
          void joinVoiceRoom(to).catch((err) => console.warn('[voice] rejoin after move failed', err));
        }
      });
    return;
  }
  if (!live.room) return;
  const changed = st.mute !== s.serverMute || st.deaf !== s.serverDeaf || st.suppress !== s.suppress;
  if (!changed) return;
  batch(() => {
    setVoice('session', 'serverMute', st.mute);
    setVoice('session', 'serverDeaf', st.deaf);
    setVoice('session', 'suppress', st.suppress);
  });
  applyAllVolumes();
  void syncMicMute();
}

function readCall(d: Record<string, unknown>): VoiceCall | null {
  const roomId = d.room_id != null ? String(d.room_id) : null;
  if (!roomId) return null;
  return {
    room_id: roomId,
    started_by: d.started_by != null ? String(d.started_by) : '',
    started_at: typeof d.started_at === 'string' ? d.started_at : new Date().toISOString(),
    ringing: Array.isArray(d.ringing) ? (d.ringing as unknown[]).map(String) : [],
  };
}

function maybeRing(call: VoiceCall, rerung: boolean) {
  const me = auth.user?.id;
  if (!me) return;
  const ringingMe = call.ringing.includes(me) && call.started_by !== me;
  const alreadyIn = voice.session.roomId === call.room_id && voice.session.status !== 'idle';
  const onAnotherDevice = voice.byRoom[call.room_id]?.some((s) => s.user_id === me) ?? false;
  if (ringingMe && !alreadyIn && !onAnotherDevice) {
    const current = voice.incoming;
    if (!current || current.roomId !== call.room_id || rerung) {
      setVoice('incoming', { roomId: call.room_id, startedBy: call.started_by, since: Date.now() });
      playRingtone();
      window.setTimeout(() => {
        const inc = voice.incoming;
        if (inc && inc.roomId === call.room_id && Date.now() - inc.since >= RING_TIMEOUT_MS - 50) {
          setVoice('incoming', null);
          stopRingtone();
        }
      }, RING_TIMEOUT_MS);
    }
  } else if (voice.incoming?.roomId === call.room_id) {
    setVoice('incoming', null);
    stopRingtone();
  }
}

/** READY: replace what we know. */
export function hydrateVoiceFromReady(states: unknown, calls: unknown): void {
  const list = Array.isArray(states) ? (states as VoiceState[]) : [];
  const byRoom: Record<string, VoiceState[]> = {};
  for (const st of list) {
    if (!st || typeof st !== 'object' || !st.room_id || !st.user_id) continue;
    registerUserIdentity(st.user);
    (byRoom[st.room_id] ??= []).push(st);
  }
  const callMap: Record<string, VoiceCall> = {};
  for (const c of Array.isArray(calls) ? (calls as Record<string, unknown>[]) : []) {
    const call = readCall(c);
    if (call) callMap[call.room_id] = call;
  }
  batch(() => {
    setVoice('byRoom', reconcile(byRoom));
    setVoice('calls', reconcile(callMap));
  });
  // A reconnect while we are in a room: the server may have swept our state (the
  // gateway was down long enough for the reconciler to act); rejoin if so.
  const me = auth.user?.id;
  const rid = voice.session.roomId;
  if (me && rid && voice.session.status !== 'idle' && !byRoom[rid]?.some((s) => s.user_id === me)) {
    void joinVoiceRoom(rid).catch(() => undefined);
  }
}

/** Register the gateway handlers. Call once on app init. */
export function initVoiceHandlers(): () => void {
  // Media keys arrive Olm-decrypted from the to-device channel, not over the gateway.
  const stopKeys = onIncomingMediaKey(applyIncomingKey);
  const stopEvents = onStargateEvent((event) => {
    const payload = ((event.d as { d?: unknown })?.d ?? event.d) as Record<string, unknown> | undefined;
    if (!payload || typeof payload !== 'object') return;
    switch (event.t) {
      case 'VOICE_STATE_UPDATE': {
        const st = payload as unknown as VoiceState & { left?: boolean; moved_to?: string };
        if (!st.room_id || !st.user_id) return;
        if (st.left) removeState(st.room_id, st.user_id);
        else applyStates([st]);
        if (st.user_id === auth.user?.id) applyOwnState(st);
        // Someone answering ends the ring for them; someone leaving may end the call.
        const call = voice.calls[st.room_id];
        if (call && !st.left && call.ringing.includes(st.user_id)) {
          setVoice('calls', st.room_id, 'ringing', (r) => r.filter((x) => x !== st.user_id));
        }
        if (live.room && voice.session.roomId === st.room_id) applyAllVolumes();
        if (voice.session.roomId === st.room_id) {
          if (st.left) {
            setVoice('session', 'keyed', (list) => list.filter((id) => userIdOfIdentity(id) !== st.user_id));
          }
          // Membership changed: roll our key so a leaver loses access and a joiner
          // gains none to what came before.
          syncCallKeys();
        }
        return;
      }
      case 'CALL_CREATE':
      case 'CALL_UPDATE': {
        const call = readCall(payload);
        if (!call) return;
        setVoice('calls', call.room_id, call);
        maybeRing(call, event.t === 'CALL_CREATE' || payload.rerung === true);
        return;
      }
      case 'CALL_DELETE': {
        const roomId = payload.room_id != null ? String(payload.room_id) : null;
        if (!roomId) return;
        setVoice(
          produce((s) => {
            delete s.calls[roomId];
          })
        );
        if (voice.incoming?.roomId === roomId) {
          setVoice('incoming', null);
          stopRingtone();
        }
        return;
      }
      case 'SPACE_ROOM_DELETE': {
        const roomId = payload.room_id != null ? String(payload.room_id) : null;
        if (roomId && voice.session.roomId === roomId) void leaveVoiceRoom();
        return;
      }
      default:
        return;
    }
  });
  return () => {
    stopKeys();
    stopEvents();
  };
}

/** Sign-out / account switch: drop the connection and everything we knew. */
export function clearVoice(): void {
  live.movingTo = null;
  teardownLocal();
  stopRingtone();
  void live.audioContext?.close().catch(() => undefined);
  live.audioContext = null;
  setVoice(
    produce((s) => {
      s.byRoom = {};
      s.calls = {};
      s.incoming = null;
    })
  );
}

// ---- push to talk + settings reactions ----------------------------------------------------

function pttMainKey(combo: string): string {
  const parts = combo.split('+');
  return parts[parts.length - 1] ?? '';
}

function keyMatchesPtt(e: KeyboardEvent): boolean {
  const combo = voiceSettings.pttKey;
  if (!combo) return false;
  return comboFromEvent(e) === combo;
}

/** Global push-to-talk listeners. Returns a disposer. */
export function initPushToTalk(): () => void {
  const onDown = (e: KeyboardEvent) => {
    if (voiceSettings.inputMode !== 'ptt' || !live.room) return;
    if (!keyMatchesPtt(e)) return;
    e.preventDefault();
    window.clearTimeout(live.pttReleaseTimer);
    if (!live.pttHeld) {
      live.pttHeld = true;
      refreshGate();
    }
  };
  const release = () => {
    window.clearTimeout(live.pttReleaseTimer);
    live.pttReleaseTimer = window.setTimeout(() => {
      live.pttHeld = false;
      refreshGate();
    }, voiceSettings.pttReleaseMs);
  };
  const onUp = (e: KeyboardEvent) => {
    if (!live.pttHeld) return;
    let key = e.key;
    if (key === ' ') key = 'Space';
    else if (key.length === 1) key = key.toUpperCase();
    if (key === pttMainKey(voiceSettings.pttKey) || ['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) release();
  };
  const onBlur = () => {
    if (live.pttHeld) release();
  };
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  window.addEventListener('blur', onBlur);
  return () => {
    window.removeEventListener('keydown', onDown);
    window.removeEventListener('keyup', onUp);
    window.removeEventListener('blur', onBlur);
  };
}

/** Re-apply device / processing / level settings to a live session. */
export async function applyVoiceSettingsToSession(changed: {
  input?: boolean;
  output?: boolean;
  camera?: boolean;
}): Promise<void> {
  const room = live.room;
  if (!room) return;
  if (changed.output && voiceSettings.outputDeviceId !== undefined) {
    await room.switchActiveDevice('audiooutput', voiceSettings.outputDeviceId || 'default').catch(() => undefined);
  }
  if (changed.input) {
    // Skipped while still connecting: joinVoiceRoom is about to publish with these very
    // settings, and a rebuild racing it is the same overlap queueMicRebuild exists to stop.
    if (voice.session.status !== 'connecting') await queueMicRebuild(room);
  }
  if (changed.camera && voice.session.camera) {
    await room.switchActiveDevice('videoinput', voiceSettings.cameraDeviceId || 'default').catch(() => undefined);
  }
  live.mic?.setInputGain(voiceSettings.inputVolume / 100);
  applyAllVolumes();
  refreshGate();
}

/** Input mode changed: PTT starts closed, voice activity opens on speech. */
export function onInputModeChanged(): void {
  live.pttHeld = false;
  live.vad.reset();
  refreshGate();
}

export { setVoiceSettings };
