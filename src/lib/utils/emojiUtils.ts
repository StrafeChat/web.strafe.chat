// Utility functions for emoji handling

// Map of emoji shortcodes to their Unicode representations
const emojiMap: Record<string, string> = {
  // Smileys & Emotion
  smile: "😄",
  joy: "😂",
  rofl: "🤣",
  heart_eyes: "😍",
  kissing_heart: "😘",
  wink: "😉",
  thinking: "🤔",
  unamused: "😒",
  sweat: "😓",
  weary: "😩",
  sob: "😭",
  angry: "😠",
  rage: "😡",
  sunglasses: "😎",
  innocent: "😇",
  
  // People & Body
  wave: "👋",
  thumbsup: "👍",
  thumbsdown: "👎",
  clap: "👏",
  pray: "🙏",
  muscle: "💪",
  point_up: "☝️",
  point_down: "👇",
  ok_hand: "👌",
  v: "✌️",
  raised_hands: "🙌",
  eyes: "👀",
  heart: "❤️",
  fire: "🔥",
  "100": "💯",
  
  // Animals & Nature
  dog: "🐶",
  cat: "🐱",
  fox: "🦊",
  panda: "🐼",
  bear: "🐻",
  tiger: "🐯",
  monkey: "🐵",
  unicorn: "🦄",
  chicken: "🐔",
  penguin: "🐧",
  frog: "🐸",
  snake: "🐍",
  whale: "🐳",
  octopus: "🐙",
  butterfly: "🦋",
  
  // Food & Drink
  pizza: "🍕",
  burger: "🍔",
  fries: "🍟",
  hotdog: "🌭",
  taco: "🌮",
  sushi: "🍣",
  ice_cream: "🍦",
  cake: "🍰",
  cookie: "🍪",
  coffee: "☕",
  beer: "🍺",
  wine: "🍷",
  cocktail: "🍸",
  apple: "🍎",
  banana: "🍌",
  
  // Objects
  gift: "🎁",
  trophy: "🏆",
  camera: "📷",
  computer: "💻",
  phone: "📱",
  tv: "📺",
  bulb: "💡",
  book: "📚",
  money: "💰",
  gem: "💎",
  lock: "🔒",
  key: "🔑",
  hammer: "🔨",
  bomb: "💣",
  pill: "💊",
};

/**
 * Parses a message string and replaces emoji shortcodes with their Unicode representations
 * @param message The message text to parse
 * @returns The parsed message with emoji shortcodes replaced
 */
export const parseEmojis = (message: string): string => {
  // Replace all :emoji_name: patterns with their Unicode equivalents
  return message.replace(/:([\w_]+):/g, (match, emojiName) => {
    return emojiMap[emojiName] || match; // Return the emoji or the original text if not found
  });
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
  const emojiRegex = /^(?:\p{Emoji}\p{Emoji_Modifier}*|\p{Emoji_Presentation}|\p{Emoji}\u{FE0F})$/u;
  return emojiRegex.test(parsedMessage.trim());
};

/**
 * Renders message content with emojis properly sized
 * @param message The message to render
 * @returns An array of message parts with class names for styling
 */
export const renderMessageWithEmojis = (message: string): { text: string; isEmoji: boolean; isLarge: boolean }[] => {
  const parsedMessage = parseEmojis(message);
  
  // Check if the message contains only emojis
  const emojiRegex = /^(?:\p{Emoji}\p{Emoji_Modifier}*|\p{Emoji_Presentation}|\p{Emoji}\u{FE0F})+$/u;
  const isEmojiOnly = emojiRegex.test(parsedMessage.trim());
  
  if (isEmojiOnly) {
    // Split the message into individual emojis
    const emojis = Array.from(parsedMessage.matchAll(/(?:\p{Emoji}\p{Emoji_Modifier}*|\p{Emoji_Presentation}|\p{Emoji}\u{FE0F})/gu));
    return emojis.map(emoji => ({ text: emoji[0], isEmoji: true, isLarge: true }));
  }
  
  // For messages with text and emojis, parse and return all parts
  const parts = parsedMessage.split(/((?:\p{Emoji}\p{Emoji_Modifier}*|\p{Emoji_Presentation}|\p{Emoji}\u{FE0F}))/u)
    .filter(part => part.length > 0)
    .map(part => ({
      text: part,
      isEmoji: /^(?:\p{Emoji}\p{Emoji_Modifier}*|\p{Emoji_Presentation}|\p{Emoji}\u{FE0F})$/u.test(part),
      isLarge: false
    }));
  
  return parts;
};