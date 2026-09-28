import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import type { UnreadBannerInfo } from '../../stores/readState';
import { Button } from '../ui/Button';
import { formatDate, t } from '../../i18n';

export interface UnreadBannerProps {
  info: UnreadBannerInfo | null;
  onMarkAsRead: () => void;
}

function formatSince(iso: string): string {
  return t('room.unread.since', {
    time: formatDate(iso, { hour: 'numeric', minute: '2-digit' }),
    date: formatDate(iso, { month: 'long', day: 'numeric', year: 'numeric' }),
  });
}

/**
 * Persistent bar below the room header while there's unread content from before this
 * visit (Discord's pattern) - distinct from the inline NEW divider in the message list
 * itself; this stays visible regardless of scroll position until dismissed via Mark As
 * Read (or the room is left), so it's a reliable "you have unread here" signal even if
 * the divider has scrolled out of view.
 */
export const UnreadBanner: Component<UnreadBannerProps> = (props) => (
  <Show when={props.info}>
    {(info) => (
      <div class="flex shrink-0 items-center justify-between gap-3 border-b border-primary/20 bg-primary/10 px-4 py-1.5 text-sm">
        <span class="min-w-0 truncate text-foreground">
          {t('room.unread.count', {
            // Capped counts read as "50+", and "50+" is never singular.
            count: info().capped ? info().count + 1 : info().count,
            shown: `${info().count}${info().capped ? '+' : ''}`,
            since: formatSince(info().since),
          })}
        </span>
        <Button size="sm" class="h-7 px-3 text-xs" onClick={props.onMarkAsRead}>
          {t('room.unread.markAsRead')}
        </Button>
      </div>
    )}
  </Show>
);
