import type { Component } from 'solid-js';
import { createMemo, createSignal, For, onMount, Show } from 'solid-js';
import {
  AUDIT_ACTION_TYPES,
  listSpaceAuditLog,
  type AuditLogEntry,
  type SpaceMember,
  type SpaceRole,
  type SpaceRoom,
  type UserSummary,
} from '../../../api/spaces';
import { Button } from '../../ui/Button';
import { Select } from '../../ui/Select';
import { EmptyState } from '../../ui/EmptyState';
import { MessageAvatar } from '../../messageList/MessageAvatar';
import { formatDate, t } from '../../../i18n';

interface Props {
  spaceId: string;
  roles: SpaceRole[];
  rooms: SpaceRoom[];
  members: SpaceMember[];
  onError: (msg: string) => void;
}

const PAGE = 50;

const ACTION_ICON: Record<string, string> = {
  space_update: 'fa-sliders',
  room_create: 'fa-hashtag',
  room_update: 'fa-hashtag',
  room_delete: 'fa-hashtag',
  role_create: 'fa-shield-halved',
  role_update: 'fa-shield-halved',
  role_delete: 'fa-shield-halved',
  member_kick: 'fa-user-minus',
  member_ban_add: 'fa-ban',
  member_ban_remove: 'fa-user-check',
  member_roles_update: 'fa-user-tag',
  invite_create: 'fa-link',
  invite_delete: 'fa-link-slash',
  emoji_create: 'fa-face-smile',
  emoji_update: 'fa-face-smile',
  emoji_delete: 'fa-face-smile',
  override_update: 'fa-lock',
  override_delete: 'fa-lock-open',
  member_voice_mute: 'fa-microphone-slash',
  member_voice_deafen: 'fa-volume-xmark',
  member_voice_move: 'fa-arrow-right-arrow-left',
  member_voice_disconnect: 'fa-phone-slash',
};

const DESTRUCTIVE = new Set(['room_delete', 'role_delete', 'member_kick', 'member_ban_add', 'invite_delete', 'emoji_delete', 'override_delete', 'member_voice_disconnect']);

function fmtValue(v: unknown): string {
  if (v == null || v === '') return '—';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
  if (typeof v === 'boolean') return v ? t('common.enabled') : t('common.disabled');
  return String(v);
}

/** Space settings → Audit log: who changed what, newest first, filterable by action. */
export const SpaceAuditLogPage: Component<Props> = (props) => {
  const [entries, setEntries] = createSignal<AuditLogEntry[]>([]);
  const [users, setUsers] = createSignal<Record<string, UserSummary>>({});
  const [loading, setLoading] = createSignal(true);
  const [more, setMore] = createSignal(false);
  const [action, setAction] = createSignal('');
  const [expanded, setExpanded] = createSignal<Set<string>>(new Set());

  async function load(reset: boolean) {
    setLoading(true);
    props.onError('');
    try {
      const before = reset ? undefined : entries()[entries().length - 1]?.id;
      const page = await listSpaceAuditLog(props.spaceId, { before, limit: PAGE, action: action() || undefined });
      setUsers((prev) => ({ ...prev, ...page.users }));
      setEntries((prev) => (reset ? page.entries : [...prev, ...page.entries]));
      setMore(page.entries.length >= PAGE);
    } catch (e) {
      props.onError(e instanceof Error ? e.message : t('spaceSettings.audit.loadFailed'));
    } finally {
      setLoading(false);
    }
  }
  onMount(() => void load(true));

  const rolesById = createMemo(() => new Map(props.roles.map((r) => [r.id, r])));
  const roomsById = createMemo(() => new Map(props.rooms.map((r) => [r.id, r])));
  const membersById = createMemo(() => new Map(props.members.map((m) => [m.id, m])));

  function userName(id: string): string {
    const u = users()[id];
    if (u) return u.display_name || u.username;
    const m = membersById().get(id);
    if (m) return m.display_name || m.username;
    return t('common.someone');
  }

  /** Human label for the entry's target; falls back to names recorded in the change set. */
  function targetLabel(e: AuditLogEntry): string {
    const nameFromChanges = () => {
      const n = e.changes?.name;
      return (n?.new ?? n?.old) as string | undefined;
    };
    switch (e.action_type) {
      case 'member_kick':
      case 'member_ban_add':
      case 'member_ban_remove':
      case 'member_roles_update':
      case 'member_voice_mute':
      case 'member_voice_deafen':
      case 'member_voice_move':
      case 'member_voice_disconnect':
        return userName(e.target_id);
      case 'role_create':
      case 'role_update':
      case 'role_delete':
        return rolesById().get(e.target_id)?.name ?? nameFromChanges() ?? e.target_id;
      case 'room_create':
      case 'room_update':
      case 'room_delete': {
        const r = roomsById().get(e.target_id);
        const n = r?.name ?? nameFromChanges();
        return n ? (r?.type === 5 ? n : `#${n}`) : e.target_id;
      }
      case 'emoji_create':
      case 'emoji_update':
      case 'emoji_delete':
        return nameFromChanges() ? `:${nameFromChanges()}:` : e.target_id;
      case 'override_update':
      case 'override_delete': {
        const [roomId, kind, subject] = e.target_id.split(':');
        const room = roomsById().get(roomId ?? '');
        const who = kind === 'role' ? rolesById().get(subject ?? '')?.name ?? subject : userName(subject ?? '');
        return `${who} · #${room?.name ?? roomId}`;
      }
      case 'space_update':
        return t('space.thisSpace');
      default:
        return e.target_id;
    }
  }

  function sentence(e: AuditLogEntry): string {
    return t(`spaceSettings.audit.actions.${e.action_type}`, { actor: userName(e.user_id), target: targetLabel(e), defaultValue: e.action_type });
  }

  function changeLabel(key: string): string {
    return t(`spaceSettings.audit.fields.${key}`, { defaultValue: key.replace(/_/g, ' ') });
  }

  function prettyChange(key: string, v: unknown): string {
    if (key === 'roles' && Array.isArray(v)) return v.map((rid) => rolesById().get(String(rid))?.name ?? String(rid)).join(', ') || '—';
    if ((key === 'system_room_id' || key === 'afk_room_id' || key === 'widget_room_id') && typeof v === 'string' && v) {
      return `#${roomsById().get(v)?.name ?? v}`;
    }
    if (key === 'default_message_notifications') return v === 1 ? t('spaceSettings.system.notifMentions') : t('spaceSettings.system.notifAll');
    if (key === 'afk_timeout' && typeof v === 'number') return t('spaceSettings.system.minutes', { count: v / 60 });
    return fmtValue(v);
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div class="space-y-4">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div class="sm:w-72">
          <Select
            label={t('spaceSettings.audit.filter')}
            value={action()}
            onValueChange={(v) => {
              setAction(v);
              void load(true);
            }}
          >
            <option value="">{t('spaceSettings.audit.allActions')}</option>
            <For each={AUDIT_ACTION_TYPES}>{(a) => <option value={a}>{t(`spaceSettings.audit.names.${a}`)}</option>}</For>
          </Select>
        </div>
        <Button size="sm" variant="ghost" class="sm:ms-auto" onClick={() => void load(true)} disabled={loading()}>
          <i class="fa-solid fa-rotate text-xs" aria-hidden="true" />
          {t('common.retry')}
        </Button>
      </div>

      <Show when={entries().length > 0} fallback={loading() ? <p class="text-sm text-muted-foreground">{t('common.loading')}</p> : <EmptyState icon="fa-solid fa-clipboard-list" body={t('spaceSettings.audit.none')} />}>
        <ol class="divide-y divide-border/50 rounded-xl border border-border/70 bg-card/10">
          <For each={entries()}>
            {(e) => {
              const actor = () => users()[e.user_id];
              const hasChanges = () => !!e.changes && Object.keys(e.changes).length > 0;
              const open = () => expanded().has(e.id);
              return (
                <li>
                  <div class="flex items-start gap-3 px-3 py-2.5">
                    <div class="relative shrink-0">
                      <MessageAvatar name={userName(e.user_id)} avatar={actor()?.avatar} class="size-9 text-[13px]" />
                      <span
                        class={`absolute -bottom-1 -end-1 flex size-5 items-center justify-center rounded-full border border-background text-[9px] ${
                          DESTRUCTIVE.has(e.action_type) ? 'bg-destructive text-white' : 'bg-muted text-foreground'
                        }`}
                        aria-hidden="true"
                      >
                        <i class={`fa-solid ${ACTION_ICON[e.action_type] ?? 'fa-pen'}`} />
                      </span>
                    </div>
                    <div class="min-w-0 flex-1">
                      <p class="text-sm text-foreground">{sentence(e)}</p>
                      <p class="mt-0.5 text-xs text-muted-foreground">
                        {formatDate(e.created_at, { dateStyle: 'medium', timeStyle: 'short' })}
                        <Show when={e.reason}>
                          {' '}
                          · {t('spaceSettings.audit.reason')}: <span class="text-foreground/90">{e.reason}</span>
                        </Show>
                      </p>
                      <Show when={open() && hasChanges()}>
                        <dl class="mt-2 space-y-1 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-xs">
                          <For each={Object.entries(e.changes!)}>
                            {([key, c]) => (
                              <div class="flex flex-wrap items-baseline gap-x-2">
                                <dt class="font-medium text-muted-foreground">{changeLabel(key)}</dt>
                                <dd class="text-foreground">
                                  <Show when={c.old !== undefined}>
                                    <span class="line-through opacity-60">{prettyChange(key, c.old)}</span>
                                    <span class="mx-1.5 text-muted-foreground">→</span>
                                  </Show>
                                  {prettyChange(key, c.new)}
                                </dd>
                              </div>
                            )}
                          </For>
                        </dl>
                      </Show>
                    </div>
                    <Show when={hasChanges()}>
                      <button
                        type="button"
                        class="shrink-0 rounded-md p-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-expanded={open()}
                        aria-label={t('spaceSettings.audit.toggleDetails')}
                        onClick={() => toggle(e.id)}
                      >
                        <i class={`fa-solid fa-chevron-${open() ? 'up' : 'down'}`} aria-hidden="true" />
                      </button>
                    </Show>
                  </div>
                </li>
              );
            }}
          </For>
        </ol>
        <Show when={more()}>
          <div class="flex justify-center">
            <Button variant="outline" size="sm" onClick={() => void load(false)} loading={loading()}>
              {t('spaceSettings.audit.loadMore')}
            </Button>
          </div>
        </Show>
      </Show>
    </div>
  );
};
