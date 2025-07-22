import { useE2EE } from '../providers/e2ee/E2EEProvider';
import { useCache } from '../providers/cache/CacheProvider';

/**
 * Utility function to decrypt E2EE content for display in replies
 * @param content The message content (potentially encrypted)
 * @param senderId The sender's ID
 * @param roomId The room ID
 * @returns Promise<string> The decrypted content or original content if not encrypted
 */
export const decryptReplyContent = async (
  content: string,
  senderId: string,
  roomId: string
): Promise<string> => {
  // If content is not E2EE encrypted, return as-is
  if (!isE2EEContent(content)) {
    return content;
  }

  try {
    // Get E2EE context - note: this needs to be called within a component context
    const { decryptMessage } = useE2EE();
    const cache = useCache();
    
    const room = cache.getRoom(roomId);
    if (!room) {
      return '[Encrypted message]';
    }

    const result = await decryptMessage(parseInt(content), senderId, roomId);
    
    if (result) {
      // Return a truncated version for replies (first 100 characters)
      const decrypted = result;
      return decrypted.length > 100 ? decrypted.substring(0, 100) + '...' : decrypted;
    } else {
      return '[Failed to decrypt]';
    }
  } catch (error) {
    console.error('Failed to decrypt reply content:', error);
    return '[Encrypted message]';
  }
};

/**
 * Check if content is E2EE encrypted
 * @param content The message content
 * @returns boolean
 */
export const isE2EEContent = (content: string): boolean => {
  return content.startsWith('E2EE:') || content.startsWith('SIGNAL:') || content.startsWith('SIGNAL_GROUP:');
};

/**
 * Get display content for replies - handles both encrypted and regular content
 * @param content The message content
 * @returns string The content to display in reply preview
 */
export const getReplyDisplayContent = (content: string): string => {
  if (isE2EEContent(content)) {
    return '[Encrypted message]';
  }
  
  // Truncate regular content for reply preview
  return content.length > 100 ? content.substring(0, 100) + '...' : content;
};