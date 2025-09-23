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
import { useContextMenu } from "../../../lib/providers/context/ContextMenuProvider";
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
import { MessageReactions } from "./components/reactions";
import { EmojiPicker } from "./components/EmojiPicker";
import { addReaction } from "../../../lib/api/reactions";

export function Message(props: MessageProps) {
  const { getUser, getMessage, getSpaceMember } = useCache();
  const { appearance } = useUserSettings();
  const { user, rooms, deleteMessage, editMessage, isMobile } = useAuth();
  const [t] = useTransContext();
  const navigate = useNavigate();
  const { openContextMenu } = useContextMenu();

  // Create a reactive signal for the current message to track cache updates
  const currentMessage = createMemo(() => {
    if (!props.id || !props.room_id) return props;
    const cachedMessage = getMessage(props.room_id, props.id);
    const result = cachedMessage || props;

    // Debug logging to track reactivity
    if (props.id) {
      console.log(
        `[Message] currentMessage memo re-evaluated for message ${props.id}:`,
        {
          hasReactions: !!result.reactions,
          reactionCount: result.reactions
            ? Object.keys(result.reactions).length
            : 0,
          reactions: result.reactions,
        },
      );
    }

    return result;
  });

  const [isEditing, setIsEditing] = createSignal(false);
  const [editContent, setEditContent] = createSignal(props.content);
  const [isEditLoading, setIsEditLoading] = createSignal(false);
  const [editError, setEditError] = createSignal("");
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);
  const [deleteError, setDeleteError] = createSignal("");
  const [isHovered, setIsHovered] = createSignal(false);

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

  const refMessages = referencedMessages(() => props, getMessage, getUser);
  const inviteStates = useInviteStates(props, { getMessage, getUser });
  const author = createMemo(() => getUser(props.author_id));
  const currentRoom = createMemo(() =>
    rooms().find((r) => r.id === props.room_id),
  );
  const currentSpaceId = createMemo(() => currentRoom()?.space_id);
  const currentSpaceMember = createMemo(() => {
    const spaceId = currentSpaceId();
    const authorId = props.author_id;
    if (!spaceId || !authorId) return undefined;
    return getSpaceMember(spaceId, authorId);
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

  const handleEmojiClick = (
    emoji: { shortcode: string; emoji: { name: string; code: string } },
    position: { x: number; y: number },
  ) => {
    setSelectedEmoji(emoji);
    setPopupPosition(position);
    setShowEmojiDetails(true);
  };

  // Get recent emojis for quick reactions
  const getRecentEmojis = () => {
    try {
      const stored = localStorage.getItem("recentEmojis");
      if (stored) {
        const recent = JSON.parse(stored);
        return recent.slice(0, 3); // Get top 3 most recent
      }
    } catch (error) {
      console.error("Failed to get recent emojis:", error);
    }

    // Default popular emojis if no recent ones
    return [
      { shortcode: "thumbsup" },
      { shortcode: "heart" },
      { shortcode: "joy" },
    ];
  };

  const handleAddReaction = async (emoji: string) => {
    if (!props.id || !props.room_id) return;

    try {
      await addReaction(props.room_id, props.id, emoji);
    } catch (error) {
      console.error("Failed to add reaction:", error);
    }
  };

  // Handle message click events including mention clicks
  const handleMessageClick = (_e: MouseEvent) => {
    // Default message click behavior can be added here
  };

  // Handle message context menu (right-click)
  const handleMessageContextMenu = (e: MouseEvent) => {
    e.preventDefault();

    const messageContextMenu = () => (
      <div class="py-1 w-48">
        <Show when={props.id && props.room_id}>
          <button
            class="w-full px-3 py-1.5 text-left text-sm text-text-primary hover:bg-surface hover:bg-opacity-10 transition-colors flex items-center gap-2"
            onClick={() => {
              // Quick reaction with thumbs up
              handleAddReaction("thumbsup");
            }}
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
            Add Reaction
          </button>
        </Show>

        <div class="border-t border-border-primary my-1"></div>

        <button
          class="w-full px-3 py-1.5 text-left text-sm text-text-primary hover:bg-surface hover:bg-opacity-10 transition-colors flex items-center gap-2"
          onClick={() => {
            navigator.clipboard.writeText(props.content || "");
          }}
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          Copy Text
        </button>

        <Show when={props.onReply && props.id}>
          <button
            class="w-full px-3 py-1.5 text-left text-sm text-text-primary hover:bg-surface hover:bg-opacity-10 transition-colors flex items-center gap-2"
            onClick={() => {
              props.onReply?.(props.id!);
            }}
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
              />
            </svg>
            Reply
          </button>
        </Show>

        <Show when={canEdit()}>
          <button
            class="w-full px-3 py-1.5 text-left text-sm text-text-primary hover:bg-surface hover:bg-opacity-10 transition-colors flex items-center gap-2"
            onClick={() => {
              handleEdit();
            }}
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            Edit
          </button>
        </Show>

        <Show when={canDelete()}>
          <button
            class="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-red-500 hover:bg-opacity-10 transition-colors flex items-center gap-2"
            onClick={() => {
              setShowDeleteConfirm(true);
            }}
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Delete
          </button>
        </Show>

        <div class="border-t border-border-primary my-1"></div>

        <button
          class="w-full px-3 py-1.5 text-left text-sm text-text-secondary hover:text-text-primary hover:bg-surface hover:bg-opacity-10 transition-colors flex items-center gap-2"
          onClick={() => {
            navigator.clipboard.writeText(props.id || "");
          }}
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          Copy Message ID
        </button>

        <button
          class="w-full px-3 py-1.5 text-left text-sm text-text-secondary hover:text-text-primary hover:bg-surface hover:bg-opacity-10 transition-colors flex items-center gap-2"
          onClick={() => {
            const currentRoom = rooms().find((r) => r.id === props.room_id);
            if (currentRoom) {
              let link = "";
              if (currentRoom.type === 0 || currentRoom.type === 1) {
                // PM or GROUP_PM
                link = `${window.location.origin}/rooms/${props.room_id}/${props.id}`;
              } else {
                // Space rooms
                link = `${window.location.origin}/spaces/${currentRoom.space_id}/rooms/${props.room_id}/${props.id}`;
              }
              navigator.clipboard.writeText(link);
            }
          }}
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
          Copy Message Link
        </button>
      </div>
    );

    openContextMenu(e, messageContextMenu);
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
        const room = rooms().find((r) => r.id === roomId);
        if (room) {
          // Check room type to determine the correct URL format
          // Space rooms (TEXT_ROOM, VOICE_ROOM, SPACE_SECTION) use /spaces/id/rooms/id
          // PM rooms (PM, GROUP_PM) use /rooms/id
          if (room.type === 0 || room.type === 1) {
            // PM or GROUP_PM
            // Use the router to navigate without page reload
            navigate(`/rooms/${roomId}`);
          } else {
            // Space rooms
            // Use the router to navigate without page reload
            navigate(`/spaces/${room.space_id}/rooms/${roomId}`);
          }
        }
      }
    };

    // Add event listeners
    document.addEventListener(
      "openUserPopup",
      handleOpenUserPopup as EventListener,
    );
    document.addEventListener(
      "navigateToRoom",
      handleNavigateToRoom as EventListener,
    );

    // Clean up event listeners
    onCleanup(() => {
      document.removeEventListener(
        "openUserPopup",
        handleOpenUserPopup as EventListener,
      );
      document.removeEventListener(
        "navigateToRoom",
        handleNavigateToRoom as EventListener,
      );
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
    const userMentionRegex = new RegExp(`<@${currentUser.id}>`, "g");
    if (userMentionRegex.test(props.content)) return true;

    // Check for @everyone mention
    if (/@everyone/.test(props.content)) return true;

    return false;
  });

  return (
    <>
      <>
        <div
          class={`flex flex-col ${shouldShowCompact ? "mt-1" : "mt-5"} group hover:bg-surface hover:bg-opacity-10 transition-colors px-4 w-full relative overflow-visible min-w-0 ${isCurrentUserMentioned() ? "bg-yellow-900/30 border-l-4 border-yellow-700 pl-3" : ""}`}
          onContextMenu={handleMessageContextMenu}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
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
            onAddReaction={handleAddReaction}
            messageId={props.id}
            recentEmojis={getRecentEmojis()}
          />

          <UserPopupMenu
            isOpen={userPopupOpen()}
            onClose={() => {
              setUserPopupOpen(false);
              // Remove the marker class from any elements
              document.querySelectorAll(".user-popup-open").forEach((el) => {
                el.classList.remove("user-popup-open");
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
              document.querySelectorAll(".user-popup-open").forEach((el) => {
                el.classList.remove("user-popup-open");
              });
            }}
            triggerRef={systemUserPopupTrigger()}
            userId={systemSelectedUserId() || ""}
            spaceId={currentSpaceId()}
            spaceMember={
              systemSelectedUserId()
                ? getSpaceMember(
                    currentSpaceId() || "",
                    systemSelectedUserId() || "",
                  )
                : undefined
            }
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
                <MessageReactions
                  reactions={currentMessage().reactions}
                  messageId={props.id}
                  roomId={props.room_id}
                />

                {/* Quick Reaction Bar on Hover */}
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
