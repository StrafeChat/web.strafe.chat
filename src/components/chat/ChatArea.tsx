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
  const { user, rooms, sendMessage, editMessage } = useAuth();
  const cache = useCache();
  const [t] = useTransContext();
  const [messageText, setMessageText] = createSignal("");
  const [sending, setSending] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");
  const [messages, setMessages] = createSignal<CachedMessage[]>([]);
  const [replyingTo, setReplyingTo] = createSignal<string[]>([]);
  const [editingMessageId, setEditingMessageId] = createSignal<string | null>(null);
  const [editingRoomId, setEditingRoomId] = createSignal<string | null>(null);
  // Reference to the messages container for auto-scrolling
  let messagesContainerRef: HTMLDivElement | undefined;

  // Handle edit message event from Message component
  createEffect(() => {
    const handleEditMessage = (event: CustomEvent) => {
      const { messageId, roomId, content } = event.detail;
      setEditingMessageId(messageId);
      setEditingRoomId(roomId);
      setMessageText(content);
    };

    window.addEventListener('editMessage', handleEditMessage as EventListener);

    onCleanup(() => {
      window.removeEventListener('editMessage', handleEditMessage as EventListener);
    });
  });

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

      setMessages(prev => {
        const updatedMessages = [...prev];
        const existingIndex = updatedMessages.findIndex(m => 
          (message.id && m.id === message.id) || 
          (message.nonce && m.nonce === message.nonce)
        );

        if (existingIndex >= 0) {
          updatedMessages[existingIndex] = {
            ...updatedMessages[existingIndex],
            ...message,
            pending: message.pending ?? updatedMessages[existingIndex].pending
          };
        } else {
          updatedMessages.push(message);
        }

        return processMessages(updatedMessages);
      });

      scrollToBottom();
    }) as EventListener;
    
    // Set up event listener for real-time message deletions
    const messageDeleteHandler = ((event: CustomEvent) => {
      const { roomId, messageId } = event.detail;
      if (roomId !== room.id) return;
      
      console.log("[ChatArea] Handling message delete event for message:", messageId);
      
      // Remove the deleted message from the messages state
      setMessages(prev => {
        const updatedMessages = prev.filter(m => m.id !== messageId);
        return processMessages(updatedMessages);
      });
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
            return { 
              ...m, 
              content: content,
              edited_at: editedAt || new Date().toISOString(),
              author_id: authorId || m.author_id
            };
          }
          return m;
        });
        return processMessages(updatedMessages);
      });
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
                        message_references={message.message_references}
                        room_id={params.roomId}
                        onReply={handleReply}
                      />
                    );
                  }}
                </For>
              </Show>
            </div>
          </Show>
        </div>

        {/* Message input area */}
        <div class="p-4">
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
          <div class="bg-[var(--background1)] rounded-lg p-3 flex items-start">
            <div
              contentEditable
              data-placeholder={`${editingMessageId() ? "Edit message" : `Message ${getRoomName()}`}`}
              class="bg-transparent w-full focus:outline-none text-text-primary min-h-[20px] max-h-[150px] overflow-y-auto whitespace-pre-wrap word-break break-all break-words break-anywhere [&:empty]:before:content-[attr(data-placeholder)] before:text-text-secondary before:absolute before:pointer-events-none relative"
              onInput={(e) => {
                setMessageText(e.currentTarget.textContent || "");
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e.currentTarget);
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatArea;