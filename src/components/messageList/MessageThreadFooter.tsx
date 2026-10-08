import type { Component } from 'solid-js';
import { Show, createMemo, createResource } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import type { SpaceRoom } from '../../api/spaces';
import { getThread } from '../../api/threads';
import { spaceRoomFromPayload, spaces } from '../../stores/spaces';
import { t } from '../../i18n';

/**
 * Discord's "N messages · View thread" strip under a message that started a thread. The
 * thread usually sits in the room store (active threads come with READY); an archived or
 * otherwise unlisted one is fetched once, and one the viewer may not see shows nothing.
 */
export const MessageThreadFooter: Component<{ threadId: string; spaceId?: string }> = (props) => {
  const navigate = useNavigate();
  const stored = createMemo<SpaceRoom | undefined>(() =>
    props.spaceId ? spaces.spaceRoomsBySpaceId[props.spaceId]?.find((r) => r.id === props.threadId) : undefined
  );
  const [fetched] = createResource(
    () => (stored() ? null : props.threadId),
    async (id) => {
      if (!id) return null;
      try {
        return spaceRoomFromPayload(await getThread(id));
      } catch {
        return null;
      }
    }
  );
  const thread = () => stored() ?? fetched() ?? null;
  return (
    <Show when={thread()}>
      {(th) => (
        <button
          type="button"
          class="mt-1.5 flex max-w-md items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-2.5 py-1.5 text-start text-xs transition-colors hover:bg-accent/40"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/spaces/${th().space_id ?? props.spaceId}/rooms/${th().id}`);
          }}
        >
          <i class={`fa-solid ${th().thread?.private ? 'fa-lock' : 'fa-comments'} shrink-0 text-[11px] text-muted-foreground`} aria-hidden="true" />
          <span class="truncate font-medium text-foreground">{th().name}</span>
          <span class="shrink-0 text-muted-foreground">
            · {t('threads.messageCount', { count: th().thread?.message_count ?? 0 })}
          </span>
          <Show when={th().thread?.archived}>
            <span class="shrink-0 text-muted-foreground">· {t('threads.archivedShort')}</span>
          </Show>
          <span class="ms-auto shrink-0 text-primary">{t('threads.view')} ›</span>
        </button>
      )}
    </Show>
  );
};
