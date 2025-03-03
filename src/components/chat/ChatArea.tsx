import { Component, createMemo, createSignal, Show, For, createEffect, onCleanup } from "solid-js";
import { useParams } from "@solidjs/router";
import { useAuth } from "../../lib/providers/auth/AuthProvider";
import { useCache } from "../../lib/providers/cache/CacheProvider";
import { BASE_URL } from "../../constants";
import { RoomType } from "../../types/roomTypes";
import { useTransContext } from "@mbarzda/solid-i18next";
import Message from "./Message";
import { CachedMessage } from "../../lib/cache/MessageCache";

const ChatArea: Component = () => {
  const params = useParams();
  const { user, rooms, sendMessage } = useAuth();
  const cache = useCache();
  const [t] = useTransContext();
  const [messageText, setMessageText] = createSignal("");
  const [sending, setSending] = createSignal(false);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal("");
  const [messages, setMessages] = createSignal<CachedMessage[]>([]);
  // Reference to the messages container for auto-scrolling
  let messagesContainerRef: HTMLDivElement | undefined;

  // Helper function to deduplicate and sort messages
  const processMessages = (msgs: CachedMessage[]) => {
    // Create a map to store unique messages, prioritizing server IDs over nonces
    const messageMap = new Map<string, CachedMessage>();
    
    // Process messages in reverse chronological order to ensure newer versions take precedence
    [...msgs].reverse().forEach(msg => {
      const key = msg.id || msg.nonce;
      if (!key) return;

      // If we already have this message (by ID or nonce), only update if the new one is confirmed
      const existing = messageMap.get(key);
      if (existing) {
        // Server messages (with ID) take precedence over pending messages
        if (msg.id && !existing.id) {
          messageMap.set(key, msg);
        }
        // For pending messages, keep the existing one to avoid flicker
        if (msg.pending && !existing.pending) {
          return;
        }
      } else {
        messageMap.set(key, msg);
      }
    });

    // Convert back to array and sort by timestamp
    return Array.from(messageMap.values()).sort((a, b) => {
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
      }
      
      // Fallback to first recipient if we can't find a non-current user
      return room.recipients_data[0].display_name || room.recipients_data[0].username;
    }
    
    return "Unknown Chat";
  };

  // Fetch messages and set up real-time updates
  createEffect(() => {
    const room = currentRoom();
    if (!room) return;
    setLoading(true)
    // Initial load from cache
    const cachedMessages = cache.getMessages(room.id);
    setMessages(processMessages(cachedMessages));
    
    // Scroll to bottom immediately after setting messages
    scrollToBottom();

    // Set up event listener for real-time message updates
    const messageCreateHandler = ((event: CustomEvent) => {
      const { roomId, message } = event.detail;
      if (roomId !== room.id) return;

      setMessages(prev => {
        // Create a new array with the existing messages plus the new one
        const updatedMessages = [...prev];
        
        // Try to find an existing message with matching ID or nonce
        const existingIndex = updatedMessages.findIndex(m => 
          (message.id && m.id === message.id) || 
          (message.nonce && m.nonce === message.nonce)
        );

        if (existingIndex >= 0) {
          // Update existing message
          updatedMessages[existingIndex] = {
            ...updatedMessages[existingIndex],
            ...message,
            // Preserve pending state if the new message doesn't have it
            pending: message.pending ?? updatedMessages[existingIndex].pending
          };
        } else {
          // Add new message
          updatedMessages.push(message);
        }

        // Process the updated messages to ensure proper ordering and deduplication
        return processMessages(updatedMessages);
      });

      // Scroll to bottom immediately for new messages
      scrollToBottom();
    }) as EventListener;

    window.addEventListener("messageCreate", messageCreateHandler);

    // Fetch messages from API if cache is empty
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
          
          // Store messages in the global cache
          const messages = Array.isArray(data) ? data : data.messages;
          if (Array.isArray(messages)) {
            cache.setMessages(room.id, messages);
            setMessages(processMessages(messages));
            // Scroll to bottom immediately after setting messages
            scrollToBottom();
          } else {
            console.error('[ChatArea] Unexpected API response format:', data);
          }
        } catch (err) {
          console.error('Error fetching messages:', err);
          setError(t('chat.errors.fetchFailed'));
        }
      };

      fetchMessages();
    }

    // Clean up event listener
    onCleanup(() => {
      window.removeEventListener("messageCreate", messageCreateHandler);
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
  const handleSendMessage = async (inputElement: HTMLDivElement) => {
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
      setMessageText("");
      
      // Scroll to bottom after sending a message
      setTimeout(scrollToBottom, 100);
      
      const result = await sendMessage(room.id, content, nonce);
      
      if (result.success && result.message) {
        // Remove the temporary message and add the confirmed one
        const updatedMessages = messages().filter(m => m.nonce !== nonce);
        const confirmedMessage = {
          ...result.message,
          created_at: result.message.created_at || new Date().toISOString(),
          pending: false,
          error: undefined
        };
        // First update the cache to ensure persistence
        cache.deleteMessage(room.id, nonce); // Delete the temporary message
        cache.addMessage(room.id, confirmedMessage); // Add the confirmed message
        // Then update the local state
        setMessages(processMessages([...updatedMessages, confirmedMessage]));
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
    <div class="flex h-full bg-[var(--background2)] pb-[env(safe-area-inset-bottom)]">
      <div class="flex-1 flex flex-col h-full">
        {/* Messages container */}
        <div 
          class="flex-1 overflow-y-auto flex flex-col p-4 scroll-smooth"
          ref={messagesContainerRef}
          style={{ "scroll-behavior": "auto" }}
        >
          <Show when={loading()} fallback={
            <div class="flex-1 flex flex-col items-center justify-center text-text-secondary select-none">
              <div class="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
              <p class="text-sm">Loading messages...</p>
            </div>
          }>
            <Show when={!loading()}>
              <div class="flex-1 flex flex-col">
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
                <Show when={messages().length > 0}>
                  <For each={messages()}>
                    {(message, index) => {
                      const prevMessage = index() > 0 ? messages()[index() - 1] : null;
                      const isCompact = Boolean(
                        prevMessage && 
                        prevMessage.author_id === message.author_id && 
                        message.created_at && prevMessage.created_at && 
                        new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime() < 300000
                      );
                  
                      return (
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
                        />
                      );
                    }}
                  </For>
                </Show>
              </div>
            </Show>
          </Show>
        </div>

        {/* Message input area */}
        <div class="p-4">
          <Show when={error()}>
            <div class="mb-2 px-4 py-3 bg-red-500/5 text-red-500 rounded-lg text-sm font-medium border border-red-500/10 shadow-sm">
              {error()}
            </div>
          </Show>
          <div class="bg-[var(--background1)] rounded-lg p-3 flex items-center">
            <div
              contentEditable
              data-placeholder={`Message ${getRoomName()}`}
              class="bg-transparent w-full focus:outline-none text-text-primary min-h-[20px] [&:empty]:before:content-[attr(data-placeholder)] before:text-text-secondary before:absolute before:pointer-events-none relative"
              onInput={(e) => {
                setMessageText(e.currentTarget.textContent || "");
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e.currentTarget);
                }
              }}
              aria-disabled={sending()}
              style={{ "pointer-events": sending() ? "none" : "auto" }}
            />
            <button 
              onClick={(e) => handleSendMessage(e.currentTarget.previousElementSibling as HTMLDivElement)}
              disabled={sending()}
              class="ml-2 p-2 rounded-full bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              title={t("chat.send")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatArea;
