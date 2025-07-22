import { Component, Show, For, createSignal, createEffect } from "solid-js";
import { Avatar } from "../../../common/Avatar";
import { scrollToMessage } from "../utils/message";
import { useE2EE } from "../../../../lib/providers/e2ee/E2EEProvider";
import { useCache } from "../../../../lib/providers/cache/CacheProvider";
import { isE2EEContent } from "../../../../lib/utils/e2eeReplyUtils";

interface MessageRepliesProps {
  refMessages: any[];
  replyMaxWidth: string;
}

// Component for individual reply message with E2EE support
const ReplyMessage: Component<{ refMessage: any; replyMaxWidth: string }> = (props) => {
  const [displayContent, setDisplayContent] = createSignal(props.refMessage.content || "Click to see attachment");
  const [isDecrypting, setIsDecrypting] = createSignal(false);
  const { decryptMessage } = useE2EE();
  const cache = useCache();

  createEffect(async () => {
    const content = props.refMessage.content;
    
    // Check if content is E2EE encrypted
    if (content && isE2EEContent(content)) {
      setIsDecrypting(true);
      setDisplayContent('•••'); // Placeholder during decryption
      
      try {
        const room = cache.getRoom(props.refMessage.room_id);
        if (room) {
          const decryptedContent = await decryptMessage(room.type, props.refMessage.room_id, content, props.refMessage.author_id);
          
          // Check if decryption was successful (content changed from encrypted)
          if (decryptedContent && !decryptedContent.startsWith('E2EE:')) {
            // Truncate decrypted content for reply preview
            const truncated = decryptedContent.length > 100 ? decryptedContent.substring(0, 100) + '...' : decryptedContent;
            setDisplayContent(truncated);
          } else {
            setDisplayContent('[Failed to decrypt]');
          }
        } else {
          // Try to decrypt without room cache - attempt different room types
          console.log('[ReplyMessage] Room not in cache, attempting decryption with different room types');
          let decryptedContent = null;
          
          // Try PM first (most common)
          try {
            decryptedContent = await decryptMessage(0, props.refMessage.room_id, content, props.refMessage.author_id);
            if (decryptedContent && !decryptedContent.startsWith('E2EE:')) {
              const truncated = decryptedContent.length > 100 ? decryptedContent.substring(0, 100) + '...' : decryptedContent;
              setDisplayContent(truncated);
              return;
            }
          } catch (e) {
            console.log('[ReplyMessage] PM decryption failed, trying group types');
          }
          
          // Try GROUP_PM
          try {
            decryptedContent = await decryptMessage(1, props.refMessage.room_id, content, props.refMessage.author_id);
            if (decryptedContent && !decryptedContent.startsWith('E2EE:')) {
              const truncated = decryptedContent.length > 100 ? decryptedContent.substring(0, 100) + '...' : decryptedContent;
              setDisplayContent(truncated);
              return;
            }
          } catch (e) {
            console.log('[ReplyMessage] GROUP_PM decryption failed, trying TEXT_ROOM');
          }
          
          // Try TEXT_ROOM
          try {
            decryptedContent = await decryptMessage(2, props.refMessage.room_id, content, props.refMessage.author_id);
            if (decryptedContent && !decryptedContent.startsWith('E2EE:')) {
              const truncated = decryptedContent.length > 100 ? decryptedContent.substring(0, 100) + '...' : decryptedContent;
              setDisplayContent(truncated);
              return;
            }
          } catch (e) {
            console.log('[ReplyMessage] All decryption attempts failed');
          }
          
          setDisplayContent('[Failed to decrypt]');
        }
      } catch (error) {
        console.error('Failed to decrypt reply content:', error);
        setDisplayContent('[Encrypted message]');
      } finally {
        setIsDecrypting(false);
      }
    } else if (content) {
      // Truncate regular content for reply preview
      const truncated = content.length > 100 ? content.substring(0, 100) + '...' : content;
      setDisplayContent(truncated);
    }
  });

  return (
    <div class="relative">
      <div class="absolute left-[20px] bottom-[-2px] w-7 h-2.5 border-l-2 border-t-2 border-text-secondary opacity-40 rounded-tl-md"></div>
      <div
        class="flex items-center gap-1.5 ml-[42px] px-3 rounded hover:bg-surface hover:bg-opacity-20 cursor-pointer transition-colors overflow-hidden"
        style={{ "max-width": props.replyMaxWidth }}
        onClick={() => scrollToMessage(props.refMessage.id)}
      >
        <Avatar
          userId={props.refMessage.author_id}
          avatar={props.refMessage.avatar}
          alt="Avatar"
          class="flex-shrink-0"
          size="xs"
        />
        <span class="text-xs font-medium text-text-primary flex-shrink-0 max-w-[120px] truncate">
          {props.refMessage.author}
        </span>
        <span class={`text-xs text-text-secondary truncate min-w-0 flex-1 ${isDecrypting() ? 'opacity-50' : 'opacity-80'}`}>
          {displayContent()}
        </span>
      </div>
    </div>
  );
};

export const MessageReplies: Component<MessageRepliesProps> = (props) => {
  return (
    <Show when={props.refMessages.length > 0}>
      <div>
        <For each={props.refMessages}>
          {(refMessage) => (
            <ReplyMessage refMessage={refMessage} replyMaxWidth={props.replyMaxWidth} />
          )}
        </For>
      </div>
    </Show>
  );
};
