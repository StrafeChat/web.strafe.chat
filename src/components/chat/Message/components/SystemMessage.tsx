import { Component } from "solid-js";
import { SystemMessageType } from "../../../../types/messageTypes";
import UserPopupMenu from "../../../common/UserPopupMenu";
import { MessageProps } from "../types";
import { formatTimeOnly } from "../utils/date";

export const renderSystemMessage = (
  props: MessageProps,
  cache: { getUser: (arg0: string) => any },
  appearance: any,
) => {
  if (!props.system_type || !props.system_data)
    return {
      text: "System message",
      timestamp: formatTimeOnly(props.created_at, appearance),
    };

  let systemData: {
    user_id?: string;
    actor_id?: string;
    new_value?: string;
    old_value?: string;
  } = {};

  // Handle both object and string formats for backward compatibility
  if (typeof props.system_data === "string") {
    try {
      systemData = JSON.parse(props.system_data);
    } catch (e) {
      console.error("Failed to parse system_data:", e);
      return {
        text: "System message",
        timestamp: formatTimeOnly(props.created_at, appearance),
      };
    }
  } else if (typeof props.system_data === "object") {
    systemData = props.system_data as {
      user_id?: string;
      actor_id?: string;
      new_value?: string;
      old_value?: string;
    };
  } else {
    console.error("Invalid system_data format:", props.system_data);
    return {
      text: "System message",
      timestamp: formatTimeOnly(props.created_at, appearance),
    };
  }

  const actorUser = systemData.actor_id
    ? cache.getUser(systemData.actor_id)
    : null;
  const targetUser = systemData.user_id
    ? cache.getUser(systemData.user_id)
    : null;
  const actorName =
    actorUser?.display_name || actorUser?.username || "Unknown User";
  const targetName =
    targetUser?.display_name || targetUser?.username || "Unknown User";
  const timestamp = formatTimeOnly(props.created_at, appearance);

  switch (props.system_type) {
    case SystemMessageType.MEMBER_ADDED:
      return {
        actorId: systemData.actor_id,
        actorName,
        targetId: systemData.user_id,
        targetName,
        text: " added ",
        endText: ".",
        timestamp,
      };
    case SystemMessageType.MEMBER_REMOVED:
      // Check if user left themselves (actor_id === user_id)
      const isUserLeaving = systemData.actor_id === systemData.user_id;
      if (isUserLeaving) {
        return {
          actorId: systemData.actor_id,
          actorName,
          text: " left.",
          timestamp,
        };
      } else {
        return {
          actorId: systemData.actor_id,
          actorName,
          targetId: systemData.user_id,
          targetName,
          text: " removed ",
          endText: ".",
          timestamp,
        };
      }
    case SystemMessageType.ROOM_NAME_CHANGED:
      return {
        actorId: systemData.actor_id,
        actorName,
        text: " changed the group name: ",
        boldText: systemData.new_value || "Unknown",
        timestamp,
      };
    case SystemMessageType.ROOM_TOPIC_CHANGED:
      return {
        actorId: systemData.actor_id,
        actorName,
        text: " changed the group topic: ",
        boldText: systemData.new_value || "Unknown",
        timestamp,
      };
    case SystemMessageType.ROOM_ICON_CHANGED:
      return {
        actorId: systemData.actor_id,
        actorName,
        text: " changed the group icon.",
        timestamp,
      };
    case SystemMessageType.OWNERSHIP_TRANSFERRED:
      return {
        actorId: systemData.actor_id,
        actorName,
        targetId: systemData.user_id,
        targetName,
        text: " transferred ownership to ",
        endText: ".",
        timestamp,
      };
    default:
      return { text: "System message", timestamp };
  }
};

export const getSystemMessageIcon = (props: MessageProps) => {
  switch (props.system_type) {
    case SystemMessageType.MEMBER_ADDED:
      return (
        <svg
          class="w-6 h-6 text-green-500"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
        </svg>
      );
    case SystemMessageType.MEMBER_REMOVED:
      return (
        <svg
          class="w-6 h-6 text-red-500"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M11 6a3 3 0 11-6 0 3 3 0 016 0zM14 17a6 6 0 00-12 0h12zM13 8a1 1 0 100 2h4a1 1 0 100-2h-4z" />
        </svg>
      );
    case SystemMessageType.ROOM_NAME_CHANGED:
      return (
        <svg
          class="w-6 h-6 text-blue-500"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fill-rule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clip-rule="evenodd"
          />
        </svg>
      );
    case SystemMessageType.ROOM_TOPIC_CHANGED:
      return (
        <svg
          class="w-6 h-6 text-purple-500"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fill-rule="evenodd"
            d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z"
            clip-rule="evenodd"
          />
        </svg>
      );
    case SystemMessageType.ROOM_ICON_CHANGED:
      return (
        <svg
          class="w-6 h-6 text-orange-500"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fill-rule="evenodd"
            d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
            clip-rule="evenodd"
          />
        </svg>
      );
    case SystemMessageType.OWNERSHIP_TRANSFERRED:
      return (
        <svg
          class="w-6 h-6 text-yellow-500"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fill-rule="evenodd"
            d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z"
            clip-rule="evenodd"
          />
          <path d="M2 13.692V16a2 2 0 002 2h12a2 2 0 002-2v-2.308A24.974 24.974 0 0110 15c-2.796 0-5.487-.46-8-1.308z" />
        </svg>
      );
    default:
      return (
        <svg
          class="w-6 h-6 text-text-secondary"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fill-rule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clip-rule="evenodd"
          />
        </svg>
      );
  }
};

interface SystemMessageProps {
  message: any;
  cache: any;
  appearance: any;
  systemUserPopupOpen: boolean;
  systemUserPopupTrigger?: HTMLElement;
  systemSelectedUserId: string | null;
  onSystemUserClick: (e: MouseEvent, userId: string) => void;
  onClosePopup: () => void;
  spaceId?: string;
}

export const SystemMessage: Component<SystemMessageProps> = (props) => {
  const messageData = renderSystemMessage(
    props.message,
    props.cache,
    props.appearance,
  );

  // Get space member for the selected user in system messages
  const selectedUserSpaceMember = () => {
    const spaceId = props.spaceId;
    const userId = props.systemSelectedUserId;
    if (!spaceId || !userId) return undefined;
    return props.cache.getSpaceMember(spaceId, userId);
  };

  return (
    <>
      <UserPopupMenu
        isOpen={props.systemUserPopupOpen}
        onClose={props.onClosePopup}
        triggerRef={props.systemUserPopupTrigger}
        userId={props.systemSelectedUserId || ""}
        spaceId={props.spaceId}
        spaceMember={selectedUserSpaceMember()}
      />
      <div class="flex flex-col mt-2 group hover:bg-surface hover:bg-opacity-10 transition-colors px-4 w-full relative overflow-visible">
        <div
          class="flex gap-3 w-full overflow-visible"
          id={`message-${props.message.id}`}
        >
          <div class="flex-shrink-0 mt-1 w-10 h-10 flex items-center justify-center">
            {getSystemMessageIcon(props.message)}
          </div>
          <div class="flex-1 min-w-0 flex flex-col justify-center">
            <div class="flex items-center gap-2 overflow-hidden">
              <div
                class="text-text-secondary max-w-full message-content whitespace-pre-wrap overflow-wrap-anywhere"
                style="word-break: break-word; overflow-wrap: break-word;"
              >
                {messageData.actorName && (
                  <span
                    class="text-text-primary hover:underline cursor-pointer"
                    onClick={(e) =>
                      props.onSystemUserClick(e, messageData.actorId ?? "")
                    }
                  >
                    {messageData.actorName}
                  </span>
                )}
                {messageData.text && <span> {messageData.text}</span>}
                {messageData.targetName && (
                  <span
                    class="text-text-primary hover:underline cursor-pointer"
                    onClick={(e) =>
                      props.onSystemUserClick(e, messageData.targetId ?? "")
                    }
                  >
                    {messageData.targetName}
                  </span>
                )}
                {messageData.boldText && (
                  <span class="font-semibold"> {messageData.boldText}</span>
                )}
                {messageData.endText && <span>{messageData.endText}</span>}
                <span class="text-xs text-text-secondary whitespace-nowrap flex-shrink-0 ml-2">
                  {messageData.timestamp}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
