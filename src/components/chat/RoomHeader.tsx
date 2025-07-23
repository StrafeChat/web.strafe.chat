import { Component, Show } from "solid-js";

import { RoomType } from "../../types/roomTypes";
import { Avatar } from "../common/Avatar";
import { StatusIndicator, UserStatus } from "../common/StatusIndicator";
import DefaultGroupPM from "../shared/icons/DefaultGroupPM";
import { FS_URL } from "../../constants";
import { useAuth } from "../../lib/providers/auth/AuthProvider";
import { useCache } from "../../lib/providers/cache/CacheProvider";

interface RoomHeaderProps {
  roomName: string;
  roomTopic?: string;
  roomId?: string;
  roomType?: RoomType;
}

const RoomHeader: Component<RoomHeaderProps> = (props) => {
  const { user, rooms } = useAuth();
  const cache = useCache();

  const currentRoom = () => {
    const allRooms = rooms();
    if (!allRooms || !props.roomId) return null;
    return allRooms.find(room => room.id === props.roomId);
  };

  const getRoomStatus = () => {
    const room = currentRoom();
    if (!room) return "offline" as UserStatus;

    if (room.type === RoomType.PM && room.recipients && room.recipients.length > 0) {
      const currentUserId = user()?.id;
      const recipientId = room.recipients.find((id) => id !== currentUserId);
      if (!recipientId) return "offline" as UserStatus;
      
      const cachedUser = cache.getUser(recipientId);
      if (cachedUser?.presence?.status) {
        return cachedUser.presence.status as UserStatus;
      } else if (room.recipients_data && room.recipients_data.length > 0) {
        const recipient = room.recipients_data.find((r) => r.id === recipientId);
        if (recipient) {
          return (recipient.presence?.status || "offline") as UserStatus;
        }
      }
    }
    return "offline" as UserStatus;
  };

  const recipientCount = () => {
    const room = currentRoom();
    if (!room || !room.recipients) return 0;
    return room.recipients.length;
  };



  return (
    <div class="flex items-center gap-2">
      <div class="relative flex-shrink-0 flex items-center">
        <div class="w-8 h-8 rounded-full overflow-hidden">
          {props.roomType === RoomType.GROUP_PM ? (
            currentRoom()?.icon ? (
              <img
                src={`${FS_URL}/icons/${currentRoom()?.id}/${currentRoom()?.icon}`}
                alt="Group icon"
                class="w-full h-full object-cover"
              />
            ) : (
              <div class="w-full h-full bg-surface bg-opacity-20 text-text-primary flex items-center justify-center">
                <DefaultGroupPM />
              </div>
            )
          ) : props.roomType === RoomType.PM ? (
            <Show
              when={Boolean(currentRoom()?.recipients_data?.length)}
              fallback={
                <Avatar
                  userId="default"
                  avatar="default.webp"
                  alt="Room avatar"
                  size="sm"
                />
              }
            >
              {(() => {
                const room = currentRoom();
                const currentUserId = user()?.id;
                const recipient = room?.recipients_data?.find((r) => r.id !== currentUserId);
                return (
                  <Avatar
                    userId={recipient?.id || "default"}
                    avatar={recipient?.avatar || "default.webp"}
                    alt="Room avatar"
                    size="sm"
                  />
                );
              })()}
            </Show>
          ) : (
            <Avatar
              userId="default"
              avatar="default.webp"
              alt="Room avatar"
              size="sm"
            />
          )}
        </div>
        {props.roomType === RoomType.PM && (
          <StatusIndicator
            status={getRoomStatus()}
            class="border-background1 absolute bottom-[-2px] right-[-2px]"
          />
        )}
      </div>
      <div class="flex flex-col justify-center flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <h2 class="text-sm font-semibold text-text-primary truncate">{props.roomName}</h2>

        </div>
        <Show when={props.roomType === RoomType.GROUP_PM}>
          <Show 
            when={props.roomTopic && props.roomTopic.trim()}
            fallback={
              <p class="text-xs text-text-secondary">
                {recipientCount()} Members
              </p>
            }
          >
            <p class="text-xs text-text-secondary truncate max-w-[200px]">
              {props.roomTopic}
            </p>
          </Show>
        </Show>
      </div>
    </div>
  );
};

export default RoomHeader;