import type { Component } from 'solid-js';
import { For, Show, createSignal } from 'solid-js';
import type { SpaceRoom } from '../../api/spaces';
import { listArchivedThreads } from '../../api/threads';
import { spaceRoomFromPayload } from '../../stores/spaces';
import { formatMessageTimestamp } from '../../lib/utils/datetime';
import { appFloatPanel, appSectionLabel } from '../../theme/appChrome';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { t } from '../../i18n';

export interface RoomThreadsPanelProps {
  spaceId: string;
  /** The channel whose threads these are. */
  roomId: string;
  /** Active threads of the channel the viewer can see (from the store). */
  threads: SpaceRoom[];
  canCreate: boolean;
  canCreatePrivate: boolean;
  onOpenThread: (threadId: string) => void;
  onCreate: (privateThread: boolean) => void;
}

/**
 * Discord's thread browser for one channel: the active threads (joined ones first), and on
 * request the archived ones, which are read from the server since they are not kept in the
 * live room list.
 */
export const RoomThreadsPanel: Component<RoomThreadsPanelProps> = (props) => {
  const [showArchived, setShowArchived] = createSignal(false);
  const [archived, setArchived] = createSignal<SpaceRoom[] | null>(null);
  const [loadingArchived, setLoadingArchived] = createSignal(false);

  const active = () =>
    [...props.threads].sort((a, b) => {
      const ja = a.thread?.joined ? 1 : 0;
      const jb = b.thread?.joined ? 1 : 0;
      if (ja !== jb) return jb - ja;
      return (b.thread?.last_active_at ?? b.created_at).localeCompare(a.thread?.last_active_at ?? a.created_at);
    });

  async function toggleArchived() {
    const next = !showArchived();
    setShowArchived(next);
    if (!next || archived() !== null || loadingArchived()) return;
    setLoadingArchived(true);
    try {
      const res = await listArchivedThreads(props.roomId, { limit: 25 });
      setArchived(res.threads.map((raw) => spaceRoomFromPayload(raw)).filter((r): r is SpaceRoom => !!r));
    } catch (err) {
      console.error('Loading archived threads failed:', err);
      setArchived([]);
    } finally {
      setLoadingArchived(false);
    }
  }

  const row = (thread: SpaceRoom) => (
    <button
      type="button"
      class="flex w-full items-start gap-2.5 rounded-xl border border-border/80 bg-card/50 px-3 py-2.5 text-start transition-colors hover:bg-card"
      onClick={() => props.onOpenThread(thread.id)}
    >
      <span class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
        <i class={`fa-solid ${thread.thread?.private ? 'fa-lock' : 'fa-comments'} text-[11px]`} aria-hidden="true" />
      </span>
      <span class="min-w-0 flex-1">
        <span class="flex items-center gap-1.5">
          <span class="truncate text-[13px] font-semibold text-foreground">{thread.name}</span>
          <Show when={thread.thread?.locked}>
            <i class="fa-solid fa-lock shrink-0 text-[9px] text-muted-foreground" aria-hidden="true" />
          </Show>
          <Show when={thread.thread?.joined}>
            <span class="shrink-0 rounded-full bg-primary/15 px-1.5 py-px text-[10px] font-medium text-primary">{t('threads.joined')}</span>
          </Show>
        </span>
        <span class="mt-0.5 block truncate text-[11px] text-muted-foreground">
          {t('threads.messageCount', { count: thread.thread?.message_count ?? 0 })}
          {' · '}
          {t('threads.memberCount', { count: thread.thread?.member_count ?? 0 })}
          <Show when={thread.thread?.archived_at && thread.thread?.archived}>
            {' · '}
            {t('threads.archivedAt', { time: formatMessageTimestamp(new Date(thread.thread!.archived_at!)) })}
          </Show>
          <Show when={!thread.thread?.archived && thread.thread?.last_active_at}>
            {' · '}
            {formatMessageTimestamp(new Date(thread.thread!.last_active_at!))}
          </Show>
        </span>
      </span>
    </button>
  );

  return (
    <aside class={`flex max-h-[min(70vh,32rem)] w-80 flex-col overflow-hidden md:w-96 ${appFloatPanel}`} aria-label={t('threads.title')}>
      <div class="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-4 pb-3 pt-4">
        <h2 class={`${appSectionLabel} flex items-center gap-1.5`}>
          <i class="fa-solid fa-comments text-[11px]" aria-hidden="true" />
          {t('threads.title')}
        </h2>
        <Show when={props.canCreate || props.canCreatePrivate}>
          <div class="flex items-center gap-1">
            <Show when={props.canCreatePrivate}>
              <Button type="button" size="sm" variant="ghost" onClick={() => props.onCreate(true)} title={t('threads.newPrivate')}>
                <i class="fa-solid fa-lock me-1.5 text-[10px]" aria-hidden="true" />
                {t('threads.private')}
              </Button>
            </Show>
            <Show when={props.canCreate}>
              <Button type="button" size="sm" onClick={() => props.onCreate(false)}>
                <i class="fa-solid fa-plus me-1.5 text-[10px]" aria-hidden="true" />
                {t('threads.new')}
              </Button>
            </Show>
          </div>
        </Show>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <Show when={active().length > 0} fallback={<EmptyState icon="fa-solid fa-comments" body={t('threads.empty')} />}>
          <div class="space-y-2">
            <For each={active()}>{row}</For>
          </div>
        </Show>
        <button
          type="button"
          class="mt-3 flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/30 hover:text-foreground"
          onClick={() => void toggleArchived()}
          aria-expanded={showArchived()}
        >
          <span>{t('threads.archived')}</span>
          <i class={`fa-solid ${showArchived() ? 'fa-chevron-up' : 'fa-chevron-down'} text-[10px]`} aria-hidden="true" />
        </button>
        <Show when={showArchived()}>
          <Show when={!loadingArchived()} fallback={<p class="px-2 py-2 text-xs text-muted-foreground">{t('common.loading')}</p>}>
            <Show when={(archived() ?? []).length > 0} fallback={<p class="px-2 py-2 text-xs text-muted-foreground">{t('threads.archivedEmpty')}</p>}>
              <div class="mt-1 space-y-2">
                <For each={archived() ?? []}>{row}</For>
              </div>
            </Show>
          </Show>
        </Show>
      </div>
    </aside>
  );
};
