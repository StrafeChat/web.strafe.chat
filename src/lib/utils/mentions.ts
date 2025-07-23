export interface MentionData {
  userMentions: string[];
  roleMentions: string[];
  roomMentions: string[];
  everyoneMention: boolean;
}

// Regex patterns for mentions
export const USER_MENTION_REGEX = /<@([a-zA-Z0-9-]+)>/g;
export const ROLE_MENTION_REGEX = /<@&([a-zA-Z0-9-]+)>/g;
export const ROOM_MENTION_REGEX = /<#([a-zA-Z0-9-]+)>/g;
export const EVERYONE_MENTION_REGEX = /@everyone/g;

/**
 * Parse mentions from message content
 */
export function parseMentions(content: string): MentionData {
  const userMentions: string[] = [];
  const roleMentions: string[] = [];
  const roomMentions: string[] = [];
  const everyoneMention = EVERYONE_MENTION_REGEX.test(content);

  // Extract user mentions
  let match;
  while ((match = USER_MENTION_REGEX.exec(content)) !== null) {
    if (!userMentions.includes(match[1])) {
      userMentions.push(match[1]);
    }
  }

  // Reset regex lastIndex
  USER_MENTION_REGEX.lastIndex = 0;

  // Extract role mentions
  while ((match = ROLE_MENTION_REGEX.exec(content)) !== null) {
    if (!roleMentions.includes(match[1])) {
      roleMentions.push(match[1]);
    }
  }

  // Reset regex lastIndex
  ROLE_MENTION_REGEX.lastIndex = 0;

  // Extract room mentions
  while ((match = ROOM_MENTION_REGEX.exec(content)) !== null) {
    if (!roomMentions.includes(match[1])) {
      roomMentions.push(match[1]);
    }
  }

  // Reset regex lastIndex
  ROOM_MENTION_REGEX.lastIndex = 0;

  return {
    userMentions,
    roleMentions,
    roomMentions,
    everyoneMention
  };
}

/**
 * Format a user mention
 */
export function formatUserMention(userId: string): string {
  return `<@${userId}>`;
}

/**
 * Format a role mention
 */
export function formatRoleMention(roleId: string): string {
  return `<@&${roleId}>`;
}

/**
 * Format a room mention
 */
export function formatRoomMention(roomId: string): string {
  return `<#${roomId}>`;
}

/**
 * Format an everyone mention
 */
export function formatEveryoneMention(): string {
  return '@everyone';
}

/**
 * Replace mention patterns in content with formatted mentions
 */
export function formatMentionsInContent(content: string): string {
  return content
    .replace(/@([a-zA-Z0-9_]+)/g, (match, _username) => {
      // This would need to be enhanced to look up actual user IDs
      // For now, just return the original mention
      return match;
    })
    .replace(/@&([a-zA-Z0-9_]+)/g, (match, _roleName) => {
      // This would need to be enhanced to look up actual role IDs
      // For now, just return the original mention
      return match;
    })
    .replace(/#([a-zA-Z0-9_-]+)/g, (match, _roomName) => {
      // This would need to be enhanced to look up actual room IDs
      // For now, just return the original mention
      return match;
    });
}

/**
 * Check if content contains any mentions
 */
export function hasMentions(content: string): boolean {
  return USER_MENTION_REGEX.test(content) || 
         ROLE_MENTION_REGEX.test(content) || 
         ROOM_MENTION_REGEX.test(content) || 
         EVERYONE_MENTION_REGEX.test(content);
}

/**
 * Get mention type from a mention string
 */
export function getMentionType(mention: string): 'user' | 'role' | 'room' | 'everyone' | null {
  if (mention === '@everyone') return 'everyone';
  if (mention.startsWith('<@&') && mention.endsWith('>')) return 'role';
  if (mention.startsWith('<@') && mention.endsWith('>')) return 'user';
  if (mention.startsWith('<#') && mention.endsWith('>')) return 'room';
  return null;
}

/**
 * Extract ID from a formatted mention
 */
export function extractMentionId(mention: string): string | null {
  const userMatch = mention.match(/^<@([a-zA-Z0-9-]+)>$/);
  if (userMatch) return userMatch[1];
  
  const roleMatch = mention.match(/^<@&([a-zA-Z0-9-]+)>$/);
  if (roleMatch) return roleMatch[1];
  
  const roomMatch = mention.match(/^<#([a-zA-Z0-9-]+)>$/);
  if (roomMatch) return roomMatch[1];
  
  return null;
}

/**
 * Convert raw mention input to formatted mention
 */
export function convertToFormattedMention(input: string, type: 'user' | 'role' | 'room' | 'everyone', id?: string): string {
  switch (type) {
    case 'user':
      return id ? formatUserMention(id) : input;
    case 'role':
      return id ? formatRoleMention(id) : input;
    case 'room':
      return id ? formatRoomMention(id) : input;
    case 'everyone':
      return formatEveryoneMention();
    default:
      return input;
  }
}

/**
 * Detect mention pattern at cursor position
 */
export function detectMentionAtCursor(text: string, cursorPosition: number): {
  type: 'user' | 'role' | 'room' | null;
  query: string;
  startPos: number;
  endPos: number;
} | null {
  // Look backwards from cursor to find mention start
  let startPos = cursorPosition;
  while (startPos > 0 && text[startPos - 1] !== ' ' && text[startPos - 1] !== '\n') {
    startPos--;
  }
  
  // Look forwards from cursor to find mention end
  let endPos = cursorPosition;
  while (endPos < text.length && text[endPos] !== ' ' && text[endPos] !== '\n') {
    endPos++;
  }
  
  const mentionText = text.substring(startPos, endPos);
  
  // Check for different mention patterns
  if (mentionText.startsWith('@&')) {
    return {
      type: 'role',
      query: mentionText.substring(2),
      startPos,
      endPos
    };
  } else if (mentionText.startsWith('@')) {
    return {
      type: 'user',
      query: mentionText.substring(1),
      startPos,
      endPos
    };
  } else if (mentionText.startsWith('#')) {
    return {
      type: 'room',
      query: mentionText.substring(1),
      startPos,
      endPos
    };
  }
  
  return null;
}