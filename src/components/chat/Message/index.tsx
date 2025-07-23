import {
  createMemo,
  createSignal,
  onCleanup,
  createEffect,
  Show,
} from "solid-js";
import { Portal } from "solid-js/web";
import { useTransContext } from "@mbarzda/solid-i18next";
import { useNavigate } from "@solidjs/router";

import { FS_URL } from "../../../constants";
import { useAuth } from "../../../lib/providers/auth/AuthProvider";
import { useCache } from "../../../lib/providers/cache/CacheProvider";
import { useUserSettings } from "../../../lib/providers/userSettings/UserSettingsProvider";

import { RoomType } from "../../../types/roomTypes";
import { MessageAttachment, MessageType } from "../../../types/messageTypes";

import ConfirmModal from "../../modals/ConfirmModal";
import UserPopupMenu from "../../common/UserPopupMenu";
import { MessageProps } from "./types";

import { referencedMessages } from "./utils/message";
import { useInviteStates } from "./components/invite";
import { MessageReplies } from "./components/replies";
import { MessageHoverMenu } from "./components/HoverMenu";
import { MessageHeader } from "./components/header";
import { MessageAuthorInfo } from "./components/AuthorInfo";
import { MessageContent } from "./components/content";
import { MessageAttachments } from "./components/attachments";
import { MessageEditor } from "./components/editor";
import { CompactTimestamp } from "./components/CompactTimestamp";
import { EmojiDetailsPopup } from "./components/EmojiDetails";
import { InviteEmbeds } from "./components/InviteEmbeds";
import { SystemMessage } from "./components/SystemMessage";

export function Message(props: MessageProps) {
  const cache = useCache();
  const { appearance } = useUserSettings();
  const { user, rooms, deleteMessage, editMessage, isMobile } = useAuth();
  const [t] = useTransContext();
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = createSignal(false);
  const [editContent, setEditContent] = createSignal(props.content);
  const [isEditLoading, setIsEditLoading] = createSignal(false);
  const [editError, setEditError] = createSignal("");
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);
  const [deleteError, setDeleteError] = createSignal("");
  const [userPopupOpen, setUserPopupOpen] = createSignal(false);
  const [userPopupTrigger, setUserPopupTrigger] = createSignal<
    HTMLElement | undefined
  >();
  const [avatarBouncing, setAvatarBouncing] = createSignal(false);
  const [replyMaxWidth, setReplyMaxWidth] = createSignal("calc(100% - 3rem)");

  const [systemUserPopupOpen, setSystemUserPopupOpen] = createSignal(false);
  const [systemUserPopupTrigger, setSystemUserPopupTrigger] = createSignal<
    HTMLElement | undefined
  >();
  const [systemSelectedUserId, setSystemSelectedUserId] = createSignal<
    string | null
  >(null);

  const [showEmojiDetails, setShowEmojiDetails] = createSignal(false);
  const [selectedEmoji, setSelectedEmoji] = createSignal<any>(null);
  const [popupPosition, setPopupPosition] = createSignal({ x: 0, y: 0 });


  const refMessages = referencedMessages(() => props, cache);
  const inviteStates = useInviteStates(props, cache);
  const author = createMemo(() => cache.getUser(props.author_id));
  const currentRoom = createMemo(() => rooms().find((r) => r.id === props.room_id));
  const currentSpaceId = createMemo(() => currentRoom()?.space_id);
  const currentSpaceMember = createMemo(() => {
    const spaceId = currentSpaceId();
    const authorId = props.author_id;
    if (!spaceId || !authorId) return undefined;
    return cache.getSpaceMember(spaceId, authorId);
  });
  const shouldShowCompact =
    props.isCompact && !props.message_references?.length;

  const canDelete = createMemo(() => {
    const currentUser = user();
    const currentRoom = rooms().find((r) => r.id === props.room_id);
    if (!currentUser || !props.id || !currentRoom) return false;

    const isAuthor = props.author_id === currentUser.id;
    if (
      currentRoom.type === RoomType.PM ||
      currentRoom.type === RoomType.TEXT_ROOM
    )
      return isAuthor;
    if (currentRoom.type === RoomType.GROUP_PM)
      return isAuthor || currentRoom.owner_id === currentUser.id;

    return false;
  });

  const canEdit = createMemo(() => user()?.id === props.author_id);

  const handleAuthorClick = (e: MouseEvent) => {
    const target = e.currentTarget as HTMLElement;
    if (target.tagName === "IMG") {
      setAvatarBouncing(true);
      setTimeout(() => setAvatarBouncing(false), 300);
    }
    setUserPopupTrigger(target);
    setUserPopupOpen(true);
  };

  const getAttachmentUrl = (url: string) =>
    url.startsWith("/attachments") ? FS_URL + url : url;

  const handleDownload = async (attachment: MessageAttachment) => {
    try {
      const response = await fetch(getAttachmentUrl(attachment.url));
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      window.open(getAttachmentUrl(attachment.url), "_blank");
    }
  };

  createEffect(() => setEditContent(props.content));

  const handleEdit = async () => {
    if (!canEdit() || !props.id || !props.room_id) return;

    if (isEditing()) {
      try {
        setIsEditLoading(true);
        setEditError("");
        const content = editContent().trim();
        if (!content) return setEditError(t("chat.errors.emptyMessage"));
        const result = await editMessage(props.room_id, props.id, content);
        if (!result.success)
          return setEditError(result.error || t("chat.errors.editFailed"));
        setIsEditing(false);
      } catch (error) {
        setEditError(t("chat.errors.editFailed"));
      } finally {
        setIsEditLoading(false);
      }
    } else {
      setEditContent(props.content || "");

      if (isMobile()) {
        const chatInput = document.querySelector(
          "[data-placeholder]",
        ) as HTMLDivElement;
        if (chatInput) {
          const editContentValue = editContent();
          window.dispatchEvent(
            new CustomEvent("edit-message", {
              detail: {
                messageId: props.id,
                roomId: props.room_id,
                content: editContentValue,
              },
            }),
          );
          chatInput.textContent = editContentValue;
          chatInput.dispatchEvent(new Event("input", { bubbles: true }));
          chatInput.focus();

          const range = document.createRange();
          const selection = window.getSelection();
          range.selectNodeContents(chatInput);
          range.collapse(false); // Position cursor at the end for editing
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      } else {
        const chatContainer = document.querySelector(
          ".overflow-y-auto",
        ) as HTMLDivElement;
        const currentScrollTop = chatContainer?.scrollTop || 0;
        const currentScrollHeight = chatContainer?.scrollHeight || 0;

        setIsEditing(true);

        requestAnimationFrame(() => {
          setTimeout(() => {
            const editInput = document.querySelector(
              "[contenteditable=true]",
            ) as HTMLDivElement;
            editInput?.focus();

            const range = document.createRange();
            const selection = window.getSelection();
            range.selectNodeContents(editInput);
            range.collapse(false); // Position cursor at the end for editing
            selection?.removeAllRanges();
            selection?.addRange(range);

            if (chatContainer) {
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

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && isEditing()) handleCancelEdit();
    else if (e.key === "Enter" && !e.shiftKey && isEditing()) handleEdit();
  };

  createEffect(() => {
    if (isEditing()) document.addEventListener("keydown", handleKeyDown);
    else document.removeEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => document.removeEventListener("keydown", handleKeyDown));

  const handleDelete = async () => {
    if (!props.id || !props.room_id) return;
    try {
      setDeleteError("");
      const result = await deleteMessage(props.room_id, props.id);
      if (result.success) setShowDeleteConfirm(false);
      else setDeleteError(result.error || t("chat.errors.deleteFailed"));
    } catch {
      setDeleteError(t("chat.errors.deleteFailed"));
    }
  };

  const handleEmojiClick = (emoji: { shortcode: string; emoji: { name: string; code: string } }, position: { x: number; y: number }) => {
    setSelectedEmoji(emoji);
    setPopupPosition(position);
    setShowEmojiDetails(true);
  };

  // Handle message click events including mention clicks
  const handleMessageClick = (_e: MouseEvent) => {
    // Default message click behavior can be added here
  };

  // Setup event listeners for mention click events
  createEffect(() => {
    // Event listener for opening user popup from mention clicks
    const handleOpenUserPopup = (e: CustomEvent) => {
      const { userId, triggerElement } = e.detail;
      if (userId) {
        // Set the user popup trigger element
        setUserPopupTrigger(triggerElement);
        // Set the user ID for the popup (if different from the message author)
        if (userId !== props.author_id) {
          // For mentions of users other than the message author
          setSystemSelectedUserId(userId);
          setSystemUserPopupTrigger(triggerElement);
          setSystemUserPopupOpen(true);
        } else {
          // For mentions of the message author
          setUserPopupOpen(true);
        }
      }
    };

    // Event listener for navigating to rooms from mention clicks
    const handleNavigateToRoom = (e: CustomEvent) => {
      const { roomId } = e.detail;
      if (roomId) {
        // Navigate to the room
        const room = rooms().find(r => r.id === roomId);
        if (room) {
          // Check room type to determine the correct URL format
          // Space rooms (TEXT_ROOM, VOICE_ROOM, SPACE_SECTION) use /spaces/id/rooms/id
          // PM rooms (PM, GROUP_PM) use /rooms/id
          if (room.type === 0 || room.type === 1) { // PM or GROUP_PM
            // Use the router to navigate without page reload
            navigate(`/rooms/${roomId}`);
          } else { // Space rooms
            // Use the router to navigate without page reload
            navigate(`/spaces/${room.space_id}/rooms/${roomId}`);
          }
        }
      }
    };

    // Add event listeners
    document.addEventListener('openUserPopup', handleOpenUserPopup as EventListener);
    document.addEventListener('navigateToRoom', handleNavigateToRoom as EventListener);

    // Clean up event listeners
    onCleanup(() => {
      document.removeEventListener('openUserPopup', handleOpenUserPopup as EventListener);
      document.removeEventListener('navigateToRoom', handleNavigateToRoom as EventListener);
    });
  });


  createEffect(() => {
    const updateReplyWidth = () => {
      const chatContainer = document
        .querySelector("[data-message-id]")
        ?.closest(".overflow-y-auto");
      if (chatContainer) {
        const containerWidth = chatContainer.clientWidth;
        setReplyMaxWidth(`${Math.max(300, containerWidth * 0.85)}px`);
      }
    };
    updateReplyWidth();
    window.addEventListener("resize", updateReplyWidth);
    onCleanup(() => window.removeEventListener("resize", updateReplyWidth));
  });

  if (props.type === MessageType.SYSTEM) {
    return (
      <SystemMessage
        message={props}
        cache={cache}
        appearance={appearance}
        systemUserPopupOpen={systemUserPopupOpen()}
        systemUserPopupTrigger={systemUserPopupTrigger()}
        systemSelectedUserId={systemSelectedUserId()}
        onSystemUserClick={(e, userId) => {
          setSystemUserPopupTrigger(e.currentTarget as HTMLElement);
          setSystemSelectedUserId(userId);
          setSystemUserPopupOpen(true);
        }}
        onClosePopup={() => setSystemUserPopupOpen(false)}
        spaceId={currentSpaceId()}
      />
    );
  }

  // Check if the current user is mentioned in the message content
  const isCurrentUserMentioned = createMemo(() => {
    const currentUser = user();
    if (!currentUser || !props.content) return false;
    
    // Check for user mention format: <@user_id>
    const userMentionRegex = new RegExp(`<@${currentUser.id}>`, 'g');
    if (userMentionRegex.test(props.content)) return true;
    
    // Check for @everyone mention
    if (/@everyone/.test(props.content)) return true;
    
    return false;
  });

  return (
    <>
      <>
        <div
          class={`flex flex-col ${shouldShowCompact ? "mt-1" : "mt-5"} group hover:bg-surface hover:bg-opacity-10 transition-colors px-4 w-full relative overflow-visible min-w-0 ${isCurrentUserMentioned() ? "bg-yellow-900/30 border-l-4 border-yellow-700" : ""}`}
        >
          <MessageReplies
            refMessages={refMessages()}
            replyMaxWidth={replyMaxWidth()}
          />

          <MessageHoverMenu
            canEdit={canEdit()}
            canDelete={canDelete()}
            onReply={props.onReply}
            onEdit={handleEdit}
            onDelete={(shiftPressed) => {
              if (shiftPressed) {
                handleDelete();
              } else {
                setShowDeleteConfirm(true);
              }
            }}
            messageId={props.id}
          />

          <UserPopupMenu
            isOpen={userPopupOpen()}
            onClose={() => {
              setUserPopupOpen(false);
              // Remove the marker class from any elements
              document.querySelectorAll('.user-popup-open').forEach(el => {
                el.classList.remove('user-popup-open');
              });
            }}
            triggerRef={userPopupTrigger()}
            userId={props.author_id}
            spaceId={currentSpaceId()}
            spaceMember={currentSpaceMember()}
          />
          
          {/* Popup for mentioned users (not the message author) */}
          <UserPopupMenu
            isOpen={systemUserPopupOpen()}
            onClose={() => {
              setSystemUserPopupOpen(false);
              // Remove the marker class from any elements
              document.querySelectorAll('.user-popup-open').forEach(el => {
                el.classList.remove('user-popup-open');
              });
            }}
            triggerRef={systemUserPopupTrigger()}
            userId={systemSelectedUserId() || ''}
            spaceId={currentSpaceId()}
            spaceMember={systemSelectedUserId() ? cache.getSpaceMember(currentSpaceId() || '', systemSelectedUserId() || '') : undefined}
          />

          <div
            class={`flex gap-3 w-full overflow-visible min-w-0 transition-all duration-300 ease-in-out ${props.pending && !props.id ? "opacity-60" : "opacity-100"}`}
          >
            <MessageHeader
              author={author()}
              authorId={props.author_id}
              createdAt={props.created_at ?? ""}
              isCompact={shouldShowCompact}
              pending={props.pending ?? false}
              error={props.error}
              deleteError={deleteError()}
              onAuthorClick={handleAuthorClick}
              avatarBouncing={avatarBouncing()}
              appearance={appearance}
              t={t}
            />

            <div
              class={`flex-1 min-w-0 flex flex-col justify-center ${shouldShowCompact ? "ml-[52px]" : ""} relative overflow-hidden`}
            >
              <Show when={shouldShowCompact}>
                <CompactTimestamp
                  createdAt={props.created_at ?? ""}
                  appearance={appearance}
                />
              </Show>

              <MessageAuthorInfo
                author={author()}
                createdAt={props.created_at ?? ""}
                pending={props.pending ?? false}
                error={props.error}
                deleteError={deleteError()}
                isCompact={shouldShowCompact}
                onAuthorClick={handleAuthorClick}
                appearance={appearance}
                t={t}
              />

              <Show when={!isEditing()}>
                <MessageContent
                  content={props.content}
                  editedAt={props.edited_at ?? undefined}
                  isCompact={shouldShowCompact}
                  pending={props.pending ?? false}
                  error={props.error}
                  onMessageClick={handleMessageClick}
                  onEmojiClick={handleEmojiClick}
                  roomId={props.room_id}
                  messageId={props.id}
                  senderId={props.author_id}
                />
                <Show when={props.attachments}>
                  <MessageAttachments
                    attachments={props.attachments || []}
                    getAttachmentUrl={getAttachmentUrl}
                    onDownload={handleDownload}
                    messageId={props.id}
                  />
                </Show>
                <InviteEmbeds inviteStates={inviteStates() || []} />
              </Show>

              <Show when={isEditing()}>
                <MessageEditor
                  content={editContent()}
                  error={editError()}
                  isLoading={isEditLoading()}
                  onContentChange={setEditContent}
                  onSave={handleEdit}
                  onCancel={handleCancelEdit}
                />
              </Show>
            </div>
          </div>
        </div>
      </>

      <Portal>
        <ConfirmModal
          isOpen={showDeleteConfirm()}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
          title="Delete Message"
          message="Are you sure you want to delete this message?"
          confirmText="Delete"
          isDanger={true}
        />
      </Portal>

      <EmojiDetailsPopup
        showEmojiDetails={showEmojiDetails()}
        selectedEmoji={selectedEmoji()}
        popupPosition={popupPosition()}
        onClose={() => setShowEmojiDetails(false)}
      />
    </>
  );
}
