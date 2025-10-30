// Utility functions for emoji handling
import { emojiMap, getEmojiByShortcode } from "../data/twemojiData";

/**
 * Parses a message string and replaces emoji shortcodes with their Unicode representations
 * @param message The message text to parse
 * @returns The parsed message with emoji shortcodes replaced
 */
export const parseEmojis = (message: string): string => {
  // Replace all :emoji_name: patterns with their Unicode equivalents
  return message.replace(
    /:([\w_]+):/g,
    (match: string, emojiName: string): string => {
      return (emojiMap[emojiName]?.code || match) as string; // Return the emoji code or the original text if not found
    },
  );
};

/**
 * Checks if a message consists of only a single emoji
 * @param message The message to check
 * @returns True if the message is a single emoji, false otherwise
 */
export const isSingleEmoji = (message: string): boolean => {
  // Parse the message first to handle shortcodes
  const parsedMessage = parseEmojis(message);

  // Check if the parsed message is a single emoji
  // This regex matches a single emoji character (including multi-code point emojis)
  const emojiRegex =
    /^(?:\p{Emoji}\p{Emoji_Modifier}*|\p{Emoji_Presentation}|\p{Emoji}\u{FE0F})$/u;
  return emojiRegex.test(parsedMessage.trim());
};

/**
 * Converts a Unicode emoji to its Twemoji code
 * @param emoji The Unicode emoji character
 * @returns The Twemoji code or null if not found
 */
export const unicodeToTwemojiCode = (emoji: string): string | null => {
  // Convert emoji to codepoint(s)
  const codePoints = [];
  for (let i = 0; i < emoji.length; i++) {
    const codePoint = emoji.codePointAt(i);
    if (codePoint) {
      // Convert to lowercase hex
      codePoints.push(codePoint.toString(16).toLowerCase());
      // Skip the next character if it's a surrogate pair
      if (codePoint > 0xffff) {
        i++;
      }
    }
  }

  // For single codepoint emojis, use just the code
  // For multi-codepoint emojis, join with hyphens
  const twemojiCode =
    codePoints.length === 1 ? codePoints[0] : codePoints.join("-");

  // Verify this code exists in our emoji data
  const emojiData = Object.values(emojiMap).find((e) => e.code === twemojiCode);
  return emojiData ? twemojiCode : null;
};

/**
 * Renders message content with emojis properly sized
 * @param message The message to render
 * @returns An array of message parts with class names for styling
 */
export const renderMessageWithEmojis = (
  message: string,
): {
  text?: string;
  isEmoji: boolean;
  isLarge: boolean;
  emojiCode?: string;
  shortcode?: string;
}[] => {
  // First, replace shortcodes with placeholders to track them
  const shortcodeMatches: { shortcode: string; emoji: any; index: number }[] =
    [];
  let processedMessage = message.replace(/:(\w+):/g, (match, shortcode) => {
    const emoji = getEmojiByShortcode(shortcode);
    if (emoji) {
      const placeholder = `__EMOJI_${shortcodeMatches.length}__`;
      shortcodeMatches.push({
        shortcode,
        emoji,
        index: shortcodeMatches.length,
      });
      return placeholder;
    }
    return match;
  });

  // Check if the message contains only emoji placeholders (emoji-only message)
  const emojiOnlyRegex = /^(__EMOJI_\d+__\s*)+$/;
  const isEmojiOnly = emojiOnlyRegex.test(processedMessage.trim());

  if (isEmojiOnly) {
    // Return large emojis for emoji-only messages
    return shortcodeMatches.map(({ emoji, shortcode }) => ({
      isEmoji: true,
      isLarge: true,
      emojiCode: emoji.code,
      shortcode,
    }));
  }

  // For mixed content, split and process each part
  const parts: {
    text?: string;
    isEmoji: boolean;
    isLarge: boolean;
    emojiCode?: string;
    shortcode?: string;
  }[] = [];
  const segments = processedMessage.split(/(__EMOJI_\d+__)/g);

  segments.forEach((segment) => {
    if (segment.match(/^__EMOJI_(\d+)__$/)) {
      const index = parseInt(segment.match(/^__EMOJI_(\d+)__$/)![1]);
      const match = shortcodeMatches[index];
      if (match) {
        parts.push({
          isEmoji: true,
          isLarge: false,
          emojiCode: match.emoji.code,
          shortcode: match.shortcode,
        });
      }
    } else if (segment.length > 0) {
      parts.push({
        text: segment,
        isEmoji: false,
        isLarge: false,
      });
    }
  });

  return parts;
};
