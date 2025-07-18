import { Component } from "solid-js";
import { useContextMenu } from "../../lib/providers/context/ContextMenuProvider";
import { usePermissions } from "../../lib/hooks/usePermissions";
import { RoomWithRecipients } from "../../types/rooms";
import Copy from "../shared/icons/Copy";
import Edit from "../shared/icons/Edit";
import Link from "../shared/icons/Link";

interface RoomContextMenuProps {
  room: RoomWithRecipients;
  onEditRoom?: () => void;
}

const RoomContextMenu: Component<RoomContextMenuProps> = (props) => {
  const { closeContextMenu } = useContextMenu();
  const { checkPermission } = usePermissions();

  const canManageChannels = () => {
    if (!props.room.space_id) return false;
    return checkPermission(props.room.space_id.toString(), "MANAGE_CHANNELS");
  };

  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(props.room.id);
    closeContextMenu();
  };

  const handleCopyLink = () => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/spaces/${props.room.space_id}/rooms/${props.room.id}`;
    navigator.clipboard.writeText(link);
    closeContextMenu();
  };

  const handleEditRoom = () => {
    props.onEditRoom?.();
    closeContextMenu();
  };

  return (
    <div class="py-1">
      <button
        onClick={handleCopyRoomId}
        class="w-full px-3 py-2 text-left text-sm hover:bg-surface rounded flex items-center gap-2 text-text-primary"
      >
        <Copy class="w-4 h-4" />
        Copy Room ID
      </button>
      
      <button
        onClick={handleCopyLink}
        class="w-full px-3 py-2 text-left text-sm hover:bg-surface rounded flex items-center gap-2 text-text-primary"
      >
        <Link class="w-4 h-4" />
        Copy Link
      </button>
      
      {canManageChannels() && (
        <button
          onClick={handleEditRoom}
          class="w-full px-3 py-2 text-left text-sm hover:bg-surface rounded flex items-center gap-2 text-text-primary"
        >
          <Edit class="w-4 h-4" />
          Edit Room
        </button>
      )}
    </div>
  );
};

export default RoomContextMenu;