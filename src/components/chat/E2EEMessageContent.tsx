import { Component, createSignal, createEffect, Show } from "solid-js";
import { useE2EE } from "../../lib/providers/e2ee/E2EEProvider";
import { useAuth } from "../../lib/providers/auth/AuthProvider";
import { useCache } from "../../lib/providers/cache/CacheProvider";
import { RoomType } from "../../types/roomTypes";
import E2EEIndicator from "../ui/E2EEIndicator";

interface E2EEMessageContentProps {
  content: string;
  roomId: string;
  senderId?: string;
  className?: string;
  showE2EEIndicator?: boolean;
  messageId?: string;
  editedAt?: string;
  onMessageClick?: (event: MouseEvent) => void;
}

export const E2EEMessageContent: Component<E2EEMessageContentProps> = (props) => {
  const e2ee = useE2EE();
  const auth = useAuth();
  const cache = useCache();
  const [decryptedContent, setDecryptedContent] = createSignal<string>(props.content);
  const [isDecrypting, setIsDecrypting] = createSignal(false);
  const [isEncrypted, setIsEncrypted] = createSignal(false);

  createEffect(async () => {
    const content = props.content;
    const roomId = props.roomId;
    const senderId = props.senderId;

    // Check if content is encrypted (starts with E2EE: prefix)
    if (content.startsWith('E2EE:')) {
      setIsEncrypted(true);
      setIsDecrypting(true);

      try {
        // Get room information
        const room = cache.getRoom(roomId);
        if (!room) {
          console.warn('[E2EEMessageContent] Room not found in cache:', roomId);
          setDecryptedContent(content);
          setIsDecrypting(false);
          return;
        }

        // Decrypt based on room type
        let decrypted = content;
        if (room.type === RoomType.PM && senderId) {
          // Direct message decryption
          decrypted = await e2ee.decryptMessage(room.type, roomId, content, senderId);
        } else if (room.type === RoomType.GROUP_PM || room.type === RoomType.TEXT_ROOM) {
          // Group message decryption (for both GROUP_PM and TEXT_ROOM)
          decrypted = await e2ee.decryptMessage(room.type, roomId, content);
        }

        setDecryptedContent(decrypted);
        console.log('[E2EEMessageContent] Message decrypted successfully');
      } catch (error) {
        console.error('[E2EEMessageContent] Failed to decrypt message:', error);
        // Show original content if decryption fails
        setDecryptedContent(content);
      } finally {
        setIsDecrypting(false);
      }
    } else {
      // Not encrypted
      setIsEncrypted(false);
      setDecryptedContent(content);
    }
  });

  const getE2EEStatus = () => {
    if (isDecrypting()) return 'loading';
    if (!e2ee.isE2EEInitialized()) return 'disabled';
    
    const room = cache.getRoom(props.roomId);
    if (!room) return 'disabled';
    
    return e2ee.getE2EEStatusForRoom(room.type, room.recipients);
  };

  return (
    <div class={`flex items-center gap-2 overflow-hidden ${props.className || ''}`}>
      <div class="flex-1 min-w-0">
        <Show when={isDecrypting()}>
          <div class="text-gray-500 italic text-sm">
            Decrypting message...
          </div>
        </Show>
        <Show when={!isDecrypting()}>
          <div 
            class="text-text-primary max-w-full message-content whitespace-pre-wrap overflow-hidden overflow-wrap-anywhere min-w-0"
            data-edited={props.editedAt ? "true" : undefined}
            style="word-break: break-word; overflow-wrap: break-word; max-width: 100%;"
            onClick={props.onMessageClick}
          >
            {decryptedContent()}
          </div>
        </Show>
      </div>
      <Show when={props.showE2EEIndicator && (isEncrypted() || e2ee.isE2EEInitialized())}>
        <div class="flex-shrink-0 mt-1">
          <E2EEIndicator 
            status={getE2EEStatus()}
            size="sm"
          />
        </div>
      </Show>
    </div>
  );
};

export default E2EEMessageContent;