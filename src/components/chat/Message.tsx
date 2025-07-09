import { Component, createMemo, Show, createSignal, onCleanup, createEffect, For } from "solid-js";
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
import { MessageType, SystemMessageType, MessageAttachment } from "../../types/messageTypes";
import { Avatar } from "../common/Avatar";
import { FS_URL } from '../../constants';
import AudioPlayer from '../ui/AudioPlayer';

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
  editingMessageId?: string | null;
  onReply?: (messageId: string) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  type?: MessageType;
  system_type?: string;
  system_data?: object;
  attachments?: MessageAttachment[];
}

const Message: Component<MessageProps> = (props) => {
  const shouldShowCompact = props.isCompact && !props.message_references?.length;
  const cache = useCache();
  const { user, rooms, deleteMessage, editMessage, isMobile } = useAuth();
  const [t] = useTransContext();
  
  // Helper function to construct complete attachment URLs
  const getAttachmentUrl = (url: string) => {
    if (url.startsWith('/attachments')) {
      return FS_URL + url; // Remove leading slash since FS_URL ends with slash
    }
    return url;
  };

  // Download function for attachments
  const handleDownload = async (attachment: MessageAttachment) => {
    try {
      const response = await fetch(getAttachmentUrl(attachment.url));
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback to direct link
      window.open(getAttachmentUrl(attachment.url), '_blank');
    }
  };
  
  // Check if this is a system message
  const isSystemMessage = () => {
    return props.type === MessageType.SYSTEM;
  };
  
  // Function to render system message content
  const renderSystemMessage = () => {
    if (!props.system_type || !props.system_data) return { text: "System message", timestamp: formatTimeOnly(props.created_at) };
    
    let systemData: { user_id?: string; actor_id?: string; new_value?: string; old_value?: string } = {};
    
    // Handle both object and string formats for backward compatibility
    if (typeof props.system_data === 'string') {
      try {
        systemData = JSON.parse(props.system_data);
      } catch (e) {
        console.error("Failed to parse system_data:", e);
        return { text: "System message", timestamp: formatTimeOnly(props.created_at) };
      }
    } else if (typeof props.system_data === 'object') {
      systemData = props.system_data as { user_id?: string; actor_id?: string; new_value?: string; old_value?: string };
    } else {
      console.error("Invalid system_data format:", props.system_data);
      return { text: "System message", timestamp: formatTimeOnly(props.created_at) };
    }
    
    const actorUser = systemData.actor_id ? cache.getUser(systemData.actor_id) : null;
    const targetUser = systemData.user_id ? cache.getUser(systemData.user_id) : null;
    const actorName = actorUser?.display_name || actorUser?.username || "Unknown User";
    const targetName = targetUser?.display_name || targetUser?.username || "Unknown User";
    const timestamp = formatTimeOnly(props.created_at);
    
    switch (props.system_type) {
      case SystemMessageType.MEMBER_ADDED:
        return { 
          actorId: systemData.actor_id,
          actorName,
          targetId: systemData.user_id,
          targetName,
          text: " added ",
          endText: ".",
          timestamp 
        };
      case SystemMessageType.MEMBER_REMOVED:
        // Check if user left themselves (actor_id === user_id)
        const isUserLeaving = systemData.actor_id === systemData.user_id;
        if (isUserLeaving) {
          return { 
            actorId: systemData.actor_id,
            actorName,
            text: " left.",
            timestamp 
          };
        } else {
          return { 
            actorId: systemData.actor_id,
            actorName,
            targetId: systemData.user_id,
            targetName,
            text: " removed ",
            endText: ".",
            timestamp 
          };
        }
      case SystemMessageType.ROOM_NAME_CHANGED:
        return { 
          actorId: systemData.actor_id,
          actorName,
          text: " changed the group name: ",
          boldText: systemData.new_value || "Unknown",
          timestamp 
        };
      case SystemMessageType.ROOM_TOPIC_CHANGED:
        return { 
          actorId: systemData.actor_id,
          actorName,
          text: " changed the group topic: ",
          boldText: systemData.new_value || "Unknown",
          timestamp 
        };
      case SystemMessageType.ROOM_ICON_CHANGED:
        return { 
          actorId: systemData.actor_id,
          actorName,
          text: " changed the group icon.",
          timestamp 
        };
      case SystemMessageType.OWNERSHIP_TRANSFERRED:
        return { 
          actorId: systemData.actor_id,
          actorName,
          targetId: systemData.user_id,
          targetName,
          text: " transferred ownership to ",
          endText: ".",
          timestamp 
        };
      default:
        return { text: "System message", timestamp };
    }
  };
  const [, setIsDeleting] = createSignal(false);
  const [deleteError, setDeleteError] = createSignal("");
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);
  const [isEditing, setIsEditing] = createSignal(false);
  const [editContent, setEditContent] = createSignal(props.content);
  
  // System message user popup states
  const [systemUserPopupOpen, setSystemUserPopupOpen] = createSignal(false);
  const [systemUserPopupTrigger, setSystemUserPopupTrigger] = createSignal<HTMLElement | undefined>();
  const [systemSelectedUserId, setSystemSelectedUserId] = createSignal<string | null>(null);

  // Handler for clicking on usernames in system messages
  const handleSystemUserClick = (e: MouseEvent, userId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSystemUserPopupTrigger(e.currentTarget as HTMLElement);
    setSystemSelectedUserId(userId);
    setSystemUserPopupOpen(true);
  };

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
          window.dispatchEvent(new CustomEvent('edit-message', {
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
        // Preserve scroll position when entering edit mode
        const chatContainer = document.querySelector('.overflow-y-auto') as HTMLDivElement;
        const currentScrollTop = chatContainer?.scrollTop || 0;
        const currentScrollHeight = chatContainer?.scrollHeight || 0;
        
        // Only set editing mode for desktop
        setIsEditing(true);
        
        // On desktop, focus the edit input after rendering and restore scroll position
        requestAnimationFrame(() => {
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
            
            // Restore scroll position after layout changes
            if (chatContainer) {
              // Calculate the new scroll position accounting for height changes
              const newScrollHeight = chatContainer.scrollHeight;
              const heightDifference = newScrollHeight - currentScrollHeight;
              chatContainer.scrollTop = currentScrollTop + heightDifference;
            }
          }, 0);
        });
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
      // Check if the date is within the past week (2-7 days ago)
      const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff >= 2 && daysDiff <= 7) {
        const weekday = date.toLocaleDateString(undefined, { weekday: "long" });
        return `Last ${weekday} at ${time}`;
      } else {
        // For dates older than a week, use standard date format
        const dateStr = date.toLocaleDateString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric' });
        return `${dateStr} ${time}`;
      }
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
      return `Today at ${time}`;
    } else if (isYesterday) {
      return `Yesterday at ${time}`;
    } else {
      // Check if the date is within the past week (2-7 days ago)
      const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff >= 2 && daysDiff <= 7) {
        const weekday = date.toLocaleDateString(undefined, { weekday: "long" });
        return `Last ${weekday} at ${time}`;
      } else {
        // For dates older than a week, use full date format
        return `${date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at ${time}`;
      }
    }
  };

  // Popup state for user menu
  const [userPopupOpen, setUserPopupOpen] = createSignal(false);
  const [userPopupTrigger, setUserPopupTrigger] = createSignal<HTMLElement | undefined>();
  const [avatarBouncing, setAvatarBouncing] = createSignal(false);

  // Handler for clicking the author name/avatar (now inline, not extra row)
  const handleAuthorClick = (e: MouseEvent) => {
    const target = e.currentTarget as HTMLElement;
    
    // Add bounce animation to avatar
    if (target.tagName === 'IMG') {
      setAvatarBouncing(true);
      setTimeout(() => setAvatarBouncing(false), 300);
    }
    
    setUserPopupTrigger(target);
    setUserPopupOpen(true);
  };

  // Helper function to get system message icon
  const getSystemMessageIcon = () => {
    switch (props.system_type) {
      case SystemMessageType.MEMBER_ADDED:
        return (
          <svg class="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
          </svg>
        );
      case SystemMessageType.MEMBER_REMOVED:
        return (
          <svg class="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M11 6a3 3 0 11-6 0 3 3 0 016 0zM14 17a6 6 0 00-12 0h12zM13 8a1 1 0 100 2h4a1 1 0 100-2h-4z" />
          </svg>
        );
      case SystemMessageType.ROOM_NAME_CHANGED:
        return (
          <svg class="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
          </svg>
        );
      case SystemMessageType.ROOM_TOPIC_CHANGED:
        return (
          <svg class="w-6 h-6 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clip-rule="evenodd" />
          </svg>
        );
      case SystemMessageType.ROOM_ICON_CHANGED:
        return (
          <svg class="w-6 h-6 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd" />
          </svg>
        );
      case SystemMessageType.OWNERSHIP_TRANSFERRED:
        return (
          <svg class="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clip-rule="evenodd" />
            <path d="M2 13.692V16a2 2 0 002 2h12a2 2 0 002-2v-2.308A24.974 24.974 0 0110 15c-2.796 0-5.487-.46-8-1.308z" />
          </svg>
        );
      default:
        return (
          <svg class="w-6 h-6 text-text-secondary" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
          </svg>
        );
    }
  };

  // Early return for system messages
  if (isSystemMessage()) {
    const messageData = renderSystemMessage();
    return (
      <>
        {/* System message user popup */}
        <UserPopupMenu
          isOpen={systemUserPopupOpen()}
          onClose={() => setSystemUserPopupOpen(false)}
          triggerRef={systemUserPopupTrigger()}
          userId={systemSelectedUserId() || ""}
        />
        <div class="flex flex-col mt-2 group hover:bg-surface hover:bg-opacity-10 transition-colors px-4 w-full relative overflow-visible">
          <div class="flex gap-3 w-full overflow-visible" id={`message-${props.id}`}>
            {/* System message icon */}
            <div class="flex-shrink-0 mt-1 w-10 h-10 flex items-center justify-center">
              {getSystemMessageIcon()}
            </div>
            {/* System message content */}
            <div class="flex-1 min-w-0 flex flex-col justify-center">
              <div class="flex items-center gap-2 overflow-hidden">
                <div class="text-text-secondary max-w-full message-content whitespace-pre-wrap overflow-wrap-anywhere" style="word-break: break-word; overflow-wrap: break-word;">
                   <span>
                     <Show when={messageData.actorId && messageData.actorName}>
                       <span
                         class="font-bold text-text-primary cursor-pointer hover:underline hover:text-white transition-colors"
                         onClick={(e) => handleSystemUserClick(e, messageData.actorId!)}
                       >
                         {messageData.actorName}
                       </span>
                     </Show>
                     <Show when={messageData.text}>
                       <span class="text-text-secondary">{messageData.text}</span>
                     </Show>
                     <Show when={messageData.targetId && messageData.targetName}>
                       <span
                         class="font-bold text-text-primary cursor-pointer hover:underline hover:text-white transition-colors"
                         onClick={(e) => handleSystemUserClick(e, messageData.targetId!)}
                       >
                         {messageData.targetName}
                       </span>
                     </Show>
                     <Show when={messageData.endText}>
                       <span class="text-text-secondary">{messageData.endText}</span>
                     </Show>
                     <Show when={messageData.boldText}>
                       <strong class="font-semibold text-text-primary">{messageData.boldText}</strong>
                     </Show>
                     <Show when={!messageData.actorId && messageData.text}>
                       <span class="text-text-secondary">{messageData.text}</span>
                     </Show>
                   </span>
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
  }

  return (
    <>
      <div class={`flex flex-col ${shouldShowCompact ? 'mt-1' : 'mt-5'} group hover:bg-surface hover:bg-opacity-10 transition-colors px-4 w-full relative overflow-visible min-w-0`}>
        {/* Referenced messages (replies) - Discord style - Above the message content */}
         <Show when={referencedMessages().length > 0}>
           <div>
             <For each={referencedMessages()}>
               {(refMessage) => (
                 <div class="relative">
                   {/* Connecting line - goes down from reply to main message */}
                    <div class="absolute left-[20px] bottom-[-2px] w-7 h-2.5 border-l-2 border-t-2 border-text-secondary opacity-40 rounded-tl-md"></div>
                    <div 
                      class="flex items-center gap-1.5 ml-[42px] px-3 rounded hover:bg-surface hover:bg-opacity-20 cursor-pointer transition-colors max-w-[calc(100%-3rem)] overflow-hidden"
                     onClick={() => scrollToMessage(refMessage.id)}
                   >
                     <Avatar
                       userId={refMessage.author_id}
                       avatar={refMessage.avatar}
                       alt="Avatar"
                       class="flex-shrink-0"
                       size="xs"
                     />
                     <span class="text-xs font-medium text-text-primary flex-shrink-0 max-w-[120px] truncate">
                       {refMessage.author}
                     </span>
                     <span class="text-xs text-text-secondary opacity-80 truncate min-w-0 flex-1">
                       {refMessage.content || "Click to see attachment"}
                     </span>
                   </div>
                 </div>
               )}
             </For>
           </div>
         </Show>
        {/* Message hover menu */}
        <div class="absolute right-2 top-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-0.5 bg-background border border-border rounded-md shadow-lg z-20 transform -translate-y-1/2">
          <Show when={props.onReply}>
            <Tooltip content="Reply" position="top">
              <button
                class="p-1.5 hover:bg-surface hover:bg-opacity-10 rounded-md transition-colors"
                onClick={() => props.onReply?.(props.id!)}
              >
                <svg class="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </button>
            </Tooltip>
          </Show>
          <Show when={canEdit()}>
            <Tooltip content="Edit" position="top">
              <button
                class="p-1.5 hover:bg-surface hover:bg-opacity-10 rounded-md transition-colors"
                onClick={handleEdit}
              >
                <svg class="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            </Tooltip>
          </Show>
          <Show when={canDelete()}>
            <Tooltip content="Delete" position="top">
              <button
                class="p-1.5 hover:bg-surface hover:bg-opacity-10 rounded-md transition-colors"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <svg class="w-4 h-4 text-text-secondary hover:text-red-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </Tooltip>
          </Show>
        </div>
        {/* User popup menu (kept here, but trigger is inline) */}
        <UserPopupMenu
          isOpen={userPopupOpen()}
          onClose={() => setUserPopupOpen(false)}
          triggerRef={userPopupTrigger()}
          userId={props.author_id}
        />
        <div class={`flex gap-3 w-full overflow-visible min-w-0 ${props.pending && !props.id ? 'opacity-70' : ''}`} id={`message-${props.id}`} data-message-id={props.id}>
          <Show when={!shouldShowCompact}>
            <div class="flex-shrink-0 mt-1">
              <Avatar
                userId={props.author_id}
                avatar={author()?.avatar}
                alt="Avatar"
                class={`cursor-pointer hover:ring-2 hover:ring-primary transition-transform duration-300 ${avatarBouncing() ? 'animate-bounce' : ''}`}
                size="md"
                onClick={handleAuthorClick}
              />
            </div>
          </Show>
          <div class={`flex-1 min-w-0 flex flex-col justify-center ${shouldShowCompact ? 'ml-[52px]' : ''} relative overflow-hidden`}>
            <Show when={shouldShowCompact}>  
              <div class="text-xs text-text-secondary whitespace-nowrap flex-shrink-0 absolute left-[-56px] top-0 leading-[1.5] w-12 text-center opacity-0 group-hover:opacity-100 transition-opacity z-10" style="margin-top: 0.25rem;">
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
                class="text-text-primary max-w-full message-content whitespace-pre-wrap overflow-hidden overflow-wrap-anywhere min-w-0"
                data-edited={props.edited_at ? "true" : undefined}
                style="word-break: break-word; overflow-wrap: break-word; max-width: 100%;"
              >
                <span class="markdown-content" innerHTML={parseMarkdown(props.content)} />
              </div>
              
              {/* Attachments */}
              <Show when={props.attachments && props.attachments.length > 0}>
                <div class="mt-2 space-y-2">
                  <For each={props.attachments}>
                    {(attachment) => {
                      const isImage = attachment?.type?.startsWith('image/') || false;
                      const isVideo = attachment?.type?.startsWith('video/') || false;
                      const isAudio = attachment?.type?.startsWith('audio/') || false;
                      
                      return (
                        <div 
                          class="border border-border rounded-lg overflow-hidden" 
                          style={{
                            ...((isImage || isVideo) && attachment.width && attachment.height && {
                              'max-width': `min(${Math.min(attachment.width, 448)}px, 100%)`
                            }),
                            ...((isImage || isVideo) && (!attachment.width || !attachment.height) && {
                              'max-width': '28rem'
                            }),
                            ...(!isImage && !isVideo && {
                              'max-width': '28rem'
                            })
                          }}>
                          <Show when={isImage}>
                            <img 
                              src={getAttachmentUrl(attachment.url)} 
                              alt={attachment.name}
                              class="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => window.open(getAttachmentUrl(attachment.url), '_blank')}
                              loading="lazy"
                              style={{
                                ...(attachment.width && attachment.height && {
                                  'aspect-ratio': `${attachment.width} / ${attachment.height}`
                                })
                              }}
                            />
                          </Show>
                          <Show when={isVideo}>
                            <video 
                              src={getAttachmentUrl(attachment.url)} 
                              controls
                              class="w-full h-auto"
                              preload="metadata"
                              style={{
                                ...(attachment.width && attachment.height && {
                                  'aspect-ratio': `${attachment.width} / ${attachment.height}`
                                })
                              }}
                            >
                              Your browser does not support the video tag.
                            </video>
                          </Show>
                          <Show when={isAudio}>
                             <AudioPlayer 
                               src={getAttachmentUrl(attachment.url)}
                               name={attachment.name}
                               size={attachment.size}
                             />
                           </Show>
                          <Show when={!isAudio}>
                            <div class="p-3 bg-surface bg-opacity-20">
                              <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2 min-w-0">
                                  <Show when={!isImage && !isVideo && !isAudio}>
                                    <svg class="w-5 h-5 text-text-secondary flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                      <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd" />
                                    </svg>
                                  </Show>
                                  <div class="min-w-0">
                                    <div class="text-sm font-medium text-text-primary truncate">{attachment.name}</div>
                                    <div class="text-xs text-text-secondary">
                                      {(attachment.size / 1024 / 1024).toFixed(2)} MB
                                      <Show when={attachment.width && attachment.height}>
                                        <span class="ml-1">• {attachment.width}×{attachment.height}</span>
                                      </Show>
                                    </div>
                                  </div>
                                </div>
                                <button 
                                  onClick={() => handleDownload(attachment)}
                                  class="flex-shrink-0 p-1 hover:bg-surface hover:bg-opacity-30 rounded transition-colors focus:outline-none"
                                  title="Download"
                                >
                                  <svg class="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </Show>
                        </div>
                      );
                    }}
                  </For>
                </div>
              </Show>
            </Show>
            <Show when={isEditing()}>
              <div class="bg-background border border-border rounded-md p-3 mt-1">
                <div
                  ref={editInputRef}
                  contentEditable
                  class="text-text-primary whitespace-pre-wrap overflow-hidden max-w-full bg-surface bg-opacity-30 p-3 rounded-md focus:outline-none border border-transparent focus:border-primary min-h-[40px] resize-none"
                  style="word-break: break-word; overflow-wrap: break-word;"
                  onInput={(e) => setEditContent(e.currentTarget.textContent || "")}
                >
                  {props.content}
                </div>
                <Show when={editError()}>
                  <div class="text-xs text-red-500 mt-2">{editError()}</div>
                </Show>
                <div class="flex items-center justify-between mt-3">
                  <div class="text-xs text-text-secondary">
                    escape to <span class="text-text-primary font-medium cursor-pointer hover:underline" onClick={handleCancelEdit}>cancel</span> • enter to <span class="text-text-primary font-medium cursor-pointer hover:underline" onClick={handleEdit}>save</span>
                  </div>
                  <div class="flex gap-2">
                    <button
                      class="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
                      onClick={handleCancelEdit}
                      disabled={isEditLoading()}
                    >
                      Cancel
                    </button>
                    <button
                      class="px-3 py-1.5 text-sm bg-primary text-white rounded hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={handleEdit}
                      disabled={isEditLoading() || !editContent().trim()}
                    >
                      <Show when={isEditLoading()} fallback="Save">
                        Saving...
                      </Show>
                    </button>
                  </div>
                </div>
              </div>
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