import { Component, createMemo, For, Show, createSignal, onCleanup, createEffect } from "solid-js";
import { FS_URL } from "../../constants";
import { useCache } from "../../lib/providers/cache/CacheProvider";
import { useTransContext } from "@mbarzda/solid-i18next";
import { Tooltip } from "../common/Tooltip";
import { useAuth } from "../../lib/providers/auth/AuthProvider";
import { RoomType } from "../../types/rooms";
import ConfirmModal from "../modals/ConfirmModal";
import { Portal } from "solid-js/web";
import { parseMarkdown } from "../../lib/utils/markdownUtils";
import { useUserSettings } from "../../lib/providers/userSettings/UserSettingsProvider";
import UserPopupMenu from "../common/UserPopupMenu";

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
  message_references?: string[];
  room_id?: string;
  onReply?: (messageId: string) => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const Message: Component<MessageProps> = (props) => {
  const shouldShowCompact = props.isCompact && !props.message_references?.length;
  const cache = useCache();
  const { user, rooms, deleteMessage, editMessage, isMobile } = useAuth();
  const [t] = useTransContext();
  const [isDeleting, setIsDeleting] = createSignal(false);
  const [deleteError, setDeleteError] = createSignal("");
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);
  const [isEditing, setIsEditing] = createSignal(false);
  const [editContent, setEditContent] = createSignal(props.content);

  // Update editContent when props.content changes
  createEffect(() => {
    setEditContent(props.content);
  });
  const [isEditLoading, setIsEditLoading] = createSignal(false);
  const [editError, setEditError] = createSignal("");
  let editInputRef: HTMLDivElement | undefined;
  
  const author = createMemo(() => {
    const userData = cache.getUser(props.author_id);
    return userData;
  });
  
  // Check if current user can delete this message
  const canDelete = createMemo(() => {
    const currentUser = user();
    const currentRoom = rooms().find(r => r.id === props.room_id);
    
    if (!currentUser || !props.id || !currentRoom) return false;
    
    // Check if user is the message author
    const isAuthor = props.author_id === currentUser.id;
    
    // In normal PMs (type 0), only the author can delete
    if (currentRoom.type === RoomType.PM) {
      return isAuthor;
    }
    
    // In group PMs (type 1), both the author and group creator can delete
    if (currentRoom.type === RoomType.GROUP_PM) {
      const isGroupCreator = currentRoom.owner_id === currentUser.id;
      return isAuthor || isGroupCreator;
    }
    
    return false;
  });
  
  // Check if current user can edit this message
  const canEdit = createMemo(() => {
    const currentUser = user();
    if (!currentUser || !props.id) return false;
    
    // Only the author can edit their messages
    return props.author_id === currentUser.id;
  });
  
  const handleEdit = async () => {
    if (!canEdit() || !props.id || !props.room_id) return;
    
    if (isEditing()) {
      // Save the edit
      try {
        setIsEditLoading(true);
        setEditError("");
        
        const content = editContent().trim();
        if (!content) {
          setEditError(t("chat.errors.emptyMessage"));
          return;
        }
        
        const result = await editMessage(props.room_id, props.id, content);
        
        if (!result.success) {
          setEditError(result.error || t("chat.errors.editFailed"));
        } else {
          // Exit edit mode on success
          setIsEditing(false);
        }
      } catch (error) {
        console.error("Error editing message:", error);
        setEditError(t("chat.errors.editFailed"));
      } finally {
        setIsEditLoading(false);
      }
    } else {
      // Enter edit mode
      setEditContent(props.content);
      
      if (isMobile()) {
        // On mobile, only set the editing state in the ChatArea component
        // and move content to chat input without setting isEditing to true
        const chatInput = document.querySelector('[data-placeholder]') as HTMLDivElement;
        if (chatInput) {
          // Set the editing message ID and room ID in the parent component
          window.dispatchEvent(new CustomEvent('editMessage', {
            detail: {
              messageId: props.id,
              roomId: props.room_id,
              content: props.content
            }
          }));
          
          chatInput.textContent = props.content;
          // Dispatch input event to update state
          const event = new Event('input', { bubbles: true });
          chatInput.dispatchEvent(event);
          
          // Focus the input and place cursor at the end
          chatInput.focus();
          // Place cursor at the end of the text
          const range = document.createRange();
          const selection = window.getSelection();
          range.selectNodeContents(chatInput);
          range.collapse(false);
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      } else {
        // Only set editing mode for desktop
        setIsEditing(true);
        // On desktop, focus the edit input after rendering
        setTimeout(() => {
          if (editInputRef) {
            editInputRef.focus();
            // Place cursor at the end
            const range = document.createRange();
            const selection = window.getSelection();
            range.selectNodeContents(editInputRef);
            range.collapse(false);
            selection?.removeAllRanges();
            selection?.addRange(range);
          }
        }, 0);
      }
    }
  };
  
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditError("");
  };
  
  // Handle escape key to cancel editing
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isEditing()) {
      e.preventDefault();
      handleCancelEdit();
    } else if (e.key === 'Enter' && !e.shiftKey && isEditing()) {
      e.preventDefault();
      handleEdit();
    }
  };
  
  // Add and remove event listeners for keyboard shortcuts
  createEffect(() => {
    if (isEditing()) {
      document.addEventListener('keydown', handleKeyDown);
    } else {
      document.removeEventListener('keydown', handleKeyDown);
    }
  });
  
  onCleanup(() => {
    document.removeEventListener('keydown', handleKeyDown);
  });
  
  const referencedMessages = createMemo(() => {
    if (!props.message_references?.length) return [];
    
    return props.message_references.map(refId => {
      const message = cache.getMessage(props.room_id!, refId);
      const user = cache.getUser(message?.author_id || refId);
      return {
        id: refId,
        content: message?.content,
        author: user?.display_name || user?.username || "Unknown User",
        avatar: user?.avatar,
        author_id: message?.author_id || refId
      };
    }) || [];
  });

  // Function to scroll to and highlight referenced message
  const scrollToMessage = (messageId: string) => {
    const element = document.getElementById(`message-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('highlight-message');
      setTimeout(() => {
        element.classList.remove('highlight-message');
      }, 2000);
    }
  };

  const handleReply = () => {
    if (props.id && props.onReply) {
      props.onReply(props.id);
    }
  };
  
  const handleDelete = async () => {
    if (!props.id || !props.room_id) return;
    
    try {
      setIsDeleting(true);
      setDeleteError("");
      
      const result = await deleteMessage(props.room_id, props.id);
      
      if (!result.success) {
        setDeleteError(result.error || t("chat.errors.deleteFailed"));
      } else {
        // Close the modal on successful deletion
        setShowDeleteConfirm(false);
      }
    } catch (error) {
      console.error("Error deleting message:", error);
      setDeleteError(t("chat.errors.deleteFailed"));
    } finally {
      setIsDeleting(false);
    }
  };

  const formatTimestamp = (timestamp: string | undefined) => {
    if (!timestamp) return "";
    
    const date = new Date(timestamp);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const isToday = date.toDateString() === now.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();
    
    const { appearance } = useUserSettings();
    // Access the reactive appearance function to get the latest settings
    const use24HourFormat = appearance().use24HourFormat;
    
    const time = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: !use24HourFormat
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
  
  const formatTimeOnly = (timestamp: string | undefined) => {
    if (!timestamp) return "";
    
    const date = new Date(timestamp);
    const { appearance } = useUserSettings();
    // Access the reactive appearance function to get the latest settings
    const use24HourFormat = appearance().use24HourFormat;
    
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: !use24HourFormat
    });
  };
  
  const formatFullDate = (timestamp: string | undefined) => {
    if (!timestamp) return "";
    
    const date = new Date(timestamp);
    const { appearance } = useUserSettings();
    // Access the reactive appearance function to get the latest settings
    const use24HourFormat = appearance().use24HourFormat;
    
    const time = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: !use24HourFormat
    });
    
    return `${date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} ${time}`;
  };

  // Popup state for user menu
  const [userPopupOpen, setUserPopupOpen] = createSignal(false);
  const [userPopupTrigger, setUserPopupTrigger] = createSignal<HTMLElement | undefined>();

  // Handler for clicking the author name/avatar (now inline, not extra row)
  const handleAuthorClick = (e: MouseEvent) => {
    setUserPopupTrigger(e.currentTarget as HTMLElement);
    setUserPopupOpen(true);
  };

  return (
    <>
      <div class={`flex flex-col ${shouldShowCompact ? 'mt-1' : 'mt-5'} group hover:bg-surface hover:bg-opacity-10 transition-colors px-4 w-full relative`}>
        {/* User popup menu (kept here, but trigger is inline) */}
        <UserPopupMenu
          isOpen={userPopupOpen()}
          onClose={() => setUserPopupOpen(false)}
          triggerRef={userPopupTrigger()}
          userId={props.author_id}
        />
        <div class="flex gap-3 w-full overflow-hidden ${props.pending && !props.id ? 'opacity-70' : ''}" id={`message-${props.id}`}>
          <Show when={!shouldShowCompact}>
            <div class="flex-shrink-0 mt-1">
              <img
                src={`${FS_URL}/avatars/${props.author_id}/${author()?.avatar || "favicon.ico"}`}
                alt="Avatar"
                class="w-10 h-10 rounded-full cursor-pointer hover:ring-2 hover:ring-primary"
                onClick={handleAuthorClick}
              />
            </div>
          </Show>
          <div class={`flex-1 min-w-0 flex flex-col justify-center ${shouldShowCompact ? 'ml-[52px]' : ''} relative`}>
            <Show when={shouldShowCompact}>  
              <div class="text-xs text-text-secondary whitespace-nowrap flex-shrink-0 absolute left-[-52px] top-[50%] transform translate-y-[-50%] w-10 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Tooltip position="top" content={formatFullDate(props.created_at)}>
                  <span>{formatTimeOnly(props.created_at)}</span>
                </Tooltip>
              </div>
            </Show>
            <Show when={!shouldShowCompact}>
              <div class="flex items-center gap-2 overflow-hidden">
                <div class="flex items-baseline gap-2 overflow-hidden">
                  <span
                    class="font-medium text-text-primary truncate cursor-pointer hover:underline"
                    onClick={handleAuthorClick}
                  >
                    {author()?.display_name || author()?.username || "Unknown User"}
                  </span>
                  <span class="text-xs text-text-secondary whitespace-nowrap flex-shrink-0">
                    {formatTimestamp(props.created_at)}
                  </span>
                </div>
                <Show when={props.pending && !props.id}>
                  <span class="text-xs text-text-secondary italic flex-shrink-0">(sending...)</span>
                </Show>
                <Show when={props.error}>
                  <span class="text-xs text-red-500 flex-shrink-0">{props.error}</span>
                </Show>
                <Show when={deleteError()}>
                  <span class="text-xs text-red-500 flex-shrink-0">{deleteError()}</span>
                </Show>
              </div>
            </Show>
            <Show when={!isEditing()}>
              <div 
                class="text-text-primary max-w-full message-content whitespace-pre-wrap overflow-hidden overflow-wrap-anywhere"
                data-edited={props.edited_at ? "true" : undefined}
                style="word-break: break-word; overflow-wrap: break-word;"
              >
                <span innerHTML={parseMarkdown(props.content.replace(/\n\s*\n/g, '\n&nbsp;\n'))} />
              </div>
            </Show>
            <Show when={isEditing()}>
              <div
                ref={editInputRef}
                contentEditable
                class="text-text-primary break-all break-words whitespace-pre-wrap overflow-hidden max-w-full bg-surface bg-opacity-20 p-2 rounded focus:outline-none border border-primary border-opacity-30"
                onInput={(e) => setEditContent(e.currentTarget.textContent || "")}
              >
                {props.content}
              </div>
              <Show when={editError()}>
                <div class="text-xs text-red-500 mt-1">{editError()}</div>
              </Show>
            </Show>
          </div>
        </div>
      </div>
      <Portal>
        <ConfirmModal
          isOpen={showDeleteConfirm()}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
          title="Delete Message"
          message={<>Are you sure you want to delete this message?</>}
          confirmText="Delete"
          isDanger={true}
        />
      </Portal>
    </>
  );
};

export default Message;