import { Component, createMemo, Show } from "solid-js";
import { FS_URL } from "../../constants";
import { useCache } from "../../lib/providers/cache/CacheProvider";
import { useTransContext } from "@mbarzda/solid-i18next";

interface MessageProps {
  id: string | undefined;
  content: string;
  author_id: string;
  created_at: string | undefined;
  edited_at?: string | null;
  nonce?: string;
  pending?: boolean;
  error?: string;
  isCompact?: boolean;
}

const Message: Component<MessageProps> = (props) => {
  const cache = useCache();
  const author = createMemo(() => cache.getUser(props.author_id));
  const [t] = useTransContext();

  const formatTimestamp = (timestamp: string | undefined) => {
    if (!timestamp) return "";
    
    const date = new Date(timestamp);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const isToday = date.toDateString() === now.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();
    
    const time = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
    
    if (isToday) {
      return t("time.today", { time: time });
    } else if (isYesterday) {
      return t("time.yesterday", { time: time });
    } else {
      const weekday = date.toLocaleDateString(undefined, { weekday: "long" });
      return t("time.date", { weekday: weekday, time: time });
    }
  };

  return (
    <div class={`group flex gap-4 ${props.isCompact ? 'pt-0.5 pb-0.5' : 'mt-4 mb-0.5 p-1'} px-4 hover:bg-surface hover:bg-opacity-10 transition-colors relative w-full ${props.pending && !props.id ? 'opacity-70' : ''}`}>
      <Show when={!props.isCompact}>
        <div class="flex-shrink-0 mt-1">
          <img
            src={`${FS_URL}/avatars/${props.author_id}/${author()?.avatar || "favicon.ico"}`}
            alt="Avatar"
            class="w-10 h-10 rounded-full"
          />
        </div>
      </Show>
      <div class={`flex-1 min-w-0 flex flex-col justify-center ${props.isCompact ? 'ml-14' : ''}`}>
        <Show when={!props.isCompact}>
          <div class="flex items-center gap-2">
            <div class="flex items-baseline gap-2">
              <span class="font-medium text-text-primary">
                {author()?.display_name || author()?.username || "Unknown User"}
              </span>
              <span class="text-xs text-text-secondary whitespace-nowrap">
                {formatTimestamp(props.created_at)}
              </span>
            </div>
            <Show when={props.edited_at}>
              <span class="text-xs text-text-secondary">(edited)</span>
            </Show>
            <Show when={props.pending && !props.id}>
              <span class="text-xs text-text-secondary italic">(sending...)</span>
            </Show>
            <Show when={props.error}>
              <span class="text-xs text-red-500">{props.error}</span>
            </Show>
          </div>
        </Show>
        <div class="text-text-primary break-words">{props.content}</div>
      </div>
    </div>
  );
};

export default Message;