import { Component, createMemo, createSignal, Show, For, createEffect, onCleanup } from "solid-js";
import { useParams } from "@solidjs/router";
import { useAuth } from "../../lib/providers/auth/AuthProvider";
import { useCache } from "../../lib/providers/cache/CacheProvider";
import { BASE_URL, FS_URL } from "../../constants";
import { RoomType } from "../../types/roomTypes";
import { useTransContext } from "@mbarzda/solid-i18next";
import Message from "./Message";
import { CachedMessage } from "../../lib/cache/MessageCache";
import DateDivider from "./DateDivider";
import UnreadDivider from "./UnreadDivider";
import { EmojiPicker } from "../shared/EmojiPicker";
import { useUserSettings } from "../../lib/providers/userSettings/UserSettingsProvider";
import { hasUnclosedCodeBlock, updateCodeBlockIndicator } from "../../lib/utils/codeBlockUtils";

const ChatArea: Component = () => {
  const params = useParams();
  const { user, rooms, sendMessage, editMessage, isMobile, sendTypingIndicator, unreadMessages, setUnreadMessages, markMessagesAsRead } = useAuth();
  const cache = useCache();
  const [t] = useTransContext();
  const { userSettings } = useUserSettings();
  const [messageText, setMessageText] = createSignal("");
  const [sending, setSending] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");
  const [messages, setMessages] = createSignal<CachedMessage[]>([]);
  const [replyingTo, setReplyingTo] = createSignal<string[]>([]);
  const [editingMessageId, setEditingMessageId] = createSignal<string | null>(null);
  const [editingRoomId, setEditingRoomId] = createSignal<string | null>(null);
  const [typingUsers, setTypingUsers] = createSignal<{id: string, timestamp: number}[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = createSignal(false);
  const [emojiPickerPosition, setEmojiPickerPosition] = createSignal({ top: 0, left: 0 });
  const [fileInputRef, setFileInputRef] = createSignal<HTMLInputElement>();
  const [showUnreadHeader, setShowUnreadHeader] = createSignal(false);
  // Get unread messages for the current room
  const currentRoomUnreadMessages = createMemo(() => {
    const allUnreads = unreadMessages();
    return allUnreads[params.roomId] || [];
  });

  // Delayed acknowledgment function
  // const delayedAcknowledgment = (roomId: string) => {
  //   // Only proceed if there are unread messages
  //   if (currentRoomUnreadMessages().length === 0) return;
  
  //   // Set a timeout to mark messages as read after 3 seconds
  //   const timeoutId = setTimeout(() => {
  //     markMessagesAsRead(roomId);
  //   }, 3000);
  
  //   // Clean up timeout if component unmounts
  //   onCleanup(() => clearTimeout(timeoutId));
  // };

  // Handle unread header visibility
  const delayedHeaderVisibility = (_roomId: string) => {
    if (currentRoomUnreadMessages().length === 0) return;
    
    setShowUnreadHeader(true);
    
    // Set a timeout to hide the header after 3 seconds
    const timeoutId = setTimeout(() => {
      setShowUnreadHeader(false);
    }, 3000);
    
    // Clean up timeout if component unmounts
    onCleanup(() => clearTimeout(timeoutId));
  };

  // Effect to handle unread messages when they become visible
  createEffect(() => {
    const roomId = params.roomId;
    if (messages().length > 0 && currentRoomUnreadMessages().length > 0) {
      // Mark messages as read immediately
      markMessagesAsRead(roomId);
      // Show the header with delay
      delayedHeaderVisibility(roomId);
    }
  });
  // Check if we're on mobile
  // Reference to the messages container for auto-scrolling
  let messagesContainerRef: HTMLDivElement | undefined;

  // Reference to the chat input element
  let chatInputRef: HTMLDivElement | undefined;

  // Handle edit message event from Message component
  createEffect(() => {
    const handleEditMessage = (event: CustomEvent) => {
      const { messageId, roomId, content } = event.detail;
      setEditingMessageId(messageId);
      setEditingRoomId(roomId);
      setMessageText(content);
    };

    // Handle typing indicator events
    const handleTypingIndicator = (event: CustomEvent) => {
      const { roomId, userId } = event.detail;
      const currentRoomId = params.roomId;
      
      // Only process typing indicators for the current room
      if (roomId !== currentRoomId) return;
      
      // Don't show typing indicators for the current user
      const currentUserId = user()?.id;
      if (userId === currentUserId) return;
      
      // Add or update the typing user
      setTypingUsers(prev => {
        // Remove this user if they're already in the list
        const filtered = prev.filter(u => u.id !== userId);
        
        // Add the user with the current timestamp
        return [...filtered, { id: userId, timestamp: Date.now() }];
      });
      
      // Remove typing indicator after 6 seconds of inactivity
      setTimeout(() => {
        setTypingUsers(prev => prev.filter(u => 
          !(u.id === userId && Date.now() - u.timestamp > 6000)
        ));
      }, 6000);
    };

    window.addEventListener('editMessage', handleEditMessage as EventListener);
    window.addEventListener('typingIndicator', handleTypingIndicator as EventListener);

    onCleanup(() => {
      window.removeEventListener('editMessage', handleEditMessage as EventListener);
      window.removeEventListener('typingIndicator', handleTypingIndicator as EventListener);
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
        characterData: true
      });
      
      // Force reflow and empty check
      chatInputRef?.offsetHeight;
      const isEmpty = !chatInputRef?.textContent || chatInputRef.textContent.trim() === "";
      chatInputRef.classList.toggle('empty', isEmpty);
      setMessageText(chatInputRef.textContent || "");
    });
    
    // Start observing the chat input for changes
    observer.observe(chatInputRef, { 
      childList: true,
      characterData: true,
      subtree: true 
    });
    
    // Clean up the observer when component is unmounted
    onCleanup(() => {
      observer.disconnect();
    });
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
      if (!message.created_at) return;
      
      const messageDate = new Date(message.created_at);
      messageDate.setHours(0, 0, 0, 0);
      
      const existingGroup = groups.find(group => 
        group.date.getTime() === messageDate.getTime()
      );
      
      if (existingGroup) {
        existingGroup.messages.push(message);
      } else {
        groups.push({
          date: messageDate,
          messages: [message]
        });
      }
    });
    
    return groups.sort((a, b) => a.date.getTime() - b.date.getTime());
  };

  // Helper function to deduplicate and sort messages
  const processMessages = (msgs: CachedMessage[]) => {
    // Create a map to store unique messages, prioritizing server IDs over nonces
    const messageMap = new Map<string, CachedMessage>();
    
    // First pass: Process messages with server IDs
    msgs.forEach(msg => {
      if (msg.id) {
        const key = msg.id;
        // Always prefer the most recent version of a message with an ID
        messageMap.set(key, msg);
      }
    });
    
    // Second pass: Process messages with only nonces (pending messages)
    msgs.forEach(msg => {
      if (!msg.id && msg.nonce) {
        const key = msg.nonce;
        // Only add if we don't already have a server version of this message
        const existing = Array.from(messageMap.values()).find(m => m.nonce === msg.nonce);
        if (!existing) {
          messageMap.set(key, msg);
        }
      }
    });
    
    // Log the processed messages for debugging
    console.log(`[ChatArea] Processed ${messageMap.size} unique messages from ${msgs.length} total`);
    
    // Convert back to array and sort by timestamp
    return Array.from(messageMap.values())
      .filter(msg => !msg.deleted) // Filter out any messages marked as deleted
      .sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        if (dateA === dateB) {
          // If timestamps are equal, prioritize confirmed messages
          if (a.id && !b.id) return 1;
          if (!a.id && b.id) return -1;
          return 0;
        }
        return dateA - dateB;
      });
  };

  // Function to scroll to the bottom of the messages container
  const scrollToBottom = () => {
    if (messagesContainerRef) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        messagesContainerRef.scrollTop = messagesContainerRef.scrollHeight;
      });
    }
  };

  // Get the current room based on the roomId parameter
  const currentRoom = createMemo(() => {
    const allRooms = rooms();
    if (!allRooms) return null;
    
    return allRooms.find(room => room.id === params.roomId);
  });

  // Helper function to get room name for display
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
          return `${recipientNames.slice(0, 3).join(', ')} and ${recipientNames.length - 3} more`;
        } else {
          return recipientNames.join(', ');
        }
      }
      
      // For regular PMs
      if (room.type === RoomType.PM) {
        const currentUserId = user()?.id;
        
        // First check if we have recipients array to find the other user ID
        if (room.recipients && room.recipients.length > 0) {
          // Find the recipient ID that isn't the current user
          const otherRecipientId = room.recipients.find((id) => id !== currentUserId);
          
          if (otherRecipientId) {
            // Try to get user from cache first
            const cachedUser = cache.getUser(otherRecipientId);
            if (cachedUser) {
              return cachedUser.display_name || cachedUser.username;
            }
            
            // If not in cache, look in recipients_data
            const recipientData = room.recipients_data.find((r) => r.id === otherRecipientId);
            if (recipientData) {
              return recipientData.display_name || recipientData.username;
            }
            
            // If we have the ID but no data yet, show loading state
            return "Loading...";
          }
        }
        
        // Fallback to searching recipients_data if recipients array isn't available
        // Find any recipient that isn't the current user, regardless of position in array
        const recipient = room.recipients_data.find((r) => r.id !== currentUserId);
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
      return room.recipients_data[0].display_name || room.recipients_data[0].username;
    }
    
    return "Unknown Chat";
  };

  // Fetch messages and set up real-time updates
  createEffect(() => {
    const room = currentRoom();
    if (!room) {
      setLoading(false);
      return;
    }

    setLoading(true); // Set loading to true at the start of the effect
    
    // Initial load from cache and set up cache monitoring
    const updateFromCache = () => {
      const cachedMessages = cache.getMessages(room.id);
      if (cachedMessages.length > 0) {
        setMessages(processMessages(cachedMessages));
        setLoading(false); // Reset loading state when we have cached messages
        scrollToBottom();
      }
    };

    // Initial load
    updateFromCache();
    
    // Set up event listener for real-time message updates
    const messageCreateHandler = ((event: CustomEvent) => {
      const { roomId, message } = event.detail;
      if (roomId !== room.id) return;

      console.log("[ChatArea] Received message create event:", message);
      
      // Clear typing indicator for the message author
      setTypingUsers(prev => prev.filter(u => u.id !== message.author_id));
      
      setMessages(prev => {
        const updatedMessages = [...prev];
        const existingIndex = updatedMessages.findIndex(m => 
          (message.id && m.id === message.id) || 
          (message.nonce && m.nonce === message.nonce)
        );

        if (existingIndex >= 0) {
          // Update existing message
          updatedMessages[existingIndex] = {
            ...updatedMessages[existingIndex],
            ...message,
            pending: message.pending ?? updatedMessages[existingIndex].pending
          };
          console.log("[ChatArea] Updated existing message:", updatedMessages[existingIndex]);
        } else {
          // Add new message
          updatedMessages.push(message);
          console.log("[ChatArea] Added new message:", message);
        }

        // Process and return updated messages
        const processed = processMessages(updatedMessages);
        console.log("[ChatArea] Processed messages count:", processed.length);
        return processed;
      });

      // Scroll to bottom after message update
      setTimeout(scrollToBottom, 50);
    }) as EventListener;
    
    // Set up event listener for real-time message deletions
    const messageDeleteHandler = ((event: CustomEvent) => {
      const { roomId, messageId } = event.detail;
      if (roomId !== room.id) return;
      
      console.log("[ChatArea] Handling message delete event for message:", messageId);
      
      // Remove the deleted message from the messages state
      setMessages(prev => {
        // Filter out the deleted message
        const updatedMessages = prev.filter(m => m.id !== messageId);
        console.log("[ChatArea] Removed message with ID:", messageId);
        console.log("[ChatArea] Messages count after deletion:", updatedMessages.length);
        
        // Process and return updated messages
        const processed = processMessages(updatedMessages);
        return processed;
      });
      
      // Force a refresh from cache after a short delay
      setTimeout(() => {
        const cachedMessages = cache.getMessages(room.id);
        setMessages(processMessages([...cachedMessages]));
      }, 100);
    }) as EventListener;

    // Set up event listener for real-time message edits
    const messageEditHandler = ((event: CustomEvent) => {
      const { roomId, messageId, content, editedAt, authorId } = event.detail;
      if (roomId !== room.id) return;
      
      console.log("[ChatArea] Handling message edit event for message:", messageId);
      
      // Update the edited message in the messages state
      setMessages(prev => {
        const updatedMessages = prev.map(m => {
          if (m.id === messageId) {
            // Update the message with the edited content and timestamp
            const updatedMessage = { 
              ...m, 
              content: content,
              edited_at: editedAt || new Date().toISOString(),
              author_id: authorId || m.author_id
            };
            console.log("[ChatArea] Updated message content:", updatedMessage);
            return updatedMessage;
          }
          return m;
        });
        
        // Process and return updated messages
        const processed = processMessages(updatedMessages);
        console.log("[ChatArea] Processed edited messages count:", processed.length);
        return processed;
      });
      
      // Force a re-render after a short delay to ensure UI updates
      setTimeout(() => {
        const cachedMessages = cache.getMessages(room.id);
        if (cachedMessages.length > 0) {
          setMessages(processMessages([...cachedMessages]));
        }
      }, 100);
    }) as EventListener;
    window.addEventListener("messageCreate", messageCreateHandler);
    window.addEventListener("messageDelete", messageDeleteHandler);
    window.addEventListener("messageEdit", messageEditHandler);
    // Fetch messages from API if cache is empty
    const cachedMessages = cache.getMessages(room.id);
    if (cachedMessages.length === 0) {
      const fetchMessages = async () => {
        try {
          const response = await fetch(`${BASE_URL}/rooms/${room.id}/messages`, {
            headers: {
              'X-Session-Token': localStorage.getItem('sc_token') || ''
            }
          });

          if (!response.ok) throw new Error('Failed to fetch messages');
          const data = await response.json();
          
          const messages = Array.isArray(data) ? data : data.messages;
          if (Array.isArray(messages)) {
            cache.setMessages(room.id, messages);
            setMessages(processMessages(messages));
            scrollToBottom();
          } else {
            console.error('[ChatArea] Unexpected API response format:', data);
            setError(t('chat.errors.fetchFailed'));
          }
        } catch (err) {
          console.error('Error fetching messages:', err);
          setError(t('chat.errors.fetchFailed'));
        } finally {
          setLoading(false); // Always reset loading state after fetch attempt
        }
      };

      fetchMessages();
    }

    onCleanup(() => {
      window.removeEventListener("messageCreate", messageCreateHandler);
      window.removeEventListener("messageDelete", messageDeleteHandler);
      window.removeEventListener("messageEdit", messageEditHandler);
    });
  });

  // Effect to scroll to bottom when messages change
  createEffect(() => {
    // This will trigger whenever messages() changes
    const currentMessages = messages();
    if (currentMessages.length > 0) {
      // Use requestAnimationFrame to ensure smooth scrolling
      requestAnimationFrame(scrollToBottom);
    }
  });

  // Handle sending a message
  const handleReply = (messageId: string) => {
    setReplyingTo(prev => [...prev, messageId]);
  };

  // Handle editing a message (for mobile)  
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
    
    // Validate message content
    if (!content) return;
    
    // Validate room and user
    if (!room) {
      setError(t("chat.errors.invalidRoom"));
      return;
    }

    if (!currentUser?.id) {
      setError(t("chat.errors.notAuthenticated"));
      return;
    }
    
    try {
      setSending(true);
      const nonce = Math.random().toString(36).substring(2, 15);
      
      // Remove current user from typing users when sending a message
      if (currentUser?.id) {
        setTypingUsers(prev => prev.filter(u => u.id !== currentUser.id));
      }
      
      // Clear unread messages for this room when user sends a message
      // This is the user interaction that should clear the unread state
      if (room.id && currentRoomUnreadMessages().length > 0) {
        setUnreadMessages((prev: { [roomId: string]: string[] }) => {
          const newState = { ...prev };
          delete newState[room.id];
          return newState;
        });
      }
      
      // Add temporary message to cache with optimistic update
      const tempMessage = {
        id: undefined,
        content,
        author_id: currentUser.id,
        created_at: new Date().toISOString(),
        nonce,
        pending: true,
        room_id: room.id
      };
    
      // Optimistically add message to cache and update local state
      cache.addMessage(room.id, tempMessage);
      setMessages(prev => processMessages([...prev, tempMessage]));
      
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
        message_references: replyingTo().length > 0 ? replyingTo() : undefined
      };
      const result = await sendMessage(room.id, messageData);
      
      // Clear reply references after sending
      setReplyingTo([]);
      
      if (result.success && result.message) {
        // Remove the temporary message and add the confirmed one
        const updatedMessages = messages().filter(m => m.nonce !== nonce);
        const confirmedMessage = {
          ...result.message,
          id: result.message.id, // Ensure ID is explicitly set
          created_at: result.message.created_at || new Date().toISOString(),
          pending: false,
          error: undefined
        };
        // First update the cache to ensure persistence
        cache.deleteMessage(room.id, nonce); // Delete the temporary message
        cache.addMessage(room.id, confirmedMessage); // Add the confirmed message
        // Then update the local state
        setMessages(processMessages([...updatedMessages, confirmedMessage]));
        
        // Dispatch messageCreate event to update the PM list
        // This ensures the room list is updated when sending messages
        window.dispatchEvent(new CustomEvent("messageCreate", {
          detail: {
            roomId: room.id,
            message: confirmedMessage
          }
        }));
        
        // Dispatch messageCreate event to update the PM list
        // This ensures the room list is updated when sending messages
        window.dispatchEvent(new CustomEvent("messageCreate", {
          detail: {
            roomId: room.id,
            message: confirmedMessage
          }
        }));
      } else {
        // Mark message as failed and show error
        const errorMessage = result.error || t("chat.errors.sendFailed");
        cache.updateMessage(room.id, nonce, { 
          ...tempMessage, 
          created_at: new Date().toISOString(),
          pending: false, 
          error: errorMessage
        });
        setError(errorMessage);
    
        // Refresh messages from cache to show error state
        setMessages(cache.getMessages(room.id));
    
        // Restore message text on failure if user hasn't typed something new
        if (!messageText()) {
          inputElement.textContent = content;
          setMessageText(content);
        }
      }
    } catch (err) {
      console.error("Error sending message:", err);
      setError(t("chat.errors.sendFailed"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div class="flex h-full w-full bg-[var(--background2)]">
      <div class="flex-1 flex flex-col h-full">
        {/* Messages container */}
        <div 
          class="flex-1 overflow-y-auto flex flex-col py-4 scroll-smooth overflow-x-hidden w-full max-w-full"
          ref={messagesContainerRef}
          style={{ "scroll-behavior": "auto" }}
        >
          <Show when={loading()} >
            <div class="flex-1 flex flex-col items-center justify-center text-text-secondary select-none">
              <div class="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
              <p class="text-sm">Loading messages...</p>
            </div>
          </Show>
          <Show when={!loading()}>
            <div class="flex-1 flex flex-col justify-end">
              <Show when={showUnreadHeader()}>
                <UnreadDivider />
              </Show>
              <Show when={messages().length === 0}>
                <div class="flex flex-col items-center justify-center text-text-secondary select-none py-8">
                  <div class="w-20 h-20 mb-5 bg-primary bg-opacity-10 rounded-full flex items-center justify-center">
                    {/* Robot icon */}
                  </div>
                  <h2 class="text-lg font-medium mb-2 text-text-primary select-none">
                    {getRoomName()}
                  </h2>
                  <p class="text-sm max-w-md text-center">
                    This is the beginning of your direct message history with {getRoomName()}.
                  </p>
                </div>
              </Show>
              <Show when={messages().length > 0}>
                <For each={groupMessagesByDate(messages())}>
                  {(group) => (
                    <>
                      <DateDivider date={group.date} />
                      <For each={group.messages}>
                        {(message, index) => {
                          const prevMessage = index() > 0 ? group.messages[index() - 1] : null;
                          const isCompact = Boolean(
                            prevMessage && 
                            prevMessage.author_id === message.author_id && 
                            message.created_at && prevMessage.created_at && 
                            new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime() < 300000
                          );
                          return (
                            <>
                              {isFirstUnread(message) && <UnreadDivider />}
                              <Message
                                id={message.id}
                                content={message.content}
                                author_id={message.author_id}
                                created_at={message.created_at}
                                edited_at={message.edited_at}
                                nonce={message.nonce}
                                pending={message.pending}
                                error={message.error}
                                isCompact={isCompact}
                                message_references={message.message_references}
                                room_id={params.roomId}
                                onReply={handleReply}
                              />
                            </>
                          );
                        }}
                      </For>
                    </>
                  )}
                </For>
              </Show>
            </div>
          </Show>
        </div>

        {/* Message input area */}
        <div class="px-4 pb-4 relative" style={!isMobile() ? "margin-bottom: 24px;" : ""}>
          <Show when={error()}>
            <div class="mb-2 px-4 py-3 bg-red-500/5 text-red-500 rounded-lg text-sm font-medium border border-red-500/10 shadow-sm">
              {error()}
            </div>
          </Show>
          <Show when={replyingTo().length > 0}>
            <div class="mb-2 px-4 py-2 bg-surface bg-opacity-10 rounded-lg text-sm border border-border flex items-center justify-between">
              <div class="flex items-center gap-2 flex-1 overflow-hidden">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-text-secondary flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
                <span class="text-text-secondary flex-shrink-0">Replying to </span>
                <div class="flex gap-1 overflow-hidden">
                  {(() => {
                    const uniqueAuthors = new Map();
                    replyingTo().forEach(replyId => {
                      const replyMessage = messages().find(m => m.id === replyId);
                      if (replyMessage) {
                        const authorId = replyMessage.author_id;
                        if (!uniqueAuthors.has(authorId)) {
                          const replyAuthor = cache.getUser(authorId);
                          uniqueAuthors.set(authorId, replyAuthor);
                        }
                      }
                    });
                    
                    return Array.from(uniqueAuthors.values()).map((replyAuthor, index) => (
                      <>
                        <span class="font-medium text-text-primary truncate">
                          {replyAuthor?.display_name || replyAuthor?.username || "Unknown User"}
                        </span>
                        {index < uniqueAuthors.size - 1 && <span class="text-text-secondary">,</span>}
                      </>
                    ));
                  })()}
                </div>
              </div>
              <button 
                onClick={() => setReplyingTo([])}
                class="p-1 hover:bg-surface hover:bg-opacity-20 rounded-full flex-shrink-0"
                title="Cancel replies"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-text-secondary" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
          </Show>
          {/* Typing indicators for mobile - positioned absolutely */}
          <Show when={isMobile() && typingUsers().length > 0}>
            <div class="absolute -top-8 left-0 right-0 px-3 py-2 text-text-secondary text-sm flex items-center gap-2">
              <div class="flex -space-x-2 mr-1">
                <For each={typingUsers().slice(0, 3)}>
                  {(typingUser) => {
                    const user = cache.getUser(typingUser.id);
                    return (
                      <div class="w-6 h-6 rounded-full bg-primary flex-shrink-0 overflow-hidden border border-background2">
                        {user?.avatar ? (
                          <img 
                            src={`${FS_URL}/avatars/${user.id}/${user.avatar || "favicon.ico"}`} 
                            alt={user.display_name || user.username} 
                            class="w-full h-full object-cover"
                          />
                        ) : (
                          <div class="w-full h-full flex items-center justify-center bg-primary text-white text-xs font-medium">
                            {(user?.display_name || user?.username || "?").charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                    );
                  }}
                </For>
              </div>
              <div class="flex-1 truncate">
                {(() => {
                  const users = typingUsers().slice(0, 3).map(tu => {
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
          <div class="bg-[var(--background1)] rounded-lg p-2 flex items-center relative absolute" style={isMobile() ? "border-radius: 0" : ""}>
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
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clip-rule="evenodd" />
              </svg>
            </button>
            <input
              type="file"
              ref={setFileInputRef}
              class="hidden"
              multiple
              onChange={(e) => {
                // File attachment logic will be implemented in the future
                console.log("Files selected:", e.currentTarget.files);
                // Reset the input to allow selecting the same file again
                e.currentTarget.value = "";
              }}
            />
            <div
              contentEditable
              ref={chatInputRef}
              data-placeholder={`${editingMessageId() ? "Edit message" : `Message ${getRoomName()}`}`}
              class="bg-transparent w-full focus:outline-none text-text-primary min-h-[20px] max-h-[120px] overflow-y-auto whitespace-pre-wrap word-break break-all break-words break-anywhere relative empty:before:content-[attr(data-placeholder)] empty:before:text-text-secondary empty:before:absolute empty:before:left-0 empty:before:top-0 empty:before:pointer-events-none empty:before:transition-opacity empty:before:duration-100 empty:before:ease-in-out flex items-center empty"
              onPaste={(e) => {
                e.preventDefault();
            
                const text = e.clipboardData?.getData('text/plain') || '';

                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0) {
                  const range = selection.getRangeAt(0);
                  range.deleteContents();
                  range.insertNode(document.createTextNode(text));
    
                  range.collapse(false);
                  selection.removeAllRanges();
                  selection.addRange(range);

                  const inputEvent = new Event('input', { bubbles: true });
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
                
                // Send typing indicator to backend after second character is typed
                if (text.length >= 2 && !editingMessageId()) {
                  const currentTime = Date.now();
                  const lastTypingTime = e.currentTarget.dataset.lastTypingTime ? parseInt(e.currentTarget.dataset.lastTypingTime) : 0;
                  
                  // Only send typing indicator if 7 seconds have passed since the last one
                  if (currentTime - lastTypingTime > 7000) {
                    const roomId = params.roomId;
                    const currentUserId = user()?.id;
                    
                    if (roomId && currentUserId) {
                      // Send typing indicator via the API
                      sendTypingIndicator(roomId).catch(err => {
                        console.error("[ChatArea] Failed to send typing indicator:", err);
                      });
                      
                      // Update last typing time
                      e.currentTarget.dataset.lastTypingTime = currentTime.toString();
                    }
                  }
                }
              }}
              onKeyDown={(e) => {
                // Check if we're inside an unclosed code block
                const text = e.currentTarget.textContent || "";
                const isInUnclosedCodeBlock = hasUnclosedCodeBlock(text);
                
                // Update visual indicator
                updateCodeBlockIndicator(e.currentTarget, isInUnclosedCodeBlock);
                
                if (e.key === 'Enter' && !e.shiftKey) {
                  if (isInUnclosedCodeBlock) {
                    // Inside unclosed code block, insert new line instead of sending
                    e.preventDefault();
                    
                    // Insert a new line at cursor position
                    const selection = window.getSelection();
                    if (selection && selection.rangeCount > 0) {
                      const range = selection.getRangeAt(0);
                      const newLine = document.createTextNode("\n");
                      range.insertNode(newLine);
                      
                      // Move cursor after the inserted newline
                      range.setStartAfter(newLine);
                      range.setEndAfter(newLine);
                      selection.removeAllRanges();
                      selection.addRange(range);
                      
                      // Trigger input event to update state
                      const inputEvent = new Event('input', { bubbles: true });
                      e.currentTarget.dispatchEvent(inputEvent);
                    }
                  } else {
                    // Not in code block, proceed with normal send
                    e.preventDefault();
                    handleSendMessage(e.currentTarget);
                  }
                } else if (e.key === 'Escape' && editingMessageId()) {
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
                    left: rect.left - 320 + rect.width // Align right edge with button
                  });
                  setShowEmojiPicker(!showEmojiPicker());
                }}
                class="p-2 rounded-full text-text-secondary hover:bg-surface hover:bg-opacity-20 transition-colors flex-shrink-0"
                title={t("chat.emojiPicker") || "Emoji picker"}
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 100-2 1 1 0 000 2zm7-1a1 1 0 11-2 0 1 1 0 012 0zm-.464 5.535a1 1 0 10-1.415-1.414 3 3 0 01-4.242 0 1 1 0 00-1.415 1.414 5 5 0 007.072 0z" clip-rule="evenodd" />
                </svg>
              </button>
              <Show when={editingMessageId()}>
                <button
                  onClick={() => {
                    setEditingMessageId(null);
                    setEditingRoomId(null);
                    const chatInput = document.querySelector('[data-placeholder]') as HTMLDivElement;
                    if (chatInput) {
                      chatInput.textContent = "";
                      const event = new Event('input', { bubbles: true });
                      chatInput.dispatchEvent(event);
                    }
                  }}
                  class="p-2 rounded-full text-text-secondary hover:bg-surface hover:bg-opacity-20 transition-colors flex-shrink-0"
                  title={t("common.cancel")}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                  </svg>
                </button>
              </Show>
              <Show when={messageText().trim() !== "" || userSettings().appearance.alwaysShowSendButton || isMobile() || editingMessageId()}>
                <button 
                  onClick={() => {
                    const inputElement = document.querySelector('[data-placeholder]') as HTMLDivElement;
                    if (inputElement) {
                      handleSendMessage(inputElement);
                    }
                  }}
                  disabled={sending()}
                  class="ml-2 p-2 rounded-full bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  title={editingMessageId() ? t("chat.edit") : t("chat.send")}
                >
                  <Show when={!editingMessageId()} fallback={
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  }>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
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
                const chatInput = document.querySelector('[data-placeholder]') as HTMLDivElement;
                if (chatInput) {
                  // Always focus the input first to ensure consistent behavior
                  chatInput.focus();
                  
                  // Insert emoji shortcode at cursor position
                  const selection = window.getSelection();
                  if (selection && selection.rangeCount > 0 && chatInput.contains(selection.anchorNode)) {
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
                    chatInput.textContent = (chatInput.textContent || '') + emojiShortcode;
                    
                    // Move cursor to the end
                    const range = document.createRange();
                    const sel = window.getSelection();
                    range.selectNodeContents(chatInput);
                    range.collapse(false);
                    sel?.removeAllRanges();
                    sel?.addRange(range);
                  }
                  
                  // Remove empty class if needed
                  chatInput.classList.remove('empty');
                  
                  // Trigger input event to update state
                  const inputEvent = new Event('input', { bubbles: true });
                  chatInput.dispatchEvent(inputEvent);
                }
                setShowEmojiPicker(false);
              }}
              onClose={() => setShowEmojiPicker(false)}
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
                        {user?.avatar ? (
                          <img 
                            src={`${FS_URL}/avatars/${user.id}/${user.avatar || "favicon.ico"}`} 
                            alt={user.display_name || user.username} 
                            class="w-full h-full object-cover"
                          />
                        ) : (
                          <div class="w-full h-full flex items-center justify-center bg-primary text-white text-xs font-medium">
                            {(user?.display_name || user?.username || "?").charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                    );
                  }}
                </For>
              </div>
              <div class="flex-1 truncate">
                {(() => {
                  const users = typingUsers().slice(0, 3).map(tu => {
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