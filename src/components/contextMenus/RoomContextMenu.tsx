import { Component, createSignal } from "solid-js";
import { Portal } from "solid-js/web";
import { useContextMenu } from "../../lib/providers/context/ContextMenuProvider";
import { usePermissions } from "../../lib/hooks/usePermissions";
import { RoomWithRecipients } from "../../types/rooms";
import { api } from "../../lib/api";
import { useToast } from "../common/Toast";
import Copy from "../shared/icons/Copy";
import Edit from "../shared/icons/Edit";
import Link from "../shared/icons/Link";
import { RoomType } from "../../types/roomTypes";

interface RoomContextMenuProps {
  room: RoomWithRecipients;
  onEditRoom?: () => void;
}

const RoomContextMenu: Component<RoomContextMenuProps> = (props) => {
  const { closeContextMenu } = useContextMenu();
  const { checkPermission } = usePermissions();
  const { showToast } = useToast();
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);
  const [isDeleting, setIsDeleting] = createSignal(false);

  const canManageChannels = () => {
    if (!props.room.space_id) return false;
    return checkPermission(props.room.space_id.toString(), "MANAGE_CHANNELS");
  };

  const canDeleteRoom = () => {
    console.log('canDeleteRoom check:', {
      roomType: props.room.type,
      roomName: props.room.name,
      spaceId: props.room.space_id,
      canManageChannels: canManageChannels()
    });
    
    // Can delete space rooms if user has MANAGE_CHANNELS permission
    if (props.room.type === RoomType.TEXT_ROOM || props.room.type === RoomType.VOICE_ROOM || props.room.type === RoomType.SPACE_SECTION) {
      return canManageChannels();
    }
    // Can delete group PMs (handled by backend permission checks)
    if (props.room.type === RoomType.GROUP_PM) {
      return true;
    }
    return false;
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

  const handleDeleteRoom = () => {
    console.log('handleDeleteRoom called for room:', props.room.name);
    console.log('showDeleteConfirm before:', showDeleteConfirm());
    setShowDeleteConfirm(true);
    console.log('showDeleteConfirm after:', showDeleteConfirm());
    // Don't close context menu immediately - let the modal handle it
  };

  const confirmDeleteRoom = async () => {
    setIsDeleting(true);
    try {
      await api.rooms.delete(props.room.id);
      showToast("Room deleted successfully", "success");
      setShowDeleteConfirm(false);
      closeContextMenu();
    } catch (error) {
      console.error("Failed to delete room:", error);
      showToast("Failed to delete room", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const getRoomTypeName = () => {
    switch (props.room.type) {
      case RoomType.TEXT_ROOM:
        return "Room";
      case RoomType.VOICE_ROOM:
        return "Room";
      case RoomType.SPACE_SECTION:
        return "Section";
      case RoomType.GROUP_PM:
        return "group";
      default:
        return "room";
    }
  };

  return (
    <>
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
        
        {canDeleteRoom() && (
          <button
            onClick={(e) => {
              console.log('Delete button clicked!', e);
              handleDeleteRoom();
            }}
            class="w-full px-3 py-2 text-left text-sm hover:bg-surface rounded flex items-center gap-2 text-red-400 hover:text-red-300"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete {getRoomTypeName()}
          </button>
        )}
      </div>
      
      <Portal>
        {showDeleteConfirm() && (
           <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
             <div class="bg-background2 rounded-lg p-6 max-w-md w-full mx-4 border border-border">
               <h3 class="text-xl font-semibold text-text-primary mb-4">
                 Delete {getRoomTypeName()}
               </h3>
               <p class="text-text-primary mb-6">
                 Are you sure you want to delete "{props.room.name}"? This action cannot be undone.
               </p>
               <div class="flex justify-end gap-3">
                 <button
                   class="px-4 py-2.5 text-text-primary hover:bg-surface rounded-md transition-colors font-medium"
                   onClick={() => {
                     console.log('Cancel button clicked');
                     setShowDeleteConfirm(false);
                     closeContextMenu();
                   }}
                 >
                   Cancel
                 </button>
                 <button
                   class="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors font-medium"
                   onClick={() => {
                     console.log('Delete button clicked');
                     confirmDeleteRoom();
                   }}
                 >
                   Delete
                 </button>
               </div>
             </div>
           </div>
         )}
      </Portal>
    </>
  );
};

export default RoomContextMenu;