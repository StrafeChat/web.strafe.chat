import { Component, For, Show, createSignal } from "solid-js";
import { useAuth } from "../../../../lib/providers/auth/AuthProvider";
import { useCache } from "../../../../lib/providers/cache/CacheProvider";
import { apiRequest } from "../../../../lib/api";
import { BASE_URL } from "../../../../constants";
import { Emoji } from "../../../shared/Emoji";

interface ReactionProps {
  emoji: string;
  count: number;
  users: string[];
  messageId: string;
  roomId: string;
  onReactionUpdate?: (emoji: string, count: number, users: string[]) => void;
}

interface ReactionsProps {
  reactions?: Record<
    string,
    {
      count: number;
      users: string[];
    }
  >;
  messageId?: string;
  roomId?: string;
  onReactionUpdate?: (emoji: string, count: number, users: string[]) => void;
}

const Reaction: Component<ReactionProps> = (props) => {
  const { user } = useAuth();
  const { getUser } = useCache();
  const [loading, setLoading] = createSignal(false);

  const currentUser = () => user();
  const hasReacted = () =>
    currentUser() ? props.users.includes(currentUser()!.id) : false;

  const handleReactionClick = async () => {
    if (!currentUser() || !props.messageId || !props.roomId || loading())
      return;

    setLoading(true);
    try {
      if (hasReacted()) {
        // Remove reaction
        const encodedEmoji = encodeURIComponent(props.emoji);
        console.log("[Reaction] Removing reaction:", {
          originalEmoji: props.emoji,
          encoded: encodedEmoji,
          url: `${BASE_URL}/rooms/${props.roomId}/messages/${props.messageId}/reactions/${encodedEmoji}`,
        });

        await apiRequest(
          `${BASE_URL}/rooms/${props.roomId}/messages/${props.messageId}/reactions/${encodedEmoji}`,
          {
            method: "DELETE",
          },
        );
      } else {
        // Add reaction
        await apiRequest(
          `${BASE_URL}/rooms/${props.roomId}/messages/${props.messageId}/reactions`,
          {
            method: "POST",
            body: {
              emoji: props.emoji,
            },
          },
        );
      }
    } catch (error) {
      console.error("Failed to toggle reaction:", error);
    } finally {
      setLoading(false);
    }
  };

  const getReactionTooltip = () => {
    if (props.users.length === 0) return "";

    const userNames = props.users.slice(0, 5).map((userId) => {
      const user = getUser(userId);
      return user?.display_name || user?.username || "Unknown";
    });

    if (props.users.length > 5) {
      userNames.push(`and ${props.users.length - 5} more`);
    }

    return userNames.join(", ");
  };

  return (
    <button
      class={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors duration-150 cursor-pointer ${
        loading() ? "opacity-50 cursor-not-allowed" : ""
      }`}
      style={{
        ...(hasReacted()
          ? {
              "background-color":
                "color-mix(in srgb, var(--primary) 15%, transparent)",
              border:
                "1px solid color-mix(in srgb, var(--primary) 40%, transparent)",
              color: "var(--primary)",
            }
          : {
              "background-color": "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "rgba(255, 255, 255, 0.6)",
            }),
      }}
      onMouseEnter={(e) => {
        if (!loading()) {
          if (hasReacted()) {
            e.currentTarget.style.backgroundColor =
              "color-mix(in srgb, var(--primary) 20%, transparent)";
            e.currentTarget.style.borderColor =
              "color-mix(in srgb, var(--primary) 50%, transparent)";
          } else {
            e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)";
            e.currentTarget.style.color = "rgba(255, 255, 255, 0.8)";
          }
        }
      }}
      onMouseLeave={(e) => {
        if (!loading()) {
          if (hasReacted()) {
            e.currentTarget.style.backgroundColor =
              "color-mix(in srgb, var(--primary) 15%, transparent)";
            e.currentTarget.style.borderColor =
              "color-mix(in srgb, var(--primary) 40%, transparent)";
          } else {
            e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
            e.currentTarget.style.color = "rgba(255, 255, 255, 0.6)";
          }
        }
      }}
      onClick={handleReactionClick}
      disabled={loading()}
      title={getReactionTooltip()}
    >
      <Emoji shortcode={props.emoji} size="small" />
      <span class="font-medium">{props.count}</span>
    </button>
  );
};

export const MessageReactions: Component<ReactionsProps> = (props) => {
  // Always render the container, but conditionally show content
  // This ensures the component stays in the DOM and can react to changes
  const hasReactions = () => {
    return props.reactions && Object.keys(props.reactions).length > 0;
  };

  return (
    <Show when={hasReactions()}>
      <div class="flex flex-wrap gap-1 mt-1">
        <For each={Object.entries(props.reactions || {})}>
          {([emoji, data]) => (
            <Show when={data.count > 0}>
              <Reaction
                emoji={emoji}
                count={data.count}
                users={data.users}
                messageId={props.messageId || ""}
                roomId={props.roomId || ""}
                onReactionUpdate={props.onReactionUpdate}
              />
            </Show>
          )}
        </For>
      </div>
    </Show>
  );
};
