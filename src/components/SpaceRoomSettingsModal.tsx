import type { Component } from 'solid-js';
import { createEffect, createMemo, createSignal, For, Show } from 'solid-js';
import {
  deleteRoomPermissionOverride,
  deleteRoomUserPermissionOverride,
  patchSpaceRoom,
  putRoomPermissionOverride,
  putRoomUserPermissionOverride,
  type SpaceMember,
  type SpaceRoom,
} from '../api/spaces';
import { hasPerm, PermViewChannel, ROOM_OVERRIDE_PERM_ROWS, VOICE_ROOM_OVERRIDE_PERM_ROWS } from '../lib/spacePermissions';
import {
  applyRoomRoleOverride,
  applyRoomUserOverride,
  ensureSpaceRoles,
  removeRoomRoleOverride,
  removeRoomUserOverride,
  spaceRoles,
  spaces,
} from '../stores/spaces';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { RangeField } from './ui/RangeField';
import { Select } from './ui/Select';
import { Tabs } from './ui/Tabs';
import { Toggle } from './ui/Toggle';
import { TriStateToggle, type TriState } from './ui/TriStateToggle';
import { SettingsNav, SettingsPanel, SettingsShell } from './settings';
import { zLayer } from '../theme/appChrome';
import { t } from '../i18n';

type Page = 'general' | 'encryption' | 'voice' | 'overrides';

const ROOM_TYPE_TEXT = 3;
const ROOM_TYPE_VOICE = 4;
const ROOM_TYPE_SECTION = 5;

/** Bitrate presets in bits per second (Discord's slider spans the same range). */
const BITRATE_OPTIONS = [8_000, 16_000, 32_000, 64_000, 96_000, 128_000, 256_000, 384_000];

interface Props {
  open: boolean;
  onClose: () => void;
  spaceId: string;
  room: SpaceRoom | null;
  members: SpaceMember[];
  canManageRooms: boolean;
  onSaved: () => void;
}

export const SpaceRoomSettingsModal: Component<Props> = (props) => {
  const [page, setPage] = createSignal<Page>('general');
  const [busy, setBusy] = createSignal(false);
  const [err, setErr] = createSignal('');
  const [name, setName] = createSignal('');
  const [topic, setTopic] = createSignal('');
  const [slowmode, setSlowmode] = createSignal('0');
  const [e2ee, setE2ee] = createSignal(false);
  const [userLimit, setUserLimit] = createSignal(0);
  const [bitrate, setBitrate] = createSignal(64_000);
  const [targetType, setTargetType] = createSignal<'role' | 'user'>('role');
  const [selectedRoleId, setSelectedRoleId] = createSignal('');
  const [selectedUserId, setSelectedUserId] = createSignal('');
  const [allowMask, setAllowMask] = createSignal(0);
  const [denyMask, setDenyMask] = createSignal(0);

  // Roles and overrides are read from the spaces store (populated by READY, patched by
  // gateway events). `props.room` is a snapshot from when the modal opened, so overrides
  // are looked up on the live store copy of the same room.
  createEffect(() => {
    if (props.open) void ensureSpaceRoles(props.spaceId);
  });
  const roles = createMemo(() => spaceRoles(props.spaceId));
  const liveRoom = createMemo(() =>
    props.room ? (spaces.spaceRoomsBySpaceId[props.spaceId]?.find((r) => r.id === props.room!.id) ?? props.room) : null
  );
  const roleOverrides = createMemo(() => liveRoom()?.permission_overrides);
  const userOverrides = createMemo(() => liveRoom()?.user_overrides);

  createEffect(() => {
    if (!props.open || !props.room) return;
    setPage('general');
    setErr('');
    setName(props.room.name ?? '');
    setTopic(props.room.topic ?? '');
    setSlowmode(String(props.room.slowmode_seconds ?? 0));
    setE2ee(props.room.e2ee_enabled === true);
    setUserLimit(props.room.user_limit ?? 0);
    setBitrate(props.room.bitrate || 64_000);
  });

  const isTextRoom = () => props.room?.type === ROOM_TYPE_TEXT;
  const isVoiceRoom = () => props.room?.type === ROOM_TYPE_VOICE;
  const overrideRows = () => (isVoiceRoom() ? VOICE_ROOM_OVERRIDE_PERM_ROWS : ROOM_OVERRIDE_PERM_ROWS);
  const voiceDirty = () => (props.room?.user_limit ?? 0) !== userLimit() || (props.room?.bitrate || 64_000) !== bitrate();

  const isSection = () => props.room?.type === ROOM_TYPE_SECTION;
  /** A channel that sits inside a category, so it can sync its permissions to that category. */
  const isChannelInCategory = () => !isSection() && !!liveRoom()?.parent_id;
  const synced = () => liveRoom()?.permissions_synced === true;
  /** While a channel is synced its overrides mirror the category's and are read-only here. */
  const syncLocked = () => isChannelInCategory() && synced();

  const everyoneRoleId = () =>
    spaces.spaces.find((sp) => sp.id === props.spaceId)?.everyone_role_id ??
    (roles() ?? []).find((r) => r.name === '@everyone')?.id ??
    '';

  /** A category is "private" when @everyone is denied View on it. Its synced channels inherit that. */
  const isPrivateCategory = () => {
    const eid = everyoneRoleId();
    const ov = roleOverrides()?.find((o) => o.role_id === eid);
    return !!ov && (ov.deny & PermViewChannel) !== 0;
  };

  async function togglePrivateCategory(next: boolean) {
    const room = props.room;
    const eid = everyoneRoleId();
    if (!room || !props.canManageRooms || !eid) return;
    setBusy(true);
    setErr('');
    try {
      const existing = roleOverrides()?.find((o) => o.role_id === eid);
      const now = new Date().toISOString();
      if (next) {
        const allow = (existing?.allow ?? 0) & ~PermViewChannel;
        const deny = (existing?.deny ?? 0) | PermViewChannel;
        await putRoomPermissionOverride(props.spaceId, room.id, eid, { allow, deny });
        applyRoomRoleOverride(props.spaceId, room.id, { role_id: eid, allow, deny, created_at: now, updated_at: now });
      } else {
        const allow = (existing?.allow ?? 0) & ~PermViewChannel;
        const deny = (existing?.deny ?? 0) & ~PermViewChannel;
        if (allow === 0 && deny === 0) {
          await deleteRoomPermissionOverride(props.spaceId, room.id, eid);
          removeRoomRoleOverride(props.spaceId, room.id, eid);
        } else {
          await putRoomPermissionOverride(props.spaceId, room.id, eid, { allow, deny });
          applyRoomRoleOverride(props.spaceId, room.id, { role_id: eid, allow, deny, created_at: now, updated_at: now });
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('roomSettings.overrideSaveFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function toggleSync(next: boolean) {
    const room = props.room;
    if (!room || !props.canManageRooms) return;
    setBusy(true);
    setErr('');
    try {
      // The server clears or materializes the channel's overrides and emits the events that
      // update the store; the synced flag arrives on the room-update event.
      await patchSpaceRoom(props.spaceId, room.id, { permissions_synced: next });
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('roomSettings.overrideSaveFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function saveVoice() {
    if (!props.room || !props.canManageRooms || !voiceDirty()) return;
    setBusy(true);
    setErr('');
    try {
      await patchSpaceRoom(props.spaceId, props.room.id, { user_limit: userLimit(), bitrate: bitrate() });
      props.onSaved();
      props.onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('roomSettings.saveFailed'));
    } finally {
      setBusy(false);
    }
  }
  const e2eeStored = () => props.room?.e2ee_enabled === true;
  const e2eeDirty = () => e2ee() !== e2eeStored();

  createEffect(() => {
    const list = roles();
    if (!list?.length || selectedRoleId()) return;
    setSelectedRoleId(list[0]!.id);
  });

  createEffect(() => {
    if (selectedUserId() || props.members.length === 0) return;
    setSelectedUserId(props.members[0]!.id);
  });

  createEffect(() => {
    if (!props.room || page() !== 'overrides') return;
    if (targetType() === 'role') {
      const o = roleOverrides()?.find((x) => x.role_id === selectedRoleId());
      setAllowMask(o?.allow ?? 0);
      setDenyMask(o?.deny ?? 0);
      return;
    }
    const o = userOverrides()?.find((x) => x.user_id === selectedUserId());
    setAllowMask(o?.allow ?? 0);
    setDenyMask(o?.deny ?? 0);
  });

  function overrideState(bit: number): TriState {
    if (hasPerm(denyMask(), bit)) return 'deny';
    if (hasPerm(allowMask(), bit)) return 'allow';
    return 'neutral';
  }
  function setOverrideState(bit: number, state: TriState) {
    setAllowMask((prev) => (state === 'allow' ? prev | bit : prev & ~bit));
    setDenyMask((prev) => (state === 'deny' ? prev | bit : prev & ~bit));
  }

  async function saveGeneral() {
    if (!props.room || !props.canManageRooms) return;
    const slow = Number.parseInt(slowmode(), 10);
    if (Number.isNaN(slow) || slow < 0) {
      setErr(t('roomSettings.slowmodeInvalid'));
      return;
    }
    setBusy(true);
    setErr('');
    try {
      await patchSpaceRoom(props.spaceId, props.room.id, {
        name: name().trim() || 'unnamed',
        // Voice rooms have no topic or slowmode; sending them unchanged is harmless
        // but pointless.
        ...(isVoiceRoom() ? {} : { topic: topic().trim(), slowmode_seconds: slow }),
      });
      props.onSaved();
      props.onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('roomSettings.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function saveEncryption() {
    if (!props.room || !props.canManageRooms || !e2eeDirty()) return;
    setBusy(true);
    setErr('');
    try {
      await patchSpaceRoom(props.spaceId, props.room.id, { e2ee_enabled: e2ee() });
      props.onSaved();
      props.onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('roomSettings.encryptionFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function saveOverride() {
    if (!props.room || !props.canManageRooms) return;
    setBusy(true);
    setErr('');
    try {
      const now = new Date().toISOString();
      const allow = allowMask();
      const deny = denyMask();
      if (targetType() === 'role') {
        const roleId = selectedRoleId();
        if (!roleId) return;
        await putRoomPermissionOverride(props.spaceId, props.room.id, roleId, { allow, deny });
        applyRoomRoleOverride(props.spaceId, props.room.id, { role_id: roleId, allow, deny, created_at: now, updated_at: now });
      } else {
        const userId = selectedUserId();
        if (!userId) return;
        await putRoomUserPermissionOverride(props.spaceId, props.room.id, userId, { allow, deny });
        applyRoomUserOverride(props.spaceId, props.room.id, { user_id: userId, allow, deny, created_at: now, updated_at: now });
      }
      props.onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('roomSettings.overrideSaveFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function clearOverride() {
    if (!props.room || !props.canManageRooms) return;
    setBusy(true);
    setErr('');
    try {
      if (targetType() === 'role') {
        const roleId = selectedRoleId();
        if (!roleId) return;
        await deleteRoomPermissionOverride(props.spaceId, props.room.id, roleId);
        removeRoomRoleOverride(props.spaceId, props.room.id, roleId);
      } else {
        const userId = selectedUserId();
        if (!userId) return;
        await deleteRoomUserPermissionOverride(props.spaceId, props.room.id, userId);
        removeRoomUserOverride(props.spaceId, props.room.id, userId);
      }
      setAllowMask(0);
      setDenyMask(0);
      props.onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('roomSettings.overrideClearFailed'));
    } finally {
      setBusy(false);
    }
  }

  const roomLabel = () =>
    isSection()
      ? props.room?.name || t('space.section')
      : `${isVoiceRoom() ? '🔊 ' : '#'}${props.room?.name || t('intro.roomFallback')}`;

  return (
    <SettingsShell open={props.open && !!props.room} onClose={props.onClose} zClass={zLayer.modalStacked} labelledBy="room-settings-title">
      <SettingsNav<Page>
        title={isSection() ? t('space.sectionSettings') : t('space.roomSettings')}
        titleId="room-settings-title"
        groups={[
          {
            label: roomLabel(),
            items: [
              { id: 'general', label: t('roomSettings.general'), icon: 'fa-sliders' },
              ...(isTextRoom() ? [{ id: 'encryption' as const, label: t('roomSettings.encryption'), icon: 'fa-lock' }] : []),
              ...(isVoiceRoom() ? [{ id: 'voice' as const, label: t('roomSettings.voice'), icon: 'fa-volume-high' }] : []),
              { id: 'overrides', label: t('roomSettings.overridesShort'), icon: 'fa-shield-halved' },
            ],
          },
        ]}
        active={page()}
        onSelect={(id) => setPage(id)}
      />
      <SettingsPanel
        title={t(`roomSettings.pages.${page()}.title`)}
        description={t(`roomSettings.pages.${page()}.description`, { room: roomLabel() })}
        onClose={props.onClose}
      >
        <Show when={err()}>
          <p class="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {err()}
          </p>
        </Show>

        <Show when={page() === 'general'}>
          <div class="max-w-xl space-y-4">
            <Input
              label={t('createRoom.name')}
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              disabled={!props.canManageRooms || busy()}
            />
            <Show when={isTextRoom()}>
              <Input
                label={t('roomSettings.topic')}
                value={topic()}
                placeholder={t('roomSettings.topicPlaceholder')}
                onInput={(e) => setTopic(e.currentTarget.value)}
                disabled={!props.canManageRooms || busy()}
              />
              <Input
                label={t('roomSettings.slowmode')}
                type="number"
                min={0}
                value={slowmode()}
                onInput={(e) => setSlowmode(e.currentTarget.value)}
                disabled={!props.canManageRooms || busy()}
              />
            </Show>
            <div class="pt-2">
              <Button type="button" onClick={() => saveGeneral()} disabled={!props.canManageRooms || busy()} loading={busy()}>
                {t('roomSettings.save')}
              </Button>
            </div>
          </div>
        </Show>

        <Show when={page() === 'encryption'}>
          <div class="max-w-xl space-y-4">
            <div class="flex items-center gap-4 rounded-xl border border-border bg-muted/20 px-4 py-3.5">
              <div
                class={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                  e2ee() ? 'bg-primary/15 text-primary' : 'bg-muted/60 text-muted-foreground'
                }`}
              >
                <i class={`fa-solid ${e2ee() ? 'fa-lock' : 'fa-lock-open'} text-sm`} aria-hidden="true" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-[15px] font-semibold text-foreground">{t('room.groupSettings.e2ee')}</p>
                <p class="mt-0.5 text-xs leading-snug text-muted-foreground">
                  {e2ee() ? t('roomSettings.e2eeOnHint') : t('roomSettings.e2eeOffHint')}
                </p>
              </div>
              <Toggle
                checked={e2ee()}
                onChange={setE2ee}
                disabled={!props.canManageRooms || busy()}
                label={t('room.groupSettings.e2ee')}
              />
            </div>

            <div class="space-y-2 rounded-xl border border-border/60 bg-card/10 p-4">
              <p class="text-sm font-medium text-foreground">{t('roomSettings.e2eeWhatChanges')}</p>
              <ul class="list-disc space-y-1.5 ps-5 text-xs leading-snug text-muted-foreground">
                <li>{t('roomSettings.e2eePoint1')}</li>
                <li>{t('roomSettings.e2eePoint2')}</li>
                <li>{t('roomSettings.e2eePoint3')}</li>
                <li>{t('roomSettings.e2eePoint4')}</li>
              </ul>
            </div>

            <div class="flex items-center gap-3 pt-2">
              <Button
                type="button"
                onClick={() => saveEncryption()}
                disabled={!props.canManageRooms || busy() || !e2eeDirty()}
                loading={busy()}
              >
                {e2ee() ? t('roomSettings.turnOnEncryption') : t('roomSettings.turnOffEncryption')}
              </Button>
              <Show when={e2eeDirty()}>
                <Button type="button" variant="outline" onClick={() => setE2ee(e2eeStored())} disabled={busy()}>
                  {t('common.revert')}
                </Button>
              </Show>
            </div>
          </div>
        </Show>

        <Show when={page() === 'voice'}>
          <div class="max-w-xl space-y-5">
            <div class="space-y-1.5">
              <RangeField
                label={t('roomSettings.userLimit')}
                min={0}
                max={99}
                value={userLimit()}
                valueLabel={userLimit() === 0 ? t('roomSettings.unlimited') : t('roomSettings.userLimitValue', { count: userLimit() })}
                disabled={!props.canManageRooms || busy()}
                onChange={(v) => setUserLimit(v)}
              />
              <p class="text-xs text-muted-foreground">{t('roomSettings.userLimitHint')}</p>
            </div>
            <div class="space-y-1.5">
              <Select
                label={t('roomSettings.bitrate')}
                value={String(bitrate())}
                disabled={!props.canManageRooms || busy()}
                onValueChange={(v) => setBitrate(Number(v))}
              >
                <For each={BITRATE_OPTIONS}>{(b) => <option value={String(b)}>{b / 1000} kbps</option>}</For>
              </Select>
              <p class="text-xs text-muted-foreground">{t('roomSettings.bitrateHint')}</p>
            </div>
            <div class="pt-1">
              <Button type="button" onClick={() => saveVoice()} disabled={!props.canManageRooms || busy() || !voiceDirty()} loading={busy()}>
                {t('roomSettings.save')}
              </Button>
            </div>
          </div>
        </Show>

        <Show when={page() === 'overrides'}>
          <div class="max-w-2xl space-y-4">
            <Show when={isSection()}>
              <div class="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-card/10 px-4 py-3">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-foreground">{t('roomSettings.privateSection')}</p>
                  <p class="text-xs text-muted-foreground">{t('roomSettings.privateSectionHelp')}</p>
                </div>
                <Toggle
                  checked={isPrivateCategory()}
                  disabled={!props.canManageRooms || busy()}
                  onChange={(v) => void togglePrivateCategory(v)}
                />
              </div>
            </Show>
            <Show when={isChannelInCategory()}>
              <div class="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-card/10 px-4 py-3">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-foreground">{t('roomSettings.syncSection')}</p>
                  <p class="text-xs text-muted-foreground">{t('roomSettings.syncSectionHelp')}</p>
                </div>
                <Toggle checked={synced()} disabled={!props.canManageRooms || busy()} onChange={(v) => void toggleSync(v)} />
              </div>
              <Show when={syncLocked()}>
                <p class="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-foreground/90">
                  {t('roomSettings.syncedNote')}
                </p>
              </Show>
            </Show>
            <Tabs
              size="sm"
              aria-label={t('roomSettings.overrideTarget')}
              value={targetType()}
              onChange={(v) => setTargetType(v)}
              items={[
                { id: 'role', label: t('roomSettings.roleOverride') },
                { id: 'user', label: t('roomSettings.memberOverride') },
              ]}
            />

            <div class="max-w-md">
              <Show when={targetType() === 'role'}>
                <Select label={t('roomSettings.role')} value={selectedRoleId()} onValueChange={setSelectedRoleId}>
                  <For each={roles() ?? []}>{(r) => <option value={r.id}>{r.name}</option>}</For>
                </Select>
              </Show>
              <Show when={targetType() === 'user'}>
                <Select label={t('roomSettings.member')} value={selectedUserId()} onValueChange={setSelectedUserId}>
                  <For each={props.members}>
                    {(m) => (
                      <option value={m.id}>
                        {m.display_name || m.username}#{m.discriminator}
                      </option>
                    )}
                  </For>
                </Select>
              </Show>
            </div>

            <div class="space-y-1 rounded-xl border border-border/60 bg-card/10 p-2">
              <For each={overrideRows()}>
                {(row) => (
                  <div class="flex items-center justify-between gap-4 rounded-lg px-3 py-3 hover:bg-muted/20">
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-medium text-foreground">{row.label}</p>
                      <p class="text-xs text-muted-foreground">{row.description}</p>
                    </div>
                    <TriStateToggle
                      state={overrideState(row.bit)}
                      disabled={!props.canManageRooms || busy() || syncLocked()}
                      onChange={(next) => setOverrideState(row.bit, next)}
                    />
                  </div>
                )}
              </For>
            </div>
            <div class="flex flex-wrap gap-2">
              <Button type="button" onClick={() => saveOverride()} disabled={!props.canManageRooms || busy() || syncLocked()} loading={busy()}>
                {t('roomSettings.saveOverride')}
              </Button>
              <Button type="button" variant="outline" onClick={() => clearOverride()} disabled={!props.canManageRooms || busy() || syncLocked()}>
                {t('roomSettings.clearOverride')}
              </Button>
            </div>
          </div>
        </Show>
      </SettingsPanel>
    </SettingsShell>
  );
};
