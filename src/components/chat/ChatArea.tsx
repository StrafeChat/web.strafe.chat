import {
  Component,
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
  batch,
} from "solid-js";
import { Key } from "@solid-primitives/keyed";
import { useParams } from "@solidjs/router";
import Message from "./Message";
import { useTransContext } from "@mbarzda/solid-i18next";
import { useCache } from "../../lib/providers/cache/CacheProvider";
import { useAuth } from "../../lib/providers/auth/AuthProvider";
import { BASE_URL, FS_URL } from "../../constants";
import { CachedMessage } from "../../lib/cache/MessageCache";
import { useUserSettings } from "../../lib/providers/userSettings/UserSettingsProvider";
import {
  hasUnclosedCodeBlock,
  updateCodeBlockIndicator,
} from "../../lib/utils/codeBlockUtils";
import { RoomType } from "../../types/roomTypes";
import { EmojiPicker } from "../shared/EmojiPicker";
import { EmojiAutocomplete } from "../shared/EmojiAutocomplete";
import DateDivider from "./DateDivider";
import UnreadDivider from "./UnreadDivider";
import MessageSkeleton from "./MessageSkeleton";
import { Avatar } from "../common/Avatar";
import { MessageAttachment } from "../../types/messageTypes";

const ChatArea: Component = () => {
  const params = useParams();
  const {
    user,
    rooms,
    sendMessage,
    editMessage,
    isMobile,
    sendTypingIndicator,
    unreadMessages,
    markMessagesAsRead,
  } = useAuth();
  const cache = useCache();
  const [t] = useTransContext();
  const { userSettings } = useUserSettings();
  const [messageText, setMessageText] = createSignal("");
  const [sending, setSending] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");
  const [messages, setMessages] = createSignal<CachedMessage[]>([]);
  const [pendingMessages, setPendingMessages] = createSignal<CachedMessage[]>(
    [],
  );
  const [replyingTo, setReplyingTo] = createSignal<string[]>([]);
  const [editingMessageId, setEditingMessageId] = createSignal<string | null>(
    null,
  );
  const [editingRoomId, setEditingRoomId] = createSignal<string | null>(null);
  const [typingUsers, setTypingUsers] = createSignal<
    { id: string; timestamp: number }[]
  >([]);
  const [isLoadingNewer, setIsLoadingNewer] = createSignal(false);
  const [shouldScrollToBottom, setShouldScrollToBottom] = createSignal(true);
  const [hasScrolledUp, setHasScrolledUp] = createSignal(false);
  const [showEmojiPicker, setShowEmojiPicker] = createSignal(false);
  const [emojiPickerPosition, setEmojiPickerPosition] = createSignal({
    top: 0,
    left: 0,
  });
  const [showEmojiAutocomplete, setShowEmojiAutocomplete] = createSignal(false);
  const [emojiAutocompleteQuery, setEmojiAutocompleteQuery] = createSignal("");
  const [emojiAutocompletePosition, setEmojiAutocompletePosition] =
    createSignal({ top: 0, left: 0, width: 0 });
  const [emojiAutocompleteRange, setEmojiAutocompleteRange] =
    createSignal<Range | null>(null);
  const [fileInputRef, setFileInputRef] = createSignal<HTMLInputElement>();
  const [attachments, setAttachments] = createSignal<
    Array<
      MessageAttachment & {
        uploading?: boolean;
        error?: string;
        file?: File; // Store the actual file for upload later
      }
    >
  >([]);
  const [, setUploadingFiles] = createSignal(false);
  const [hasReachedBeginning, setHasReachedBeginning] = createSignal(false);
  const [hasReachedEnd, setHasReachedEnd] = createSignal(false);
  const [loadingOlderPhase, setLoadingOlderPhase] = createSignal<
    "idle" | "loading" | "positioning"
  >("idle");
  const [, setScrollPosition] = createSignal({ top: 0, height: 0 });
  const [, setIsNearTop] = createSignal(false);
  const [isNearBottom, setIsNearBottom] = createSignal(true);
  const previouslyScrolledUp = { current: false };
  const initiallyFetchedRooms = { current: new Set<string>() };

  const messageCache = { current: new Map<string, CachedMessage[]>() };

  // File attachment constants
  const MAX_ATTACHMENTS = 10;
  const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
  const ALLOWED_FILE_TYPES = [
    "image/",
    "video/",
    "audio/",
    "text/",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/zip",
    "application/x-rar-compressed",
    "application/x-7z-compressed",
  ];

  // File upload helper functions
  const isFileTypeAllowed = (fileType: string): boolean => {
    return ALLOWED_FILE_TYPES.some((allowedType) =>
      fileType.startsWith(allowedType),
    );
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const uploadFileToNebula = async (file: File): Promise<MessageAttachment> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${FS_URL}/api/v1/files`, {
      method: "POST",
      body: formData,
      headers: {
        "X-Session-Token": localStorage.getItem("sc_token") || "",
      },
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const data = await response.json();
    // Construct the URL from user_id and file id
    const url = `/attachments/${data.user_id}/${data.id}`;
    return {
      id: data.id,
      name: data.name,
      type: data.type,
      size: data.size,
      url: url,
      height: data.height || 0,
      width: data.width || 0,
      user_id: data.user_id,
    };
  };

  const handleFileUpload = async (files: FileList) => {
    const currentAttachments = attachments();

    // Check attachment limit
    if (currentAttachments.length + files.length > MAX_ATTACHMENTS) {
      setError(`Maximum ${MAX_ATTACHMENTS} attachments allowed`);
      return;
    }

    const newAttachments = [...currentAttachments];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        setError(
          `File "${file.name}" is too large. Maximum size is ${formatFileSize(MAX_FILE_SIZE)}`,
        );
        continue;
      }

      // Validate file type
      if (!isFileTypeAllowed(file.type)) {
        setError(`File type "${file.type}" is not allowed`);
        continue;
      }

      // Store file locally without uploading
      const localAttachment = {
        id: `local-${Date.now()}-${i}`,
        name: file.name,
        type: file.type,
        size: file.size,
        url: URL.createObjectURL(file), // Create local URL for preview
        height: 0, // Will be set later for images/videos
        width: 0, // Will be set later for images/videos
        user_id: user()?.id || "", // Current user ID
        file: file, // Store the actual file for upload later
      };
      newAttachments.push(localAttachment);
    }

    setAttachments(newAttachments);
  };

  const removeAttachment = (attachmentId: string) => {
    setAttachments((prev) => {
      const attachmentToRemove = prev.find((a) => a.id === attachmentId);
      if (attachmentToRemove && attachmentToRemove.url.startsWith("blob:")) {
        // Clean up object URL to prevent memory leaks
        URL.revokeObjectURL(attachmentToRemove.url);
      }
      return prev.filter((a) => a.id !== attachmentId);
    });
  };

  // Get unread messages for the current room
  const currentRoomUnreadMessages = createMemo(() => {
    const allUnreads = unreadMessages();
    return allUnreads[params.roomId] || [];
  });

  // Track unread divider visibility and mark as read functionality
  let markAsReadTimeout: number | undefined;

  // Function to mark messages as read with a delay
  const markMessagesAsReadDelayed = (roomId: string) => {
    if (markAsReadTimeout) {
      clearTimeout(markAsReadTimeout);
    }
    markAsReadTimeout = window.setTimeout(() => {
      markMessagesAsRead(roomId);
    }, 1500); // 1.5 second delay to allow user to see the unread divider
  };

  // Set up intersection observer for unread divider
  const setupUnreadDividerObserver = (element: HTMLDivElement) => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.3) {
            // Unread divider is visible, mark messages as read after delay
            markMessagesAsReadDelayed(params.roomId);
          }
        });
      },
      {
        threshold: 0.3, // Trigger when 30% of the divider is visible
        rootMargin: "0px 0px -100px 0px", // Only trigger when divider is well within viewport
      },
    );

    observer.observe(element);

    // Cleanup observer when element is removed
    onCleanup(() => {
      observer.disconnect();
      if (markAsReadTimeout) {
        clearTimeout(markAsReadTimeout);
      }
    });
  };

  // Clean up timeout when room changes and reset loading state
  createEffect(() => {
    // Reset states when room changes
    setError("");
    setEditingMessageId(null);
    setEditingRoomId(null);
    setReplyingTo([]);
    setAttachments([]);

    // Let the room change effect handle loading state management
    // Removed conflicting setLoading(true) call that was causing inconsistent skeleton behavior

    return () => {
      if (markAsReadTimeout) {
        clearTimeout(markAsReadTimeout);
        markAsReadTimeout = undefined;
      }
    };
  });

  // Auto-focus chat input when room changes
  createEffect(() => {
    const roomId = params.roomId;
    if (roomId && chatInputRef) {
      console.log("[ChatArea] Auto-focusing chat input for room:", roomId);
      // Small delay to ensure the component is fully rendered
      setTimeout(() => {
        if (chatInputRef) {
          chatInputRef.focus();
          console.log("[ChatArea] Chat input focused successfully");
        }
      }, 50);
    }
  });

  // Helper function to check if a message is the first unread message
  const isFirstUnread = (message: CachedMessage) => {
    const unreads = currentRoomUnreadMessages();
    if (unreads.length === 0) return false;
    return message.id === unreads[0];
  };

  // Helper function to group messages by date
  const groupMessagesByDate = (messages: CachedMessage[]) => {
    const groups: { date: Date; messages: CachedMessage[] }[] = [];

    messages.forEach((message) => {
      // Use current date for messages without created_at (like pending messages)
      const messageDate = message.created_at
        ? new Date(message.created_at)
        : new Date();
      messageDate.setHours(0, 0, 0, 0);

      const existingGroup = groups.find(
        (group) => group.date.getTime() === messageDate.getTime(),
      );

      if (existingGroup) {
        existingGroup.messages.push(message);
      } else {
        groups.push({
          date: messageDate,
          messages: [message],
        });
      }
    });

    return groups.sort((a, b) => a.date.getTime() - b.date.getTime());
  };

  // Optimized message processing with better performance and caching
  const processMessages = (msgs: CachedMessage[]): CachedMessage[] => {
    if (!msgs || msgs.length === 0) return [];

    // Use room-specific cache key for better memory management
    const cacheKey = params.roomId;
    if (!cacheKey) return [];

    // Check if we can use cached processed messages with optimized comparison
    const cachedProcessed = messageCache.current.get(cacheKey);
    if (cachedProcessed && cachedProcessed.length === msgs.length) {
      // Quick check if messages are the same (by comparing first and last message IDs only)
      const firstCached = cachedProcessed[0];
      const lastCached = cachedProcessed[cachedProcessed.length - 1];
      const firstNew = msgs[0];
      const lastNew = msgs[msgs.length - 1];

      // Only do expensive content comparison if absolutely necessary
      if (firstCached?.id === firstNew?.id && lastCached?.id === lastNew?.id) {
        // Create a hash of message IDs and edited timestamps for quick comparison
        const cachedHash = cachedProcessed
          .map((m) => `${m.id}-${m.edited_at || ""}`)
          .join("|");
        const newHash = msgs
          .map((m) => `${m.id}-${m.edited_at || ""}`)
          .join("|");

        if (cachedHash === newHash) {
          return cachedProcessed;
        }
      }
    }

    // Create optimized map for deduplication with smooth transitions
    const messageMap = new Map<string, CachedMessage>();
    const seenNonces = new Set<string>();

    // Single pass processing with better performance and smooth transitions
    for (const msg of msgs) {
      if (msg.deleted) continue; // Skip deleted messages early

      // Use a unique key that prioritizes confirmed messages but maintains position
      const key = msg.id || msg.nonce || "";
      if (!key) continue;

      // If message has both ID and nonce, it's a confirmed message that replaced a temp one
      if (msg.id && msg.nonce) {
        // Remove any existing temporary message with this nonce
        if (messageMap.has(msg.nonce)) {
          messageMap.delete(msg.nonce);
        }
        // Add the confirmed message with its ID as key
        messageMap.set(msg.id, msg);
        seenNonces.add(msg.nonce);
      } else if (msg.id && !msg.nonce) {
        // Regular server message
        messageMap.set(msg.id, msg);
      } else if (msg.nonce && !seenNonces.has(msg.nonce) && !msg.id) {
        // Pending message only if no confirmed version exists
        messageMap.set(msg.nonce, msg);
        seenNonces.add(msg.nonce);
      }
    }

    // Convert to array and sort efficiently
    const processed = Array.from(messageMap.values()).sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;

      if (timeA !== timeB) return timeA - timeB;

      // Stable sort for same timestamps
      if (a.id && !b.id) return 1;
      if (!a.id && b.id) return -1;
      return 0;
    });

    // Cache the processed result
    messageCache.current.set(cacheKey, processed);

    // Limit cache size to prevent memory leaks
    if (messageCache.current.size > 10) {
      const oldestKey = messageCache.current.keys().next().value;
      if (oldestKey !== undefined) {
        messageCache.current.delete(oldestKey);
      }
    }

    return processed;
  };

  // Get the current room based on the roomId parameter
  const currentRoom = createMemo(() => {
    const allRooms = rooms();
    if (!allRooms) return null;

    return allRooms.find((room) => room.id === params.roomId);
  });

  // Combined messages for display (cached + pending)
  const displayMessages = createMemo(() => {
    const cached = messages();
    const pending = pendingMessages();

    // Create a set of nonces from cached messages for deduplication
    const cachedNonces = new Set(
      cached.filter((msg) => msg.nonce).map((msg) => msg.nonce),
    );
    // Also create a set of cached message IDs for additional deduplication
    const cachedIds = new Set(
      cached.filter((msg) => msg.id).map((msg) => msg.id),
    );

    // Debug logging
    if (pending.length > 0 || cachedNonces.size > 0) {
      console.log("[ChatArea] Deduplication debug:", {
        cachedCount: cached.length,
        pendingCount: pending.length,
        cachedNonces: Array.from(cachedNonces),
        pendingNonces: pending.map((msg) => msg.nonce),
        cachedMessagesWithNonces: cached
          .filter((msg) => msg.nonce)
          .map((msg) => ({ id: msg.id, nonce: msg.nonce })),
        cachedIds: Array.from(cachedIds),
        pendingIds: pending.map((msg) => msg.id).filter(Boolean),
      });
    }

    // Filter out pending messages that have been confirmed
    // Check both nonce and ID to handle race conditions
    const filteredPending = pending.filter((msg) => {
      // If message has a nonce and it exists in cache, filter it out
      if (msg.nonce && cachedNonces.has(msg.nonce)) {
        return false;
      }
      // If message has an ID and it exists in cache, filter it out
      if (msg.id && cachedIds.has(msg.id)) {
        return false;
      }
      return true;
    });

    if (filteredPending.length !== pending.length) {
      console.log(
        "[ChatArea] Filtered out",
        pending.length - filteredPending.length,
        "pending messages due to deduplication",
      );
    }

    // Combine and sort by timestamp
    const combined = [...cached, ...filteredPending];
    return combined.sort((a, b) => {
      const timeA = a.created_at
        ? new Date(a.created_at).getTime()
        : Date.now();
      const timeB = b.created_at
        ? new Date(b.created_at).getTime()
        : Date.now();
      return timeA - timeB;
    });
  });

  // Memoized grouped messages to prevent re-rendering when new messages arrive
  const groupedMessages = createMemo(() => {
    return groupMessagesByDate(displayMessages());
  });

  // Helper function to get room name for display
  // Helper function to check if this is a direct PM between two people
  const isDirectPM = () => {
    const room = currentRoom();
    return room && room.type === RoomType.PM;
  };

  const getRoomName = () => {
    const room = currentRoom();
    if (!room) return "Unknown Chat";

    // If room has a name, use it (for group PMs)
    if (room.name) return room.name;

    // For PMs, use the other user's display name or username
    if (room.recipients_data && room.recipients_data.length > 0) {
      // For group PMs, concatenate all recipient names
      if (room.type === RoomType.GROUP_PM) {
        const currentUserId = user()?.id;
        // Filter out current user and get display names
        const recipientNames = room.recipients_data
          .filter((r) => r.id !== currentUserId)
          .map((r) => {
            // Use cached data if available for most up-to-date info
            const cachedUser = cache.getUser(r.id);
            if (cachedUser) {
              return cachedUser.display_name || cachedUser.username;
            }
            return r.display_name || r.username;
          });

        // Join the first 3 names with commas
        if (recipientNames.length > 3) {
          return `${recipientNames.slice(0, 3).join(", ")} and ${recipientNames.length - 3} more`;
        } else {
          return recipientNames.join(", ");
        }
      }

      // For regular PMs
      if (room.type === RoomType.PM) {
        const currentUserId = user()?.id;

        // First check if we have recipients array to find the other user ID
        if (room.recipients && room.recipients.length > 0) {
          // Find the recipient ID that isn't the current user
          const otherRecipientId = room.recipients.find(
            (id) => id !== currentUserId,
          );

          if (otherRecipientId) {
            // Try to get user from cache first
            const cachedUser = cache.getUser(otherRecipientId);
            if (cachedUser) {
              return cachedUser.display_name || cachedUser.username;
            }

            // If not in cache, look in recipients_data
            const recipientData = room.recipients_data.find(
              (r) => r.id === otherRecipientId,
            );
            if (recipientData) {
              return recipientData.display_name || recipientData.username;
            }

            // If we have the ID but no data yet, show loading state
            return "Loading...";
          }
        }

        // Fallback to searching recipients_data if recipients array isn't available
        // Find any recipient that isn't the current user, regardless of position in array
        const recipient = room.recipients_data.find(
          (r) => r.id !== currentUserId,
        );
        if (recipient) {
          // Use cached data if available for most up-to-date info
          const cachedUser = cache.getUser(recipient.id);
          if (cachedUser) {
            return cachedUser.display_name || cachedUser.username;
          }
          return recipient.display_name || recipient.username;
        }

        // If somehow we couldn't find any non-current users, show loading state
        // This prevents showing the current user temporarily
        return "Loading...";
      }

      // Fallback to first recipient if we can't find a non-current user
      return (
        room.recipients_data[0].display_name || room.recipients_data[0].username
      );
    }

    return "Unknown Chat";
  };

  // Component did mount effect
  // Removed redundant initialization effect - room change effect handles all initialization

  // Handle new messages with optimized scrolling
  createEffect(() => {
    const msgs = displayMessages();

    // If we have messages and should scroll to bottom, do it
    // Don't auto-scroll when editing a message to prevent position issues
    if (
      msgs.length > 0 &&
      shouldScrollToBottom() &&
      !hasScrolledUp() &&
      !editingMessageId()
    ) {
      // Use requestAnimationFrame to batch scroll operations
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    }
  });

  // Sync messages with cache when cache is updated (with throttling)
  let lastCacheSync = 0;
  createEffect(() => {
    const roomId = params.roomId;
    if (!roomId) return;

    // Throttle cache synchronization to prevent excessive updates
    const now = Date.now();
    if (now - lastCacheSync < 100) return; // Throttle to max 10 updates per second
    lastCacheSync = now;

    // Get messages from cache and sync with local state
    const cachedMessages = cache.getMessages(roomId);
    const currentMessages = messages();

    // Only update if cache has different messages than local state
    if (
      cachedMessages.length !== currentMessages.length ||
      (cachedMessages.length > 0 &&
        currentMessages.length > 0 &&
        cachedMessages[cachedMessages.length - 1]?.id !==
          currentMessages[currentMessages.length - 1]?.id)
    ) {
      console.log(
        "[ChatArea] Syncing messages from cache:",
        cachedMessages.length,
      );
      const processed = processMessages(cachedMessages);
      // Only update if the processed messages are actually different
      if (processed !== currentMessages) {
        setMessages(processed);
      }
    }
  });

  // Set up real-time updates
  createEffect(() => {
    // Set up event listener for real-time message updates
    // Note: We don't need to depend on currentRoom() for event listeners
    const messageCreateHandler = ((event: CustomEvent) => {
      console.log("[ChatArea] messageCreateHandler called with event:", event);
      const { roomId, message } = event.detail;
      console.log(
        "[ChatArea] Event detail - roomId:",
        roomId,
        "params.roomId:",
        params.roomId,
      );
      if (roomId !== params.roomId) {
        console.log("[ChatArea] Ignoring message for different room");
        return;
      }

      console.log("[ChatArea] Received message create event:", message);

      // Clear typing indicator for the message author
      setTypingUsers((prev) => prev.filter((u) => u.id !== message.author_id));

      // Force immediate update for real-time messages to bypass throttling
      const cachedMessages = cache.getMessages(roomId);
      const processed = processMessages(cachedMessages);
      setMessages(processed);

      console.log(
        "[ChatArea] Updated messages immediately for real-time create, count:",
        cachedMessages.length,
      );

      // Scroll to bottom after message update
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    }) as EventListener;

    // Set up event listener for real-time message deletions
    const messageDeleteHandler = ((event: CustomEvent) => {
      const { roomId, messageId } = event.detail;
      if (roomId !== params.roomId) return;

      console.log(
        "[ChatArea] Handling message delete event for message:",
        messageId,
      );

      // Force immediate update for real-time deletions to bypass throttling
      const cachedMessages = cache.getMessages(roomId);
      const processed = processMessages(cachedMessages);
      setMessages(processed);

      console.log(
        "[ChatArea] Updated messages immediately for real-time delete, count:",
        cachedMessages.length,
      );
    }) as EventListener;

    // Set up event listener for real-time message edits
    const messageEditHandler = ((event: CustomEvent) => {
      const { roomId, messageId } = event.detail;
      if (roomId !== params.roomId) return;

      console.log(
        "[ChatArea] Handling message edit event for message:",
        messageId,
      );

      // Force immediate update for real-time edits to bypass throttling
      const cachedMessages = cache.getMessages(roomId);
      const processed = processMessages(cachedMessages);
      setMessages(processed);

      console.log(
        "[ChatArea] Updated messages immediately for real-time edit, count:",
        cachedMessages.length,
      );
    }) as EventListener;
    window.addEventListener("messageCreate", messageCreateHandler);
    window.addEventListener("messageDelete", messageDeleteHandler);
    window.addEventListener("messageEdit", messageEditHandler);

    // Removed redundant message fetching - room change effect handles all initialization

    onCleanup(() => {
      window.removeEventListener("messageCreate", messageCreateHandler);
      window.removeEventListener("messageDelete", messageDeleteHandler);
      window.removeEventListener("messageEdit", messageEditHandler);

      // Clean up timers and flags

      // Clear message cache for this room
      if (params.roomId) {
        messageCache.current.delete(params.roomId);
      }
    });
  });

  // Optimized room change handling with proper cleanup
  createEffect(() => {
    const roomId = params.roomId;
    if (roomId) {
      // Clean up previous room state

      // Reset state for the new room
      setMessages([]);
      setPendingMessages([]); // Clear pending messages when switching rooms
      setError("");
      setHasScrolledUp(false);
      setShouldScrollToBottom(true);
      setHasReachedBeginning(false);
      setHasReachedEnd(false);
      setLoadingOlderPhase("idle");
      setIsLoadingNewer(false);
      setIsNearTop(false);
      setIsNearBottom(true);

      // Check if we already have messages in cache
      const cachedMessages = cache.getMessages(roomId);
      if (cachedMessages.length > 0) {
        // If we have cached messages, use them immediately without loading skeleton
        setLoading(false);
        setMessages(processMessages(cachedMessages));

        // Set hasReachedBeginning based on cached message count and cache state
        const cacheHasReachedBeginning = cache.hasReachedBeginning(roomId);
        setHasReachedBeginning(
          cacheHasReachedBeginning || cachedMessages.length < 50,
        );

        // Set hasReachedEnd based on cache state
        const cacheHasReachedEnd = cache.hasReachedEnd(roomId);
        setHasReachedEnd(cacheHasReachedEnd);

        // Ensure scroll to bottom happens after DOM updates and invite embeds load
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            scrollToBottom();
          });
        });
      } else {
        // Check if we've already fetched this room before (even if it was empty)
        if (initiallyFetchedRooms.current.has(roomId)) {
          // We've already fetched this room and it was empty, so hide loading
          setLoading(false);
          // Set flags for empty room that was previously fetched
          setHasReachedBeginning(true);
          setHasReachedEnd(true);
          // Don't call fetchInitialMessages for already fetched empty rooms
        } else {
          // Show loading skeleton only for rooms that need to fetch messages
          setLoading(true);
          // Fetch messages for the new room
          initiallyFetchedRooms.current.add(roomId);
          fetchInitialMessages(roomId);
          // fetchInitialMessages handles setLoading(false) in its own finally block
        }
      }
    } else {
      // No room selected, hide loading
      setLoading(false);
    }
  });

  // Effect to scroll to bottom when messages change
  createEffect(() => {
    // This will trigger whenever displayMessages() changes
    // Only auto-scroll if we're near the bottom and not editing a message
    // const msgs = displayMessages(); // Track displayMessages changes
    if (shouldScrollToBottom() && chatContainerRef && !editingMessageId()) {
      requestAnimationFrame(() => {
        if (chatContainerRef) {
          chatContainerRef.scrollTop = chatContainerRef.scrollHeight;
        }
      });
    }
  });

  // Optimized fetch older messages with simple height-based scroll preservation
  const fetchOlderMessages = async () => {
    if (
      !params.roomId ||
      loadingOlderPhase() !== "idle" ||
      hasReachedBeginning()
    ) {
      return;
    }

    try {
      setLoadingOlderPhase("loading");

      // Enhanced scroll state capture with anchor message tracking
      const scrollState = chatContainerRef
        ? {
            scrollTop: chatContainerRef.scrollTop,
            scrollHeight: chatContainerRef.scrollHeight,
            clientHeight: chatContainerRef.clientHeight,
            // Find anchor message for precise restoration
            anchorMessage: (() => {
              const messageElements =
                chatContainerRef.querySelectorAll(".message-container");
              for (const element of messageElements) {
                const rect = element.getBoundingClientRect();
                const containerRect = chatContainerRef.getBoundingClientRect();
                if (rect.top >= containerRect.top) {
                  return {
                    id: element.getAttribute("data-message-id"),
                    offsetTop: (element as HTMLElement).offsetTop,
                    distanceFromTop: rect.top - containerRect.top,
                  };
                }
              }
              return null;
            })(),
          }
        : null;

      // Get the oldest message ID for the API request
      const oldestMessageId = cache.getOldestMessageId(params.roomId);

      if (!oldestMessageId) {
        setHasReachedBeginning(true);
        setLoadingOlderPhase("idle");
        return;
      }

      // Fetch older messages
      const response = await fetch(
        `${BASE_URL}/rooms/${params.roomId}/messages?before=${oldestMessageId}&limit=50`,
        {
          headers: {
            "X-Session-Token": localStorage.getItem("sc_token") || "",
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch older messages: ${response.status}`);
      }

      const data = await response.json();
      const fetchedMessages = Array.isArray(data)
        ? data
        : data.messages
          ? data.messages
          : data.success && data.messages
            ? data.messages
            : [];

      // Extract author data from messages and add to user cache (optimized batch processing)
      if (Array.isArray(messages)) {
        const newUsers = new Map();

        // First pass: collect unique authors that aren't already cached
        messages.forEach((message: any) => {
          if (
            message.author &&
            message.author.id &&
            !cache.getUser(message.author.id) &&
            !newUsers.has(message.author.id)
          ) {
            newUsers.set(message.author.id, {
              id: message.author.id,
              username: message.author.username,
              discriminator: message.author.discriminator,
              display_name: message.author.display_name,
              avatar: message.author.avatar,
              banner: message.author.banner,
              presence: message.author.presence,
              flags: message.author.flags,
              about_me: message.author.about_me,
              bio: message.author.bio,
            });
          }
        });

        // Batch add new users to cache
        newUsers.forEach((user) => {
          cache.setUser(user);
        });
      }

      if (fetchedMessages.length === 0) {
        cache.setHasReachedBeginning(params.roomId, true);
        setHasReachedBeginning(true);
      } else {
        // Add messages to cache
        cache.setMessages(params.roomId, fetchedMessages, "older");

        // Update displayed messages with batched DOM updates
        const updatedMessages = processMessages(
          cache.getMessages(params.roomId),
        );

        // Use flushSync to ensure DOM updates are applied immediately
        batch(() => {
          setMessages(updatedMessages);
        });

        // Enhanced scroll restoration with multiple fallback strategies
        if (scrollState && chatContainerRef) {
          // Strategy 1: Use anchor message for pixel-perfect restoration
          if (scrollState.anchorMessage?.id) {
            const anchorElement = chatContainerRef.querySelector(
              `[data-message-id="${scrollState.anchorMessage.id}"]`,
            ) as HTMLElement;
            if (anchorElement) {
              const newOffsetTop = anchorElement.offsetTop;
              const targetScrollTop =
                newOffsetTop - scrollState.anchorMessage.distanceFromTop;
              chatContainerRef.scrollTop = Math.max(0, targetScrollTop);
            } else {
              // Fallback to height-based calculation
              const newScrollHeight = chatContainerRef.scrollHeight;
              const heightIncrease = newScrollHeight - scrollState.scrollHeight;
              chatContainerRef.scrollTop = Math.max(
                0,
                scrollState.scrollTop + heightIncrease,
              );
            }
          } else {
            // Strategy 2: Height-based restoration
            const newScrollHeight = chatContainerRef.scrollHeight;
            const heightIncrease = newScrollHeight - scrollState.scrollHeight;
            chatContainerRef.scrollTop = Math.max(
              0,
              scrollState.scrollTop + heightIncrease,
            );
          }
        }

        // Check if we got fewer messages than requested (reached beginning)
        if (fetchedMessages.length < 50) {
          cache.setHasReachedBeginning(params.roomId, true);
          setHasReachedBeginning(true);
        }
      }
    } catch (err) {
      console.error("Error fetching older messages:", err);
    } finally {
      setLoadingOlderPhase("idle");
    }
  };

  // Simple fetch newer messages
  const fetchNewerMessages = async () => {
    if (!params.roomId || isLoadingNewer() || hasReachedEnd()) {
      return;
    }

    try {
      setIsLoadingNewer(true);

      const newestMessageId = cache.getNewestMessageId(params.roomId);

      if (!newestMessageId) {
        // If we don't have a newest message ID, mark as reached end
        setHasReachedEnd(true);
        return;
      }

      // Fetch newer messages
      const response = await fetch(
        `${BASE_URL}/rooms/${params.roomId}/messages?after=${newestMessageId}&limit=50`,
        {
          headers: {
            "X-Session-Token": localStorage.getItem("sc_token") || "",
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch newer messages: ${response.status}`);
      }

      const data = await response.json();
      const fetchedMessages = Array.isArray(data)
        ? data
        : data.messages
          ? data.messages
          : data.success && data.messages
            ? data.messages
            : [];

      // Extract author data from messages and add to user cache (optimized batch processing)
      if (Array.isArray(fetchedMessages)) {
        const newUsers = new Map();

        // First pass: collect unique authors that aren't already cached
        fetchedMessages.forEach((message: any) => {
          if (
            message.author &&
            message.author.id &&
            !cache.getUser(message.author.id) &&
            !newUsers.has(message.author.id)
          ) {
            newUsers.set(message.author.id, {
              id: message.author.id,
              username: message.author.username,
              discriminator: message.author.discriminator,
              display_name: message.author.display_name,
              avatar: message.author.avatar,
              banner: message.author.banner,
              presence: message.author.presence,
              flags: message.author.flags,
              about_me: message.author.about_me,
              bio: message.author.bio,
            });
          }
        });

        // Batch add new users to cache
        newUsers.forEach((user) => {
          cache.setUser(user);
        });
      }

      if (fetchedMessages.length === 0) {
        // No more newer messages
        cache.setHasReachedEnd(params.roomId, true);
        setHasReachedEnd(true);
      } else {
        // Add messages to cache
        cache.setMessages(params.roomId, fetchedMessages, "newer");

        // Update displayed messages
        const updatedMessages = processMessages(
          cache.getMessages(params.roomId),
        );
        setMessages(updatedMessages);

        // Check if we got fewer messages than requested (reached end)
        if (fetchedMessages.length < 50) {
          cache.setHasReachedEnd(params.roomId, true);
          setHasReachedEnd(true);
        }

        // Maintain scroll position if user was at bottom
        if (isNearBottom()) {
          requestAnimationFrame(() => {
            scrollToBottom();
          });
        }
      }
    } catch (err) {
      console.error("Error fetching newer messages:", err);
    } finally {
      setIsLoadingNewer(false);
    }
  };

  // Fetch initial messages for a room
  const fetchInitialMessages = async (roomId: string) => {
    if (!roomId) return;

    try {
      // Only set loading to true if we don't already know this room is empty
      const cachedMessages = cache.getMessages(roomId);
      if (!cachedMessages || cachedMessages.length > 0) {
        setLoading(true);
      }
      setError("");

      const response = await fetch(`${BASE_URL}/rooms/${roomId}/messages`, {
        headers: {
          "X-Session-Token": localStorage.getItem("sc_token") || "",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.status}`);
      }

      const data = await response.json();

      // Check if the response contains messages directly or in a nested structure
      const messages = Array.isArray(data)
        ? data
        : data.messages
          ? data.messages
          : data.success && data.messages
            ? data.messages
            : [];

      // Extract author data from messages and add to user cache (optimized batch processing)
      if (Array.isArray(messages)) {
        const newUsers = new Map();

        // First pass: collect unique authors that aren't already cached
        messages.forEach((message: any) => {
          if (
            message.author &&
            message.author.id &&
            !cache.getUser(message.author.id) &&
            !newUsers.has(message.author.id)
          ) {
            newUsers.set(message.author.id, {
              id: message.author.id,
              username: message.author.username,
              discriminator: message.author.discriminator,
              display_name: message.author.display_name,
              avatar: message.author.avatar,
              banner: message.author.banner,
              presence: message.author.presence,
              flags: message.author.flags,
              about_me: message.author.about_me,
              bio: message.author.bio,
            });
          }
        });

        // Batch add new users to cache
        newUsers.forEach((user) => {
          cache.setUser(user);
        });
      }

      // Let the room change effect manage loading state
      // Don't set loading to false here to prevent race conditions

      if (messages.length > 0) {
        // Add messages to cache
        cache.setMessages(roomId, messages, "replace");
        setMessages(processMessages(messages));

        // Only set hasReachedBeginning if we got fewer than the limit (50)
        // This indicates there are no older messages
        if (messages.length < 50) {
          setHasReachedBeginning(true);
        } else {
          // Reset the flag to allow fetching older messages
          setHasReachedBeginning(false);
        }

        // For initial load, assume we've reached the end (most recent messages)
        // This prevents unnecessary "after" queries immediately after loading
        setHasReachedEnd(true);
      } else {
        console.log("No messages found or empty response:", data);
        // Don't set an error for empty messages, just show an empty chat
        setMessages([]);
        // Set flags for empty room
        setHasReachedBeginning(true);
        setHasReachedEnd(true);
      }
    } catch (err) {
      console.error("Error fetching messages:", err);
      setError("Failed to load messages. Please try again.");
      setLoading(false);
    } finally {
      // Ensure loading is always set to false when fetchInitialMessages completes
      // This prevents the loading skeleton from getting stuck
      setLoading(false);
      // After initial load, scroll to bottom
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
  };

  // Optimized scroll to bottom with smooth performance
  const scrollToBottom = () => {
    if (!chatContainerRef) return;

    // Enhanced smooth scrolling with momentum preservation
    const scrollToBottomImmediate = () => {
      const { scrollHeight, clientHeight } = chatContainerRef;
      const targetScrollTop = scrollHeight - clientHeight;
      const currentScrollTop = chatContainerRef.scrollTop;

      // Only scroll if we're not already at the bottom
      if (Math.abs(currentScrollTop - targetScrollTop) > 5) {
        // Use transform for smoother animation on supported browsers
        if ("scrollBehavior" in document.documentElement.style) {
          chatContainerRef.scrollTo({
            top: targetScrollTop,
            behavior: "instant",
          });
        } else {
          // Fallback for older browsers
          chatContainerRef.scrollTop = targetScrollTop;
        }
      }
    };

    // Immediate scroll for instant feedback
    scrollToBottomImmediate();

    // Follow-up scroll after DOM updates with better timing
    requestAnimationFrame(() => {
      requestAnimationFrame(scrollToBottomImmediate);
    });

    // Additional scroll after a short delay to account for invite embeds loading
    setTimeout(() => {
      scrollToBottomImmediate();
    }, 100);
  };

  // Ultra-smooth scroll handling with minimal triggers
  // Throttled scroll handler for better performance
  let scrollTimeout: number | null = null;
  let lastScrollTime = 0;

  const handleScroll = (e: Event) => {
    if (!chatContainerRef) return;

    const target = e.target as HTMLDivElement;
    const { scrollTop, scrollHeight, clientHeight } = target;
    const now = Date.now();

    // Immediate position updates for smooth UI
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    const isNearTop = scrollTop < 500; // Increased threshold for smoother loading
    const isAtTop = scrollTop < 50;

    // Update position states immediately
    setIsNearBottom(isAtBottom);
    setIsNearTop(isAtTop);
    setShouldScrollToBottom(isAtBottom);
    setHasScrolledUp(!isAtBottom);

    // Throttle expensive operations
    if (now - lastScrollTime > 16) {
      // ~60fps throttling
      lastScrollTime = now;
      setScrollPosition({ top: scrollTop, height: scrollHeight });

      // Predictive loading - start loading before user reaches threshold
      if (
        isNearTop &&
        !hasReachedBeginning() &&
        loadingOlderPhase() === "idle"
      ) {
        // Use requestIdleCallback for non-blocking loading
        if ("requestIdleCallback" in window) {
          requestIdleCallback(() => fetchOlderMessages(), { timeout: 100 });
        } else {
          setTimeout(() => fetchOlderMessages(), 0);
        }
      }

      // Load newer messages with similar optimization
      if (
        isAtBottom &&
        !hasReachedEnd() &&
        !isLoadingNewer() &&
        hasScrolledUp() &&
        displayMessages().length > 0
      ) {
        if ("requestIdleCallback" in window) {
          requestIdleCallback(() => fetchNewerMessages(), { timeout: 100 });
        } else {
          setTimeout(() => fetchNewerMessages(), 0);
        }
      }
    }

    // Clear any pending scroll timeout
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
    }

    // Debounced scroll end detection
    scrollTimeout = setTimeout(() => {
      // Final scroll position update
      setScrollPosition({ top: scrollTop, height: scrollHeight });
      previouslyScrolledUp.current = hasScrolledUp();
      scrollTimeout = null;
    }, 150) as unknown as number;
  };

  // Check if we're on mobile
  // Reference to the messages container for auto-scrolling
  let chatContainerRef: HTMLDivElement | undefined;

  // Reference to the chat input element
  let chatInputRef: HTMLDivElement | undefined;

  // Auto-focus effect for when the component mounts or room changes
  createEffect(() => {
    const roomId = params.roomId;
    if (roomId && chatInputRef) {
      // Longer delay to ensure all scroll operations are complete
      // The room change effect calls scrollToBottom with multiple requestAnimationFrame
      // and a 100ms setTimeout, so we need to wait longer
      setTimeout(() => {
        if (chatInputRef) {
          console.log('[ChatArea] Auto-focusing chat input for room:', roomId);
          chatInputRef.focus();
          // Ensure the input stays focused by preventing any blur events briefly
          const preventBlur = (e: FocusEvent) => {
            e.preventDefault();
            if (chatInputRef) chatInputRef.focus();
          };
          chatInputRef.addEventListener('blur', preventBlur, { once: true });
          setTimeout(() => {
            chatInputRef?.removeEventListener('blur', preventBlur);
          }, 100);
        }
      }, 200); // Increased delay to 200ms to wait for all scroll operations
    }
  });

  // Function to handle message reply
  const handleReply = (messageId: string) => {
    if (messageId) {
      setReplyingTo((prev) => {
        if (prev.includes(messageId)) {
          return prev.filter((id) => id !== messageId);
        } else {
          return [...prev, messageId];
        }
      });
    }
  };

  // Function to handle message edit
  const handleEdit = (message: CachedMessage) => {
    if (message.id) {
      setEditingMessageId(message.id);
      setEditingRoomId(params.roomId);
      setMessageText(message.content || "");
    }
  };

  // Function to handle message delete
  const handleDelete = (messageId: string) => {
    if (messageId) {
      // Call the API to delete the message
      cache.deleteMessage(params.roomId, messageId);
    }
  };

  // Handle edit message event from Message component
  createEffect(() => {
    const handleEditMessage = (event: CustomEvent) => {
      const { messageId, roomId } = event.detail;
      setEditingMessageId(messageId);
      setEditingRoomId(roomId);
    };

    window.addEventListener("edit-message", handleEditMessage as EventListener);
    onCleanup(() => {
      window.removeEventListener(
        "edit-message",
        handleEditMessage as EventListener,
      );
    });
  });

  // Handle reply to message event from Message component
  createEffect(() => {
    const handleReplyToMessage = (event: CustomEvent) => {
      const { messageId } = event.detail;
      handleReply(messageId);
    };

    window.addEventListener(
      "reply-to-message",
      handleReplyToMessage as EventListener,
    );
    onCleanup(() => {
      window.removeEventListener(
        "reply-to-message",
        handleReplyToMessage as EventListener,
      );
    });
  });

  // Handle typing indicator events
  createEffect(() => {
    const handleTypingIndicator = (event: CustomEvent) => {
      const { roomId, userId } = event.detail;
      const currentRoomId = params.roomId;

      // Only process typing indicators for the current room
      if (roomId !== currentRoomId) return;

      // Don't show typing indicators for the current user
      const currentUserId = user()?.id;
      if (userId === currentUserId) return;

      // Add or update the typing user
      setTypingUsers((prev) => {
        // Remove this user if they're already in the list
        const filtered = prev.filter((u) => u.id !== userId);

        // Add the user with the current timestamp
        return [...filtered, { id: userId, timestamp: Date.now() }];
      });

      // Remove typing indicator after 6 seconds of inactivity
      setTimeout(() => {
        setTypingUsers((prev) =>
          prev.filter(
            (u) => !(u.id === userId && Date.now() - u.timestamp > 6000),
          ),
        );
      }, 6000);
    };

    window.addEventListener(
      "typingIndicator",
      handleTypingIndicator as EventListener,
    );

    onCleanup(() => {
      window.removeEventListener(
        "typingIndicator",
        handleTypingIndicator as EventListener,
      );
    });
  });

  // Handle pending message confirmation events
  createEffect(() => {
    const handlePendingMessageConfirmed = (event: CustomEvent) => {
      const { roomId, nonce, messageId } = event.detail;
      const currentRoomId = params.roomId;

      console.log("[ChatArea] pendingMessageConfirmed event received:", {
        roomId,
        nonce,
        messageId,
        currentRoomId,
      });

      // Only process confirmations for the current room
      if (roomId !== currentRoomId) {
        console.log(
          "[ChatArea] Ignoring pendingMessageConfirmed for different room",
        );
        return;
      }

      const beforeCount = pendingMessages().length;
      // Remove the pending message with matching nonce
      setPendingMessages((prev) => {
        const filtered = prev.filter((msg) => msg.nonce !== nonce);
        console.log(
          "[ChatArea] Removing pending message with nonce:",
          nonce,
          "before:",
          prev.length,
          "after:",
          filtered.length,
        );
        return filtered;
      });
      const afterCount = pendingMessages().length;
      console.log(
        "[ChatArea] Pending messages count changed from",
        beforeCount,
        "to",
        afterCount,
      );
    };

    // Listen for fallback current user message events (when nonce is not available)
    const handleCurrentUserMessageReceived = (event: CustomEvent) => {
      const { roomId, messageId, content, createdAt } = event.detail;
      const currentRoomId = params.roomId;

      console.log("[ChatArea] currentUserMessageReceived event received:", {
        roomId,
        messageId,
        content,
        currentRoomId,
      });

      if (roomId !== currentRoomId) {
        console.log(
          "[ChatArea] Ignoring currentUserMessageReceived for different room",
        );
        return;
      }

      // Add a 2-second delay to give the nonce-based system priority
      setTimeout(() => {
        console.log(
          "[ChatArea] Fallback: Removing pending message by content match after delay:",
          { content, messageId },
        );
        // Remove pending messages that match by content and are recent (within 15 seconds)
        const messageTime = new Date(createdAt).getTime();
        const beforeCount = pendingMessages().length;

        setPendingMessages((prev) =>
          prev.filter((msg) => {
            if (msg.content !== content) return true;

            // Check if the pending message is recent (within 15 seconds of the received message)
            const pendingTime = msg.created_at
              ? new Date(msg.created_at).getTime()
              : Date.now();
            const timeDiff = Math.abs(messageTime - pendingTime);
            const isRecent = timeDiff <= 15000; // 15 seconds

            if (!isRecent) return true; // Keep if not recent

            console.log(
              "[ChatArea] Removing pending message by content and time match:",
              {
                pendingContent: msg.content,
                receivedContent: content,
                timeDiff,
                pendingId: msg.id,
                receivedId: messageId,
              },
            );
            return false; // Remove this pending message
          }),
        );

        const afterCount = pendingMessages().length;
        console.log(
          "[ChatArea] Pending messages count changed from",
          beforeCount,
          "to",
          afterCount,
          "via fallback",
        );
      }, 2000); // 2-second delay
    };

    window.addEventListener(
      "pendingMessageConfirmed",
      handlePendingMessageConfirmed as EventListener,
    );
    window.addEventListener(
      "currentUserMessageReceived",
      handleCurrentUserMessageReceived as EventListener,
    );

    onCleanup(() => {
      window.removeEventListener(
        "pendingMessageConfirmed",
        handlePendingMessageConfirmed as EventListener,
      );
      window.removeEventListener(
        "currentUserMessageReceived",
        handleCurrentUserMessageReceived as EventListener,
      );
    });
  });

  // Set up MutationObserver to monitor chat input content changes
  createEffect(() => {
    if (!chatInputRef) return;

    // Create a MutationObserver to watch for content changes
    const observer = new MutationObserver((_mutations) => {
      // Configure observer to watch for text and node changes
      observer.observe(chatInputRef, {
        childList: true,
        subtree: true,
        characterData: true,
      });

      // Force reflow and empty check
      chatInputRef?.offsetHeight;
      const isEmpty =
        !chatInputRef?.textContent || chatInputRef.textContent.trim() === "";
      chatInputRef.classList.toggle("empty", isEmpty);
      setMessageText(chatInputRef.textContent || "");
    });

    // Start observing the chat input for changes
    observer.observe(chatInputRef, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    // Clean up the observer when component is unmounted
    onCleanup(() => {
      observer.disconnect();
    });
  });

  // Handle sending a message
  const handleSendMessage = async (inputElement: HTMLDivElement) => {
    // If we're in editing mode, handle edit instead
    if (editingMessageId() && editingRoomId()) {
      return handleEditMessage(inputElement);
    }

    const content = messageText().trim();
    const room = currentRoom();
    const currentUser = user();

    // Clear any previous errors
    setError("");

    // Validate message content or attachments
    const currentAttachments = attachments().filter(
      (a) => !a.uploading && !a.error,
    );
    if (!content && currentAttachments.length === 0) return;

    // Validate room and user
    if (!room) {
      setError(t("chat.errors.invalidRoom"));
      return;
    }

    if (!currentUser?.id) {
      setError(t("chat.errors.notAuthenticated"));
      return;
    }

    const nonce = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

    try {
      setSending(true);

      // Remove current user from typing users when sending a message
      if (currentUser?.id) {
        setTypingUsers((prev) => prev.filter((u) => u.id !== currentUser.id));
      }

      // Upload files first if there are any
      let uploadedAttachments: string[] = [];
      if (currentAttachments.length > 0) {
        setUploadingFiles(true);

        for (const attachment of currentAttachments) {
          if (attachment.file) {
            try {
              // Mark this attachment as uploading
              setAttachments((prev) =>
                prev.map((a) =>
                  a.id === attachment.id ? { ...a, uploading: true } : a,
                ),
              );

              const uploadedFile = await uploadFileToNebula(attachment.file);
              uploadedAttachments.push(uploadedFile.id);

              // Update attachment with uploaded data
              setAttachments((prev) =>
                prev.map((a) =>
                  a.id === attachment.id
                    ? {
                        ...a,
                        id: uploadedFile.id,
                        url: uploadedFile.url,
                        uploading: false,
                      }
                    : a,
                ),
              );
            } catch (error) {
              console.error("File upload error:", error);
              setAttachments((prev) =>
                prev.map((a) =>
                  a.id === attachment.id
                    ? { ...a, uploading: false, error: "Upload failed" }
                    : a,
                ),
              );
              throw new Error(`Failed to upload ${attachment.name}`);
            }
          } else if (attachment.id && !attachment.id.startsWith("local-")) {
            // File already uploaded
            uploadedAttachments.push(attachment.id);
          }
        }

        setUploadingFiles(false);
      }

      // Clear unread messages for this room when user sends a message
      // This is the user interaction that should clear the unread state

      // // Create temporary message for optimistic UI update (don't add to cache yet)
      // const tempMessage = {
      //   id: undefined,
      //   content,
      //   author_id: currentUser.id,
      //   created_at: new Date().toISOString(),
      //   nonce,
      //   pending: true,
      //   room_id: room.id,
      //   attachments: currentAttachments.map(a => ({
      //     id: a.id,
      //     name: a.name,
      //     type: a.type,
      //     size: a.size,
      //     url: a.url,
      //     height: a.height,
      //     width: a.width,
      //     user_id: a.user_id
      //   }))
      // };

      // Add to pending messages for immediate UI feedback
      // setPendingMessages(prev => [...prev, tempMessage]);

      // Clear input field immediately for better UX
      inputElement.textContent = "";
      inputElement.classList.add("empty");
      setMessageText("");

      // Reset the lastTypingTime when sending a message
      inputElement.dataset.lastTypingTime = "0";

      // Scroll to bottom after sending a message
      setTimeout(scrollToBottom, 100);
      const messageData = {
        content,
        nonce,
        message_references: replyingTo().length > 0 ? replyingTo() : undefined,
        attachments:
          uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
      };
      const result = await sendMessage(room.id, messageData);

      if (result.success && result.message) {
        // Don't manually remove from pending or add to cache here
        // Let the WebSocket message from AuthProvider handle the update via updateMessageByNonce

        // Clear reply references and attachments after successful send
        setReplyingTo([]);
        // Clean up object URLs before clearing attachments
        attachments().forEach((attachment) => {
          if (attachment.url.startsWith("blob:")) {
            URL.revokeObjectURL(attachment.url);
          }
        });
        setAttachments([]);
      } else {
        // Mark pending message as failed
        const errorMessage = result.error || t("chat.errors.sendFailed");
        setPendingMessages((prev) =>
          prev.map((msg) =>
            msg.nonce === nonce
              ? { ...msg, pending: false, error: errorMessage }
              : msg,
          ),
        );
        setError(errorMessage);

        // displayMessages memo will automatically show the updated pending message

        // Clear reply references on failure
        setReplyingTo([]);
        // Clean up object URLs and clear attachments on failure
        attachments().forEach((attachment) => {
          if (attachment.url.startsWith("blob:")) {
            URL.revokeObjectURL(attachment.url);
          }
        });
        setAttachments([]);
      }
    } catch (err) {
      console.error("Error sending message:", err);
      setError(t("chat.errors.sendFailed"));

      // Remove failed message from pending
      setPendingMessages((prev) => prev.filter((msg) => msg.nonce !== nonce));

      // Clear reply references and attachments on exception
      setReplyingTo([]);
      // Clean up object URLs before clearing attachments
      attachments().forEach((attachment) => {
        if (attachment.url.startsWith("blob:")) {
          URL.revokeObjectURL(attachment.url);
        }
      });
      setAttachments([]);
    } finally {
      setSending(false);
    }
  };

  const handleEditMessage = async (inputElement: HTMLDivElement) => {
    const content = messageText().trim();
    const messageId = editingMessageId();
    const roomId = editingRoomId();

    // Clear any previous errors
    setError("");

    // Validate message content
    if (!content) return;

    // Validate message ID and room ID
    if (!messageId || !roomId) {
      setError(t("chat.errors.invalidEdit"));
      return;
    }

    try {
      setSending(true);

      const result = await editMessage(roomId, messageId, content);

      if (!result.success) {
        setError(result.error || t("chat.errors.editFailed"));
      } else {
        // Clear input field immediately for better UX
        inputElement.textContent = "";
        setMessageText("");

        // Clear editing state
        setEditingMessageId(null);
        setEditingRoomId(null);
      }
    } catch (err) {
      console.error("Error editing message:", err);
      setError(t("chat.errors.editFailed"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div class="flex h-full w-full bg-[var(--background2)] min-w-0">
      <div class="flex-1 flex flex-col h-full min-w-0">
        {/* Messages container */}
        <div
          class={`flex-1 overflow-y-auto flex flex-col py-4 overflow-x-hidden w-full max-w-full relative min-w-0 ${isMobile() ? "mb-4" : ""}`}
          ref={chatContainerRef}
          style={{
            "scroll-behavior": "auto",
            "will-change": "scroll-position",
            contain: "layout style paint",
            transform: "translateZ(0)", // Force hardware acceleration
          }}
          onScroll={handleScroll}
        >
          {/* Messages */}
          <Show when={loading()}>
            <div class="flex-1 flex flex-col justify-end">
              <MessageSkeleton count={8} />
            </div>
          </Show>

          <Show when={!loading()}>
            {/* Loading skeleton for older messages - only show when not in main loading state */}
            <Show when={loadingOlderPhase() === "loading"}>
              <div class="px-4">
                <MessageSkeleton count={3} />
              </div>
            </Show>
            <div class="flex-1 flex flex-col justify-end">
              {/* Show beginning section immediately when we know we've reached it */}
              <Show when={hasReachedBeginning()}>
                <div class="flex items-start gap-4 text-text-secondary select-none px-4 py-5">
                  <Show when={isDirectPM()}>
                    <div class="flex-shrink-0">
                      <div class="w-16 h-16 rounded-full overflow-hidden">
                        <Avatar
                          userId={(() => {
                            const room = currentRoom();
                            if (room?.recipients_data) {
                              const currentUserId = user()?.id;
                              const recipient = room.recipients_data.find(
                                (r: any) => r.id !== currentUserId,
                              );
                              return (
                                recipient?.id ||
                                room.recipients_data[0]?.id ||
                                "default"
                              );
                            }
                            return "default";
                          })()}
                          avatar={(() => {
                            const room = currentRoom();
                            if (room?.recipients_data) {
                              const currentUserId = user()?.id;
                              const recipient = room.recipients_data.find(
                                (r: any) => r.id !== currentUserId,
                              );
                              return (
                                recipient?.avatar ||
                                room.recipients_data[0]?.avatar
                              );
                            }
                            return undefined;
                          })()}
                          alt="User avatar"
                          size="lg"
                          class="w-full h-full"
                        />
                      </div>
                    </div>
                  </Show>
                  <div class="flex-1">
                    <h2 class="text-2xl font-bold mb-1 text-text-primary select-none">
                      {isDirectPM() ? "@" : ""}
                      {getRoomName()}
                    </h2>
                    <p class="text-sm max-w-md">
                      This is the beginning of your{" "}
                      {isDirectPM()
                        ? "private message history with"
                        : "conversation in"}{" "}
                      {getRoomName()}.
                    </p>
                  </div>
                </div>
              </Show>
              <Show when={displayMessages().length > 0}>
                <Key each={groupedMessages()} by={(group) => group.date.getTime()}>
                  {(group) => (
                    <>
                      <DateDivider date={group().date} />
                      <Key each={group().messages} by={(message) => {
                        const messages = group().messages;
                        const currentIndex = messages.findIndex(m => (m.id && m.id === message.id) || (m.nonce && m.nonce === message.nonce));
                        const prevMessage = currentIndex > 0 ? messages[currentIndex - 1] : null;
                        const prevMessageKey = prevMessage ? (prevMessage.id || prevMessage.nonce || prevMessage.author_id) : "none";
                        return `${message.id || message.nonce || ""}-${prevMessageKey}-${currentIndex}`;
                      }}>
                        {(message, index) => {
                          const prevMessage =
                            index() > 0 ? group().messages[index() - 1] : null;
                          const isCompact = Boolean(
                            prevMessage &&
                              prevMessage.author_id === message().author_id &&
                              message().created_at &&
                              prevMessage.created_at &&
                              new Date(message().created_at!).getTime() -
                                new Date(prevMessage.created_at).getTime() <
                                300000,
                          );
                          return (
                            <>
                              {isFirstUnread(message()) && (
                                <UnreadDivider
                                  ref={setupUnreadDividerObserver}
                                />
                              )}
                              <div
                                class="message-container"
                                data-message-id={
                                  message().id || message().nonce || ""
                                }
                              >
                                <Message
                                  id={message().id}
                                  content={message().content}
                                  author_id={message().author_id}
                                  created_at={message().created_at}
                                  edited_at={message().edited_at}
                                  nonce={message().nonce}
                                  pending={message().pending}
                                  error={message().error}
                                  isCompact={isCompact}
                                  message_references={
                                    message().message_references
                                  }
                                  room_id={params.roomId}
                                  editingMessageId={editingMessageId()}
                                  onReply={handleReply}
                                  onEdit={() => handleEdit(message())}
                                  onDelete={() =>
                                    message().id
                                      ? handleDelete(message().id!)
                                      : undefined
                                  }
                                  type={message().type}
                                  system_type={message().system_type}
                                  system_data={message().system_data}
                                  attachments={message().attachments?.map(
                                    (att) => ({
                                      ...att,
                                      height: att.height || 0,
                                      width: att.width || 0,
                                    }),
                                  )}
                                />
                              </div>
                            </>
                          );
                        }}
                      </Key>
                    </>
                  )}
                </Key>
              </Show>
            </div>
          </Show>

          {/* Loading skeleton for newer messages - only show when not in main loading state */}
          <Show when={isLoadingNewer() && !loading()}>
            <div class="px-4">
              <MessageSkeleton count={3} />
            </div>
          </Show>
        </div>
        {/* Message input area */}
        <div
          class={`relative ${isMobile() ? "px-0 pb-0" : "px-4 pb-4"}`}
          style={!isMobile() ? "margin-bottom: 24px;" : ""}
        >
          <Show when={error()}>
            <div class="mb-2 px-4 py-3 bg-red-500/5 text-red-500 rounded-lg text-sm font-medium border border-red-500/10 shadow-sm">
              {error()}
            </div>
          </Show>
          <Show when={replyingTo().length > 0}>
            <div class="mb-2 px-4 py-2 bg-surface bg-opacity-10 rounded-lg text-sm border border-border flex items-center justify-between">
              <div class="flex items-center gap-2 flex-1 overflow-hidden">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4 text-text-secondary flex-shrink-0"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fill-rule="evenodd"
                    d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                    clip-rule="evenodd"
                  />
                </svg>
                <span class="text-text-secondary flex-shrink-0">
                  Replying to{" "}
                </span>
                <div class="flex gap-1 overflow-hidden">
                  {(() => {
                    const uniqueAuthors = new Map();
                    replyingTo().forEach((replyId) => {
                      const replyMessage = displayMessages().find(
                        (m) => m.id === replyId,
                      );
                      if (replyMessage) {
                        const authorId = replyMessage.author_id;
                        if (!uniqueAuthors.has(authorId)) {
                          const replyAuthor = cache.getUser(authorId);
                          uniqueAuthors.set(authorId, replyAuthor);
                        }
                      }
                    });

                    return Array.from(uniqueAuthors.values()).map(
                      (replyAuthor, index) => (
                        <>
                          <span class="font-medium text-text-primary truncate">
                            {replyAuthor?.display_name ||
                              replyAuthor?.username ||
                              "Unknown User"}
                          </span>
                          {index < uniqueAuthors.size - 1 && (
                            <span class="text-text-secondary">,</span>
                          )}
                        </>
                      ),
                    );
                  })()}
                </div>
              </div>
              <button
                onClick={() => setReplyingTo([])}
                class="p-1 hover:bg-surface hover:bg-opacity-20 rounded-full flex-shrink-0"
                title="Cancel replies"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4 text-text-secondary"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fill-rule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </Show>
          {/* Typing indicators for mobile - positioned absolutely */}
          <Show when={isMobile() && typingUsers().length > 0}>
            <div class="absolute -top-12 left-0 right-0 px-4 py-2 text-text-secondary text-sm flex items-center gap-2 bg-[var(--background2)]">
              <div class="flex -space-x-2 mr-1">
                <For each={typingUsers().slice(0, 3)}>
                  {(typingUser) => {
                    const user = cache.getUser(typingUser.id);
                    return (
                      <div class="w-6 h-6 rounded-full bg-primary flex-shrink-0 overflow-hidden border border-background2">
                        <Avatar
                          userId={user?.id || ""}
                          avatar={user?.avatar}
                          alt={user?.display_name || user?.username}
                          class=""
                          size="sm"
                        />
                      </div>
                    );
                  }}
                </For>
              </div>
              <div class="flex-1 truncate">
                {(() => {
                  const users = typingUsers()
                    .slice(0, 3)
                    .map((tu) => {
                      const user = cache.getUser(tu.id);
                      return user?.display_name || user?.username || "Someone";
                    });

                  if (typingUsers().length > 3) {
                    return "Several users are typing...";
                  } else if (users.length === 3) {
                    return `${users[0]}, ${users[1]}, and ${users[2]} are typing...`;
                  } else if (users.length === 2) {
                    return `${users[0]} and ${users[1]} are typing...`;
                  } else {
                    return `${users[0]} is typing...`;
                  }
                })()}
              </div>
              <div class="typing-indicator flex-shrink-0">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </Show>
          {/* File attachments preview */}
          <Show when={attachments().length > 0}>
            <div class="mb-2 p-3 bg-surface bg-opacity-10 rounded-lg border border-border">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-text-primary">
                  Attachments ({attachments().length}/{MAX_ATTACHMENTS})
                </span>
                <button
                  onClick={() => setAttachments([])}
                  class="text-text-secondary hover:text-text-primary text-sm"
                  title="Clear all attachments"
                >
                  Clear all
                </button>
              </div>
              <div class="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
                <For each={attachments()}>
                  {(attachment) => (
                    <div class="flex items-center gap-3 p-2 bg-background1 rounded border border-border">
                      <div class="flex-shrink-0">
                        <Show
                          when={attachment.type.startsWith("image/")}
                          fallback={
                            <div class="w-8 h-8 bg-surface rounded flex items-center justify-center">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-4 w-4 text-text-secondary"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path
                                  fill-rule="evenodd"
                                  d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0v12h8V4H6z"
                                  clip-rule="evenodd"
                                />
                              </svg>
                            </div>
                          }
                        >
                          <img
                            src={attachment.url}
                            alt={attachment.name}
                            class="w-8 h-8 object-cover rounded"
                          />
                        </Show>
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="text-sm font-medium text-text-primary truncate">
                          {attachment.name}
                        </div>
                        <div class="text-xs text-text-secondary">
                          {formatFileSize(attachment.size)}
                          <Show when={attachment.uploading}>
                            <span class="ml-2 text-primary">Uploading...</span>
                          </Show>
                          <Show when={attachment.error}>
                            <span class="ml-2 text-red-500">
                              {attachment.error}
                            </span>
                          </Show>
                        </div>
                      </div>
                      <button
                        onClick={() => removeAttachment(attachment.id)}
                        class="flex-shrink-0 p-1 text-text-secondary hover:text-red-500 transition-colors"
                        title="Remove attachment"
                        disabled={attachment.uploading}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-4 w-4"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fill-rule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clip-rule="evenodd"
                          />
                        </svg>
                      </button>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>
          <div
            class={`bg-[var(--background1)] p-2 flex items-center relative min-w-0 ${isMobile() ? "rounded-none mx-0 px-4" : "rounded-lg"}`}
          >
            {/* File attachment button */}
            <button
              onClick={() => {
                if (fileInputRef()) {
                  fileInputRef()?.click();
                }
              }}
              class="p-2 rounded-full text-text-secondary hover:bg-surface hover:bg-opacity-20 transition-colors flex-shrink-0 mr-1"
              title={t("chat.attachFile") || "Attach file"}
              disabled={sending() || editingMessageId() !== null}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>
            <input
              type="file"
              ref={setFileInputRef}
              class="hidden"
              multiple
              onChange={(e) => {
                const files = e.currentTarget.files;
                if (files && files.length > 0) {
                  handleFileUpload(files);
                }
                // Reset the input to allow selecting the same file again
                e.currentTarget.value = "";
              }}
            />
            <div
              contentEditable
              ref={chatInputRef}
              data-placeholder={`${editingMessageId() ? "Edit message" : `Message ${getRoomName()}`}`}
              class="bg-transparent w-full focus:outline-none text-text-primary min-h-[20px] max-h-[120px] overflow-y-auto whitespace-pre-wrap word-break break-all break-words break-anywhere relative empty:before:content-[attr(data-placeholder)] empty:before:text-text-secondary empty:before:absolute empty:before:left-0 empty:before:top-0 empty:before:pointer-events-none empty:before:transition-opacity empty:before:duration-100 empty:before:ease-in-out flex items-center empty min-w-0 max-w-full"
              onPaste={(e) => {
                e.preventDefault();

                // Check for files first
                const files = e.clipboardData?.files;
                if (files && files.length > 0) {
                  handleFileUpload(files);
                  return;
                }

                const text = e.clipboardData?.getData("text/plain") || "";

                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0) {
                  const range = selection.getRangeAt(0);
                  range.deleteContents();
                  range.insertNode(document.createTextNode(text));

                  range.collapse(false);
                  selection.removeAllRanges();
                  selection.addRange(range);

                  const inputEvent = new Event("input", { bubbles: true });
                  e.currentTarget.dispatchEvent(inputEvent);
                }
              }}
              onInput={(e) => {
                const text = e.currentTarget.textContent || "";
                setMessageText(text);

                // Toggle empty class based on content
                // Check both raw content length and trimmed content to ensure placeholder shows correctly
                if (text.length === 0 || text.trim() === "") {
                  e.currentTarget.classList.add("empty");
                  // Force a reflow to ensure the placeholder appears immediately
                  void e.currentTarget.offsetHeight;
                } else {
                  e.currentTarget.classList.remove("empty");
                }

                // Check for unclosed code blocks and update visual indicator
                const hasUnclosed = hasUnclosedCodeBlock(text);
                updateCodeBlockIndicator(e.currentTarget, hasUnclosed);

                // Emoji autocomplete detection
                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0) {
                  const range = selection.getRangeAt(0);
                  const textNode = range.startContainer;

                  if (textNode.nodeType === Node.TEXT_NODE) {
                    const textContent = textNode.textContent || "";
                    const cursorPosition = range.startOffset;

                    // Look for emoji shortcode pattern (:word) before cursor
                    const beforeCursor = textContent.substring(
                      0,
                      cursorPosition,
                    );
                    const emojiMatch = beforeCursor.match(/:([a-zA-Z_]*)$/);

                    if (emojiMatch) {
                      const query = emojiMatch[1];
                      setEmojiAutocompleteQuery(query);

                      // Calculate position for autocomplete menu - position like reply popup
                      const inputContainer = e.currentTarget
                        .parentElement as HTMLElement;
                      if (inputContainer) {
                        const rect = inputContainer.getBoundingClientRect();
                        // Position above the input container so bottom edge is above input
                        const autocompleteHeight = 250; // Approximate height including padding and content
                        setEmojiAutocompletePosition({
                          top:
                            rect.top + window.scrollY - autocompleteHeight - 15, // Position so bottom is above input with 8px gap
                          left: rect.left + window.scrollX,
                          width: rect.width, // Match the width of the input container
                        });
                      }

                      // Store the range for later replacement
                      const emojiRange = document.createRange();
                      emojiRange.setStart(textNode, emojiMatch.index || 0);
                      emojiRange.setEnd(textNode, cursorPosition);
                      setEmojiAutocompleteRange(emojiRange);

                      setShowEmojiAutocomplete(true);
                    } else {
                      setShowEmojiAutocomplete(false);
                      setEmojiAutocompleteRange(null);
                    }
                  } else {
                    setShowEmojiAutocomplete(false);
                    setEmojiAutocompleteRange(null);
                  }
                }

                // Send typing indicator to backend after second character is typed
                if (
                  text.length >= 2 &&
                  !editingMessageId() &&
                  userSettings().privacy.sendTypingIndicators
                ) {
                  const currentTime = Date.now();
                  const lastTypingTime = e.currentTarget.dataset.lastTypingTime
                    ? parseInt(e.currentTarget.dataset.lastTypingTime)
                    : 0;

                  // Only send typing indicator if 7 seconds have passed since the last one
                  if (currentTime - lastTypingTime > 7000) {
                    const roomId = params.roomId;
                    const currentUserId = user()?.id;

                    if (roomId && currentUserId) {
                      // Send typing indicator via the API
                      sendTypingIndicator(roomId).catch((err) => {
                        console.error(
                          "[ChatArea] Failed to send typing indicator:",
                          err,
                        );
                      });

                      // Update last typing time
                      e.currentTarget.dataset.lastTypingTime =
                        currentTime.toString();
                    }
                  }
                }
              }}
              onKeyDown={(e) => {
                // Handle emoji autocomplete navigation first
                if (showEmojiAutocomplete()) {
                  if (
                    e.key === "ArrowDown" ||
                    e.key === "ArrowUp" ||
                    e.key === "Enter" ||
                    e.key === "Escape"
                  ) {
                    // Let the EmojiAutocomplete component handle these keys
                    return;
                  }
                }

                // Check if we're inside an unclosed code block
                const text = e.currentTarget.textContent || "";
                const isInUnclosedCodeBlock = hasUnclosedCodeBlock(text);

                // Update visual indicator
                updateCodeBlockIndicator(
                  e.currentTarget,
                  isInUnclosedCodeBlock,
                );

                if (e.key === "Enter" && !e.shiftKey) {
                  if (isInUnclosedCodeBlock) {
                    // Inside unclosed code block, insert new line instead of sending
                    e.preventDefault();

                    // Insert a new line at cursor position
                    const selection = window.getSelection();
                    const chatInput = e.currentTarget;
                    if (
                      selection &&
                      selection.rangeCount > 0 &&
                      chatInput.contains(selection.anchorNode)
                    ) {
                      // If selection is within the chat input
                      const range = selection.getRangeAt(0);
                      const newLine = document.createTextNode("\n");
                      range.insertNode(newLine);

                      // Move cursor after the inserted newline
                      range.collapse(false);
                      selection.removeAllRanges();
                      selection.addRange(range);

                      // Trigger input event to update state
                      const inputEvent = new Event("input", { bubbles: true });
                      chatInput.dispatchEvent(inputEvent);
                    }
                  } else {
                    // Not in code block, proceed with normal send
                    e.preventDefault();
                    handleSendMessage(e.currentTarget);
                  }
                } else if (e.key === "Escape" && editingMessageId()) {
                  e.preventDefault();
                  // Cancel editing
                  e.currentTarget.textContent = "";
                  setMessageText("");
                  setEditingMessageId(null);
                  setEditingRoomId(null);
                }
              }}
              aria-disabled={sending()}
              style={{ "pointer-events": sending() ? "none" : "auto" }}
            />
            <div class="flex items-center gap-1">
              {/* Emoji picker button */}
              <button
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setEmojiPickerPosition({
                    top: rect.top - 450, // Position above the button
                    left: rect.left - 320 + rect.width, // Align right edge with button
                  });
                  setShowEmojiPicker(!showEmojiPicker());
                }}
                class="p-2 rounded-full text-text-secondary hover:bg-surface hover:bg-opacity-20 transition-colors flex-shrink-0"
                title={t("chat.emojiPicker") || "Emoji picker"}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fill-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 100-2 1 1 0 000 2zm7-1a1 1 0 11-2 0 1 1 0 012 0zm-.464 5.535a1 1 0 10-1.415-1.414 3 3 0 01-4.242 0 1 1 0 00-1.415 1.414 5 5 0 007.072 0z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>
              <Show when={editingMessageId()}>
                <button
                  onClick={() => {
                    // Add haptic feedback on mobile
                    if (isMobile() && "vibrate" in navigator) {
                      navigator.vibrate(50);
                    }

                    setEditingMessageId(null);
                    setEditingRoomId(null);
                    setMessageText("");
                    const chatInput = document.querySelector(
                      "[data-placeholder]",
                    ) as HTMLDivElement;
                    if (chatInput) {
                      chatInput.textContent = "";
                      chatInput.classList.add("empty");
                      const event = new Event("input", { bubbles: true });
                      chatInput.dispatchEvent(event);
                      chatInput.blur(); // Remove focus to hide keyboard on mobile
                    }
                  }}
                  class="p-2 rounded-full text-red-500 hover:bg-red-500 hover:bg-opacity-20 transition-colors flex-shrink-0"
                  title={t("common.cancel")}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </button>
              </Show>
              <Show
                when={
                  messageText().trim() !== "" ||
                  attachments().length > 0 ||
                  userSettings().appearance.alwaysShowSendButton ||
                  isMobile() ||
                  editingMessageId()
                }
              >
                <button
                  onClick={() => {
                    // Add haptic feedback on mobile
                    if (isMobile() && "vibrate" in navigator) {
                      navigator.vibrate(editingMessageId() ? 75 : 50);
                    }

                    const inputElement = document.querySelector(
                      "[data-placeholder]",
                    ) as HTMLDivElement;
                    if (inputElement) {
                      handleSendMessage(inputElement);
                    }
                  }}
                  disabled={sending()}
                  class="ml-2 p-2 rounded-full bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  title={editingMessageId() ? t("chat.edit") : t("chat.send")}
                >
                  <Show
                    when={!editingMessageId()}
                    fallback={
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    }
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                    </svg>
                  </Show>
                </button>
              </Show>
            </div>
          </div>

          {/* Emoji Picker Portal */}
          <Show when={showEmojiPicker()}>
            <EmojiPicker
              position={emojiPickerPosition()}
              onSelect={(emojiShortcode) => {
                const chatInput = document.querySelector(
                  "[data-placeholder]",
                ) as HTMLDivElement;
                if (chatInput) {
                  // Always focus the input first to ensure consistent behavior
                  chatInput.focus();

                  // Insert emoji shortcode at cursor position
                  const selection = window.getSelection();
                  if (
                    selection &&
                    selection.rangeCount > 0 &&
                    chatInput.contains(selection.anchorNode)
                  ) {
                    // If selection is within the chat input
                    const range = selection.getRangeAt(0);
                    range.deleteContents();
                    range.insertNode(document.createTextNode(emojiShortcode));

                    // Move cursor after the inserted emoji shortcode
                    range.collapse(false);
                    selection.removeAllRanges();
                    selection.addRange(range);
                  } else {
                    // If no valid selection in the input, append to the end
                    chatInput.textContent =
                      (chatInput.textContent || "") + emojiShortcode;

                    // Move cursor to the end
                    const range = document.createRange();
                    const sel = window.getSelection();
                    range.selectNodeContents(chatInput);
                    range.collapse(false);
                    sel?.removeAllRanges();
                    sel?.addRange(range);

                    const inputEvent = new Event("input", { bubbles: true });
                    chatInput.dispatchEvent(inputEvent);
                  }

                  // Remove empty class if needed
                  chatInput.classList.remove("empty");

                  // Trigger input event to update state
                  const inputEvent = new Event("input", { bubbles: true });
                  chatInput.dispatchEvent(inputEvent);
                }
                setShowEmojiPicker(false);
              }}
              onClose={() => setShowEmojiPicker(false)}
            />
          </Show>

          {/* Emoji Autocomplete */}
          <Show when={showEmojiAutocomplete()}>
            <EmojiAutocomplete
              query={emojiAutocompleteQuery()}
              position={emojiAutocompletePosition()}
              onSelect={(shortcode) => {
                const range = emojiAutocompleteRange();
                if (range) {
                  // Replace the :query with the selected emoji shortcode
                  range.deleteContents();
                  range.insertNode(document.createTextNode(`:${shortcode}:`));
                  range.collapse(false);

                  const selection = window.getSelection();
                  if (selection) {
                    selection.removeAllRanges();
                    selection.addRange(range);
                  }

                  // Update the message text state
                  const chatInput = document.querySelector(
                    "[data-placeholder]",
                  ) as HTMLDivElement;
                  if (chatInput) {
                    setMessageText(chatInput.textContent || "");
                    chatInput.focus();

                    // Trigger input event to update state
                    const inputEvent = new Event("input", { bubbles: true });
                    chatInput.dispatchEvent(inputEvent);
                  }
                }

                setShowEmojiAutocomplete(false);
                setEmojiAutocompleteRange(null);
              }}
              onClose={() => {
                setShowEmojiAutocomplete(false);
                setEmojiAutocompleteRange(null);
              }}
            />
          </Show>

          {/* Typing indicators for desktop - positioned below the text input */}
          <Show when={!isMobile() && typingUsers().length > 0}>
            <div class="px-2 py-2 text-text-secondary text-sm flex items-center absolute gap-2">
              <div class="flex -space-x-2 mr-1">
                <For each={typingUsers().slice(0, 3)}>
                  {(typingUser) => {
                    const user = cache.getUser(typingUser.id);
                    return (
                      <div class="w-6 h-6 rounded-full bg-primary flex-shrink-0 overflow-hidden border border-background2">
                        <Avatar
                          userId={user?.id || ""}
                          avatar={user?.avatar}
                          alt={user?.display_name || user?.username}
                          class=""
                          size="sm"
                        />
                      </div>
                    );
                  }}
                </For>
              </div>
              <div class="flex-1 truncate">
                {(() => {
                  const users = typingUsers()
                    .slice(0, 3)
                    .map((tu) => {
                      const user = cache.getUser(tu.id);
                      return user?.display_name || user?.username || "Someone";
                    });

                  if (typingUsers().length > 3) {
                    return "Several users are typing...";
                  } else if (users.length === 3) {
                    return `${users[0]}, ${users[1]}, and ${users[2]} are typing...`;
                  } else if (users.length === 2) {
                    return `${users[0]} and ${users[1]} are typing...`;
                  } else {
                    return `${users[0]} is typing...`;
                  }
                })()}
              </div>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
};

export default ChatArea;