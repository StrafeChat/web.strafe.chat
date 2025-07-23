import { Component, createMemo } from "solid-js";
import { useAuth } from "../../../../lib/providers/auth/AuthProvider";

interface RoomMentionProps {
  roomId: string;
  className?: string;
}

export const RoomMention: Component<RoomMentionProps> = (props) => {
  const { rooms } = useAuth();
  
  const room = createMemo(() => {
    const allRooms = rooms();
    return allRooms ? allRooms.find(r => r.id === props.roomId) : null;
  });
  
  const displayName = createMemo(() => {
    const roomData = room();
    return roomData ? (roomData.name || `Room ${props.roomId}`) : `Unknown Room`;
  });
  
  return (
    <span 
      class={`mention mention-room bg-blue-500 bg-opacity-20 text-blue-500 px-1 rounded cursor-pointer hover:bg-opacity-30 transition-colors ${props.className || ''}`}
      title={`#${displayName()}`}
    >
      #{displayName()}
    </span>
  );
};