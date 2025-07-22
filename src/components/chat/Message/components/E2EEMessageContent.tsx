import { Component, createSignal, createEffect, Show } from "solid-js";
import { useE2EE } from "../../../../lib/providers/e2ee/E2EEProvider";
import { useCache } from "../../../../lib/providers/cache/CacheProvider";
import { parseMarkdown } from "../../../../lib/utils/markdownUtils";
import { renderMessageWithEmojis } from "../../../../lib/utils/emojiUtils";
import { RoomType } from "../../../../types/roomTypes";
import { FS_URL } from "../../../../constants";
import { getEmojiByShortcode } from "../../../../lib/data/twemojiData";
import E2EEIndicator from "../../../ui/E2EEIndicator";

interface E2EEMessageContentProps {
  content: string;
  roomId: string;
  senderId?: string;
  className?: string;
  showE2EEIndicator?: boolean;
  messageId?: string;
  editedAt?: string;
  onMessageClick?: (event: MouseEvent) => void;
  isCompact?: boolean;
  pending?: boolean;
  error?: string;
  onEmojiClick?: (emoji: { shortcode: string; emoji: { name: string; code: string } }, position: { x: number; y: number }) => void;
}

export const E2EEMessageContent: Component<E2EEMessageContentProps> = (props) => {
  const e2ee = useE2EE();
  const cache = useCache();
  const [decryptedContent, setDecryptedContent] = createSignal<string | null>(null);
  const [isDecrypting, setIsDecrypting] = createSignal(true);
  const [decryptionError, setDecryptionError] = createSignal<string | null>(null);
  const [isEncrypted, setIsEncrypted] = createSignal(false);
  const [emojiData, setEmojiData] = createSignal<any[]>([]);

  createEffect(async () => {
    const content = props.content;
    const roomId = props.roomId;
    const senderId = props.senderId;

    // Check if content is encrypted (starts with E2EE:, SIGNAL:, or SIGNAL_GROUP: prefix)
    if (content.startsWith('E2EE:') || content.startsWith('SIGNAL:') || content.startsWith('SIGNAL_GROUP:')) {
      setIsEncrypted(true);
      setIsDecrypting(true);
      setDecryptionError(null);

      try {
        // Get room information
        const room = cache.getRoom(roomId);
        if (!room) {
          console.warn('[E2EEMessageContent] Room not found in cache:', roomId);
          setDecryptionError("Room not found");
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
        
        // Process emojis for rendering
        const emojiRenderData = renderMessageWithEmojis(decrypted);
        setEmojiData(emojiRenderData);
        
        console.log('[E2EEMessageContent] Message decrypted successfully');
      } catch (error) {
        console.error('[E2EEMessageContent] Failed to decrypt message:', error);
        setDecryptionError("Failed to decrypt message");
      } finally {
        setIsDecrypting(false);
      }
    } else {
      // Not encrypted
      setIsEncrypted(false);
      setDecryptedContent(content);
      setIsDecrypting(false);
      
      // Process emojis for rendering
      const emojiRenderData = renderMessageWithEmojis(content);
      setEmojiData(emojiRenderData);
    }
  });

  const getE2EEStatus = () => {
    if (isDecrypting()) return 'loading';
    if (!e2ee.isE2EEInitialized()) return 'disabled';
    
    const room = cache.getRoom(props.roomId);
    if (!room) return 'disabled';
    
    return e2ee.getE2EEStatusForRoom(room.type, room.recipients);
  };

  // Render emoji-only messages with large emojis
  const renderEmojiOnlyContent = () => {
    const emojis = emojiData();
    if (emojis.length > 0 && emojis.every(item => item.isEmoji && item.isLarge)) {
      return (
        <div class="flex flex-wrap gap-1">
          {emojis.map((emoji, index) => (
              <img
                src={`${FS_URL}/twemoji/${emoji.emojiCode}.svg`}
                alt={emoji.shortcode || ''}
                class="large-emoji"
                style="width: 3rem; height: 3rem; cursor: pointer;"
                onClick={(e) => {
                  if (props.onEmojiClick) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    props.onEmojiClick(
                      {
                        shortcode: emoji.shortcode || '',
                        emoji: { name: emoji.shortcode || '', code: emoji.emojiCode }
                      },
                      { x: rect.left + rect.width / 2, y: rect.top }
                    );
                  }
                }}
              />
            ))}
        </div>
      );
    }
    return null;
  };

  const renderMixedContent = () => {
    const emojis = emojiData();
    if (emojis.length === 0) return null;

    return (
      <div class="flex flex-wrap items-center gap-1">
        {emojis.map((item, index) => {
          if (item.isEmoji) {
            const sizeClass = item.isLarge ? 'w-12 h-12' : 'w-5 h-5';
            return (
              <img
                src={`${FS_URL}/twemoji/${item.emojiCode}.svg`}
                alt={item.shortcode || ''}
                class={`inline-emoji ${sizeClass} cursor-pointer`}
                style="vertical-align: -0.1em; display: inline-block;"
                onClick={(e) => {
                  if (props.onEmojiClick) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    props.onEmojiClick(
                      {
                        shortcode: item.shortcode || '',
                        emoji: { name: item.shortcode || '', code: item.emojiCode }
                      },
                      { x: rect.left + rect.width / 2, y: rect.top }
                    );
                  }
                }}
              />
            );
          } else {
            return <span>{item.text}</span>;
          }
        })}
      </div>
    );
  };

  return (
    <div class={`flex items-center gap-2 overflow-hidden ${props.className || ''}`}>
      <div class="flex-1 min-w-0">
        <Show 
          when={!decryptionError()} 
          fallback={
            <span class="text-red-500 italic">Failed to decrypt: {decryptionError()}</span>
          }
        >
          <div 
            class="text-text-primary max-w-full message-content whitespace-pre-wrap overflow-hidden overflow-wrap-anywhere min-w-0"
            data-edited={props.editedAt ? "true" : undefined}
            style="word-break: break-word; overflow-wrap: break-word; max-width: 100%; min-height: 1.25rem;"
            onClick={props.onMessageClick}
          >
            <Show when={isDecrypting()} fallback={
              <Show 
                when={emojiData().length > 0 && emojiData().every(item => item.isEmoji && item.isLarge)}
                fallback={
                  <span
                    class="markdown-content"
                    innerHTML={parseMarkdown(decryptedContent() || "")}
                  />
                }
              >
                {renderEmojiOnlyContent()}
              </Show>
            }>
              <div class="flex items-center gap-2">
                <div class="w-3 h-3 border-2 border-text-secondary border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
                <span class="text-text-secondary text-sm opacity-70">•••</span>
              </div>
            </Show>
          </div>
        </Show>
      </div>
      <Show when={props.isCompact && props.pending}>
        <span class="text-xs text-text-secondary italic flex-shrink-0">
          (sending...)
        </span>
      </Show>
      <Show when={props.isCompact && props.error}>
        <span class="text-xs text-red-500 flex-shrink-0">{props.error}</span>
      </Show>
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