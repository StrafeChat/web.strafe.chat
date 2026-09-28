import type { Component } from 'solid-js';
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import type { VoiceState } from '../../api/voice';
import type { RoomParticipant } from '../../api/rooms';
import { auth } from '../../stores/auth';
import {
  CallEncryptionUnsupportedError,
  enableAudioPlayback,
  isConnectedTo,
  joinVoiceRoom,
  leaveVoiceRoom,
  noiseSuppressionEnabled,
  ringMembers,
  setScreenShareEnabled,
  setVoice,
  setVoiceFocus,
  setVoiceStageVisible,
  toggleCamera,
  toggleDeafen,
  toggleMute,
  toggleNoiseSuppression,
  voice,
  voiceStatesForRoom,
} from '../../stores/voice';
import { spaceMembers } from '../../stores/spaceMembers';
import { voicePermsFor, voiceParticipantName } from '../../lib/voice/perms';
import { VoiceTile } from './VoiceTile';
import { openVoiceUserMenu } from './VoiceUserMenu';
import { toggleVoiceStats } from './VoiceStatsPopover';
import { openScreenShareDialog } from './ScreenShareDialog';
import { Button } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';
import { ApiError } from '../../api/ApiError';
import { t } from '../../i18n';

export interface VoiceStageProps {
  roomId: string;
  /** Present for space voice rooms; PMs and group PMs have none. */
  spaceId?: string;
  /** For a PM call, the room's participants (names / avatars). */
  participants?: RoomParticipant[];
  /** Name shown in the empty state ("Start a call with …" / room name). */
  roomName: string;
  kind: 'space' | 'call';
  /** Fill the page (space voice room) or sit above the messages (PM call). */
  layout?: 'page' | 'panel';
}

interface Tile {
  key: string;
  state: VoiceState;
  kind: 'user' | 'screen';
}

const controlBase =
  'flex size-11 items-center justify-center rounded-full text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40';
const controlIdle = 'bg-card/80 text-foreground hover:bg-accent';
const controlOff = 'bg-destructive/90 text-white hover:bg-destructive';
const controlOn = 'bg-primary text-primary-foreground hover:bg-primary-hover';

/** Space between tiles, px (matches `gap-2`). */
const TILE_GAP = 8;
/** Height of the strip of tiles under a spotlight, px (VoiceTile's `h-24`) plus its gap. */
const STRIP_HEIGHT = 96 + TILE_GAP;
const ASPECT = 16 / 9;

/**
 * The largest 16:9 tile size at which `count` tiles fit in a `width` x `height` box, and
 * the column count that gets there. Measured rather than left to CSS on purpose: a tile
 * whose height came from `aspect-video` on a full-width box ignored the box's height, so
 * on a short stage (a call above a PM, a small window) the tiles ran over the controls.
 */
export function fitTiles(width: number, height: number, count: number, gap = TILE_GAP): { cols: number; w: number; h: number } {
  if (count <= 0 || width <= 0 || height <= 0) return { cols: 1, w: 0, h: 0 };
  let best = { cols: 1, w: 0, h: 0 };
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const cellW = (width - gap * (cols - 1)) / cols;
    const cellH = (height - gap * (rows - 1)) / rows;
    const w = Math.floor(Math.min(cellW, cellH * ASPECT));
    if (w > best.w) best = { cols, w, h: Math.floor(w / ASPECT) };
  }
  return best;
}

/**
 * The voice view: tiles for everyone in the room (camera or avatar, plus one per
 * shared screen), a spotlight when a tile is clicked, and the call controls. Used by
 * the space voice room page and the call panel above a PM.
 */
export const VoiceStage: Component<VoiceStageProps> = (props) => {
  const me = () => auth.user?.id;
  const connected = () => isConnectedTo(props.roomId);
  const states = createMemo(() =>
    [...voiceStatesForRoom(props.roomId)].sort((a, b) => a.joined_at.localeCompare(b.joined_at))
  );
  const perms = createMemo(() => voicePermsFor(me(), props.spaceId, props.roomId));
  const [joinError, setJoinError] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal(false);

  createEffect(() => {
    setVoiceStageVisible(connected());
  });
  onCleanup(() => setVoiceStageVisible(false));

  function nameOf(st: VoiceState): string {
    if (props.participants) {
      const p = props.participants.find((x) => x.id === st.user_id);
      if (p) return p.display_name || p.username;
    }
    return voiceParticipantName(st.user_id, st, props.spaceId);
  }
  function avatarOf(st: VoiceState): string | undefined {
    if (props.participants) {
      const p = props.participants.find((x) => x.id === st.user_id);
      if (p?.avatar) return p.avatar;
    }
    if (props.spaceId) {
      const m = spaceMembers.bySpaceId[props.spaceId]?.find((x) => x.id === st.user_id);
      if (m?.avatar) return m.avatar;
    }
    return st.user?.avatar;
  }

  const tiles = createMemo((): Tile[] => {
    const out: Tile[] = [];
    for (const st of states()) {
      out.push({ key: st.user_id, state: st, kind: 'user' });
      if (st.self_stream || voice.media[st.user_id]?.screen) out.push({ key: `${st.user_id}:screen`, state: st, kind: 'screen' });
    }
    return out;
  });
  const focusedTile = createMemo(() => (voice.focus ? tiles().find((x) => x.key === voice.focus) : undefined));
  const stripTiles = createMemo(() => (focusedTile() ? tiles().filter((x) => x.key !== voice.focus) : []));

  // The tile area is measured and tiles get exact pixel sizes (see fitTiles).
  let areaEl: HTMLDivElement | undefined;
  const [area, setArea] = createSignal({ w: 0, h: 0 });
  onMount(() => {
    const el = areaEl;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setArea({ w: r.width, h: r.height });
    });
    ro.observe(el);
    onCleanup(() => ro.disconnect());
  });
  const gridSize = createMemo(() => fitTiles(area().w, area().h, tiles().length));
  const focusSize = createMemo(() => {
    const { w, h } = area();
    return fitTiles(w, stripTiles().length > 0 ? h - STRIP_HEIGHT : h, 1);
  });
  const call = () => voice.calls[props.roomId];
  const ringingNames = createMemo(() => {
    const c = call();
    if (!c || c.ringing.length === 0) return '';
    return c.ringing
      .map((uid) => {
        const p = props.participants?.find((x) => x.id === uid);
        return p ? p.display_name || p.username : '…';
      })
      .join(', ');
  });
  const notInCall = createMemo(() => {
    if (props.kind !== 'call' || !props.participants) return [] as string[];
    const inRoom = new Set(states().map((s) => s.user_id));
    return props.participants.filter((p) => !inRoom.has(p.id) && p.id !== me()).map((p) => p.id);
  });

  async function join(video: boolean) {
    setJoinError(null);
    setBusy(true);
    try {
      await joinVoiceRoom(props.roomId, { video });
    } catch (err) {
      if (err instanceof CallEncryptionUnsupportedError) {
        setJoinError(t('voice.errors.e2eeUnsupported'));
      } else if (err instanceof ApiError) {
        if (err.status === 403) setJoinError(t('voice.noConnect'));
        else if (err.status === 409) setJoinError(t('voice.full'));
        else setJoinError(err.message);
      } else {
        setJoinError(t('voice.errors.joinFailed'));
      }
    } finally {
      setBusy(false);
    }
  }

  const s = () => voice.session;
  const micOff = () => s().selfMute || s().selfDeaf || s().serverMute || s().suppress;
  /** Connected participants we don't hold a media key for yet - their audio and video
   * can't be decrypted until their key arrives, which is normally a moment. */
  const unkeyed = createMemo(() => {
    if (!connected() || !s().encrypted) return [] as string[];
    const keyed = new Set(s().keyed);
    return states()
      .filter((st) => st.connected && !keyed.has(`${st.user_id}.${st.session_id}`))
      .map((st) => nameOf(st));
  });
  const emptyText = () =>
    props.kind === 'call' ? t('voice.emptyCall', { name: props.roomName }) : t('voice.empty');

  return (
    <div
      class={`relative flex min-h-0 flex-col ${props.layout === 'panel' ? 'h-full' : 'flex-1'} bg-black/20`}
      data-voice-stage={props.roomId}
    >
      {/* Banners */}
      <Show when={connected() && (s().audioBlocked || s().videoBlocked)}>
        <button
          type="button"
          class="flex items-center justify-center gap-2 bg-amber-500/90 px-3 py-2 text-sm font-medium text-black"
          onClick={() => void enableAudioPlayback()}
        >
          <i class={`fa-solid ${s().videoBlocked ? 'fa-play' : 'fa-volume-high'}`} aria-hidden="true" />
          {s().videoBlocked ? t('voice.enablePlayback') : t('voice.enableAudio')}
        </button>
      </Show>
      <Show when={connected() && s().error}>
        {(key) => (
          <div class="flex items-center justify-between gap-2 bg-destructive/85 px-3 py-2 text-sm text-white">
            <span>{t(key())}</span>
            <button type="button" class="rounded px-2 py-0.5 hover:bg-white/15" onClick={() => setVoice('session', 'error', null)} aria-label={t('common.close')}>
              <i class="fa-solid fa-xmark" aria-hidden="true" />
            </button>
          </div>
        )}
      </Show>
      <Show when={connected() && (s().serverMute || s().serverDeaf || s().suppress)}>
        <div class="bg-muted/60 px-3 py-1.5 text-center text-xs text-muted-foreground">
          {s().serverDeaf ? t('voice.serverDeafened') : s().serverMute ? t('voice.serverMuted') : t('voice.suppressed')}
        </div>
      </Show>
      <Show when={connected() && unkeyed().length > 0}>
        <div class="bg-muted/60 px-3 py-1.5 text-center text-xs text-muted-foreground">
          {t('voice.waitingForKeys', { names: unkeyed().join(', ') })}
        </div>
      </Show>

      {/* Tiles */}
      <div
        ref={(el) => {
          areaEl = el;
        }}
        class="relative min-h-0 flex-1 overflow-hidden p-2"
      >
        <Show
          when={tiles().length > 0}
          fallback={
            <div class="flex h-full flex-col items-center justify-center gap-3 p-3 text-center">
              <div class="flex size-16 items-center justify-center rounded-full bg-muted/40 text-muted-foreground">
                <i class={`fa-solid ${props.kind === 'call' ? 'fa-phone' : 'fa-volume-high'} text-2xl`} aria-hidden="true" />
              </div>
              <p class="max-w-sm text-sm text-muted-foreground">{emptyText()}</p>
            </div>
          }
        >
          <Show
            when={focusedTile()}
            fallback={
              <div class="flex h-full flex-wrap content-center items-center justify-center gap-2">
                <For each={tiles()}>
                  {(tile) => (
                    <VoiceTile
                      state={tile.state}
                      kind={tile.kind}
                      name={nameOf(tile.state)}
                      avatar={avatarOf(tile.state)}
                      isLocal={tile.state.user_id === me()}
                      width={gridSize().w}
                      height={gridSize().h}
                      onClick={() => setVoiceFocus(tile.key)}
                      onContextMenu={(e) => openVoiceUserMenu(e, { userId: tile.state.user_id, roomId: props.roomId, spaceId: props.spaceId })}
                    />
                  )}
                </For>
              </div>
            }
          >
            {(focused) => (
              <div class="flex h-full flex-col items-center justify-center gap-2">
                <VoiceTile
                  state={focused().state}
                  kind={focused().kind}
                  name={nameOf(focused().state)}
                  avatar={avatarOf(focused().state)}
                  isLocal={focused().state.user_id === me()}
                  focused
                  width={focusSize().w}
                  height={focusSize().h}
                  onClick={() => setVoiceFocus(focused().key)}
                  onContextMenu={(e) => openVoiceUserMenu(e, { userId: focused().state.user_id, roomId: props.roomId, spaceId: props.spaceId })}
                />
                <Show when={stripTiles().length > 0}>
                  <div class="flex w-full shrink-0 justify-center gap-2 overflow-x-auto">
                    <For each={stripTiles()}>
                      {(tile) => (
                        <VoiceTile
                          state={tile.state}
                          kind={tile.kind}
                          name={nameOf(tile.state)}
                          avatar={avatarOf(tile.state)}
                          isLocal={tile.state.user_id === me()}
                          compact
                          onClick={() => setVoiceFocus(tile.key)}
                          onContextMenu={(e) => openVoiceUserMenu(e, { userId: tile.state.user_id, roomId: props.roomId, spaceId: props.spaceId })}
                        />
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            )}
          </Show>
        </Show>
      </div>

      {/* Encryption state: media never reaches the server in the clear. */}
      <Show when={connected() && s().encrypted}>
        <div class="flex items-center justify-center gap-1.5 px-3 pb-0.5 text-[11px] text-muted-foreground">
          <i class="fa-solid fa-lock text-[9px] text-primary" aria-hidden="true" />
          <span>{t('voice.e2ee')}</span>
        </div>
      </Show>

      {/* Ringing */}
      <Show when={props.kind === 'call' && connected() && ringingNames()}>
        <div class="flex items-center justify-center gap-2 px-3 pb-1 text-xs text-muted-foreground">
          <span class="size-2 animate-pulse rounded-full bg-primary" />
          {t('voice.ringing', { names: ringingNames() })}
        </div>
      </Show>

      {/* Controls */}
      <div class="flex shrink-0 flex-wrap items-center justify-center gap-2 px-3 pb-3 pt-1">
        <Show
          when={connected()}
          fallback={
            <div class="flex flex-col items-center gap-2">
              <div class="flex flex-wrap items-center justify-center gap-2">
                <Button size="md" loading={busy()} disabled={busy() || !perms().connect} onClick={() => void join(false)}>
                  <i class={`fa-solid ${props.kind === 'call' ? 'fa-phone' : 'fa-volume-high'} text-xs`} aria-hidden="true" />
                  {props.kind === 'call' ? (states().length > 0 ? t('voice.joinCall') : t('voice.startCall')) : t('voice.join')}
                </Button>
                <Show when={perms().video}>
                  <Button size="md" variant="outline" loading={busy()} disabled={busy() || !perms().connect} onClick={() => void join(true)}>
                    <i class="fa-solid fa-video text-xs" aria-hidden="true" />
                    {props.kind === 'call' && states().length === 0 ? t('voice.startVideoCall') : t('voice.joinWithVideo')}
                  </Button>
                </Show>
              </div>
              <Show when={!perms().connect}>
                <p class="text-xs text-muted-foreground">{t('voice.noConnect')}</p>
              </Show>
              <Show when={joinError()}>
                <p class="text-xs text-destructive">{joinError()}</p>
              </Show>
            </div>
          }
        >
          <Tooltip label={micOff() ? t('voice.unmute') : t('voice.mute')} inline side="top">
            <button
              type="button"
              class={`${controlBase} ${micOff() ? controlOff : controlIdle}`}
              aria-pressed={micOff()}
              aria-label={micOff() ? t('voice.unmute') : t('voice.mute')}
              disabled={s().serverMute || s().suppress}
              onClick={toggleMute}
            >
              <i class={`fa-solid ${micOff() ? 'fa-microphone-slash' : 'fa-microphone'}`} aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip label={s().selfDeaf ? t('voice.undeafen') : t('voice.deafen')} inline side="top">
            <button
              type="button"
              class={`${controlBase} ${s().selfDeaf || s().serverDeaf ? controlOff : controlIdle}`}
              aria-pressed={s().selfDeaf}
              aria-label={s().selfDeaf ? t('voice.undeafen') : t('voice.deafen')}
              disabled={s().serverDeaf}
              onClick={toggleDeafen}
            >
              <i class={`fa-solid ${s().selfDeaf || s().serverDeaf ? 'fa-volume-xmark' : 'fa-headphones'}`} aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip label={s().camera ? t('voice.cameraOff') : t('voice.cameraOn')} inline side="top">
            <button
              type="button"
              class={`${controlBase} ${s().camera ? controlOn : controlIdle}`}
              aria-pressed={s().camera}
              aria-label={s().camera ? t('voice.cameraOff') : t('voice.cameraOn')}
              disabled={!perms().video}
              onClick={toggleCamera}
            >
              <i class={`fa-solid ${s().camera ? 'fa-video' : 'fa-video-slash'}`} aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip label={s().screen ? t('voice.stopSharing') : t('voice.shareScreen')} inline side="top">
            <button
              type="button"
              class={`${controlBase} ${s().screen ? controlOn : controlIdle}`}
              aria-pressed={s().screen}
              aria-label={s().screen ? t('voice.stopSharing') : t('voice.shareScreen')}
              disabled={!perms().video || typeof navigator.mediaDevices?.getDisplayMedia !== 'function'}
              onClick={() => (s().screen ? void setScreenShareEnabled(false) : openScreenShareDialog())}
            >
              <i class="fa-solid fa-display" aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip
            label={noiseSuppressionEnabled() ? t('voice.noiseSuppressionOff') : t('voice.noiseSuppressionOn')}
            inline
            side="top"
          >
            <button
              type="button"
              class={`${controlBase} ${noiseSuppressionEnabled() ? controlOn : controlIdle}`}
              aria-pressed={noiseSuppressionEnabled()}
              aria-label={noiseSuppressionEnabled() ? t('voice.noiseSuppressionOff') : t('voice.noiseSuppressionOn')}
              onClick={toggleNoiseSuppression}
            >
              <i class="fa-solid fa-wind" aria-hidden="true" />
            </button>
          </Tooltip>
          <Show when={props.kind === 'call' && notInCall().length > 0}>
            <Tooltip label={t('voice.ringAgain')} inline side="top">
              <button
                type="button"
                class={`${controlBase} ${controlIdle}`}
                aria-label={t('voice.ringAgain')}
                onClick={() => void ringMembers(props.roomId, notInCall()).catch(() => undefined)}
              >
                <i class="fa-solid fa-bell" aria-hidden="true" />
              </button>
            </Tooltip>
          </Show>
          <Tooltip label={t('voice.stats.title')} inline side="top">
            <button
              type="button"
              class={`${controlBase} ${controlIdle}`}
              aria-label={t('voice.stats.title')}
              onClick={(e) => toggleVoiceStats(e.currentTarget)}
            >
              <i class="fa-solid fa-wave-square" aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip label={t('voice.leave')} inline side="top">
            <button
              type="button"
              class={`${controlBase} ${controlOff} ms-2`}
              aria-label={t('voice.leave')}
              onClick={() => void leaveVoiceRoom()}
            >
              <i class="fa-solid fa-phone-slash" aria-hidden="true" />
            </button>
          </Tooltip>
        </Show>
      </div>
    </div>
  );
};
