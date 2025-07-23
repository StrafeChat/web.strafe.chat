import { marked, Tokens } from 'marked';
// import { parseEmojis } from './emojiUtils';
import { getEmojiByShortcode, getTwemojiUrl } from '../data/twemojiData';
import { USER_MENTION_REGEX, ROLE_MENTION_REGEX, ROOM_MENTION_REGEX, EVERYONE_MENTION_REGEX } from './mentions';
import { renderMentionPlaceholders } from './mentionRenderer';
import DOMPurify from 'isomorphic-dompurify';
import hljs from 'highlight.js';
import { initializeCodeBlockCopyButtons, initializeCodeBlockHoverEffects } from './codeBlockUtils';
// Import highlight.js for syntax highlighting

/**
 * Configure marked options for markdown rendering
 */
marked.setOptions({
  breaks: true, // Enable line breaks
  gfm: true, // Enable GitHub Flavored Markdown
});

/**
 * Custom renderer for marked to implement markdown
 */
const renderer = new marked.Renderer();

// Override heading renderer to match style
renderer.heading = function({ tokens, depth }: Tokens.Heading): string {
  // Discord only supports h1, h2, and h3
  const headingLevel = depth > 3 ? 3 : depth;
  // Convert tokens back to text and handle line break markers
  let text = this.parser.parseInline(tokens);
  // Remove any line break markers from headings
  text = text.replace(/{{LINEBREAK}}/g, ' ');
  return `<h${headingLevel} class="markdown-heading markdown-h${headingLevel}">${text}</h${headingLevel}>`;
};

// Override strong (bold) renderer
renderer.strong = function({ tokens }: Tokens.Strong): string {
  return `<strong class="markdown-bold">${this.parser.parseInline(tokens)}</strong>`;
};

// Override em (italic) renderer
renderer.em = function({ tokens }: Tokens.Em): string {
  return `<em class="markdown-italic">${this.parser.parseInline(tokens)}</em>`;
};

// Override strikethrough renderer
renderer.del = function({ tokens }: Tokens.Del): string {
  return `<del class="markdown-strikethrough">${this.parser.parseInline(tokens)}</del>`;
};

// Override link renderer to add click handler for confirmation modal
renderer.link = function({ href, title, tokens }: Tokens.Link): string {
  console.log("Rendering link:", href);
  // Create a standard link without any special click handling
  // The LinkConfirmationHandler component will handle all link clicks
  return `<a href="${href}" class="markdown-link text-primary" ${title ? `title="${title}"` : ''}>${this.parser.parseInline(tokens)}</a>`;
};

// Override code block renderer with syntax highlighting
renderer.code = function({ text, lang }: Tokens.Code): string {
  let highlightedCode = text;
  
  // Apply syntax highlighting if language is specified
  if (lang && hljs.getLanguage(lang)) {
    try {
      highlightedCode = hljs.highlight(text, { language: lang, ignoreIllegals: true }).value;
    } catch (e) {
      console.error('Error highlighting code:', e);
    }
  }
  
  // Add data-language attribute for the language indicator in CSS
  // The copy button will be added via CSS and JavaScript
  return `<pre class="markdown-pre" ${lang ? `data-language="${lang}"` : ''}><code class="markdown-code hljs ${lang ? `language-${lang}` : ''}">${highlightedCode}</code></pre>`;
}

// Override inline code renderer
renderer.codespan = function({ text }: Tokens.Codespan): string {
  return `<code class="markdown-codespan">${text}</code>`;
};

// Override blockquote renderer
renderer.blockquote = function({ tokens }: Tokens.Blockquote): string {
  return `<blockquote class="markdown-blockquote">${this.parser.parseInline(tokens)}</blockquote>`;
};

// Override list renderer
renderer.list = function({ items, ordered }: Tokens.List): string {
  const type = ordered ? 'ol' : 'ul';
  return `<${type} class="markdown-list markdown-${type}">${items.map(item => this.listitem(item)).join('')}</${type}>`;
};

// Override list item renderer
renderer.listitem = function(item: Tokens.ListItem): string {
  return `<li class="markdown-listitem">${item.text}</li>`;
};

// Override paragraph renderer to handle line breaks
renderer.paragraph = function({ tokens }: Tokens.Paragraph): string {
  const content = this.parser.parseInline(tokens);
  // Convert our special line break markers to actual line breaks
  const processedContent = content.replace(/{{LINEBREAK}}/g, '\n');
  return `<p class="markdown-paragraph">${processedContent}</p>`;
};

// Apply the custom renderer
marked.use({ renderer });

/**
 * Process underlines with __text__ syntax
 * This needs to be done as a preprocessing step since marked doesn't natively support this
 */
const processUnderlines = (text: string): string => {
  // Replace __text__ with <span class="markdown-underline">text</span>
  // But be careful not to match already escaped underscores like \__text\__
  // Since we now use {{EMOJI:shortcode}} format, no need to worry about emoji conflicts
  return text.replace(/(?<![\\])__([^_]+?)(?<![\\])__/g, '<span class="markdown-underline">$1</span>');
};

/**
 * Escapes HTML tags in text to display them as plain text
 * @param text The text to escape HTML in
 * @returns Text with HTML tags escaped
 */
const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Process mentions in text and replace them with placeholder components
 * @param text The text to process
 * @returns Text with mentions replaced with component placeholders
 */
const processMentionsForMarkdown = (text: string): string => {
  let processedText = text;
  
  // Process user mentions
  processedText = processedText.replace(USER_MENTION_REGEX, (_match, userId) => {
    return `{{MENTION:USER:${userId}}}`;
  });
  
  // Process role mentions
  processedText = processedText.replace(ROLE_MENTION_REGEX, (_match, roleId) => {
    return `{{MENTION:ROLE:${roleId}}}`;
  });
  
  // Process room mentions
  processedText = processedText.replace(ROOM_MENTION_REGEX, (_match, roomId) => {
    return `{{MENTION:ROOM:${roomId}}}`;
  });
  
  // Process everyone mentions
  processedText = processedText.replace(EVERYONE_MENTION_REGEX, () => {
    return `{{MENTION:EVERYONE}}`;
  });
  
  return processedText;
};

/**
 * Process emojis in text and replace shortcodes with Twemoji images
 * @param text The text to process
 * @returns Text with emoji shortcodes replaced with Twemoji images
 */
const processEmojisForMarkdown = (text: string): string => {
  // Track emoji shortcodes for emoji-only detection
  const shortcodeMatches: string[] = [];
  
  // Use a unique placeholder that won't conflict with markdown syntax
  // Using {{EMOJI:shortcode}} format to avoid any underscore conflicts
  let processedText = text.replace(/:(\w+):/g, (match, shortcode) => {
    const emoji = getEmojiByShortcode(shortcode);
    if (emoji) {
      shortcodeMatches.push(shortcode);
      return `{{EMOJI:${shortcode}}}`;
    }
    return match;
  });
  
  // Check if the text contains only emoji shortcodes (for large emoji display)
  const trimmedText = processedText.trim();
  const emojiOnlyRegex = /^(\{\{EMOJI:\w+\}\}\s*)+$/;
  const isEmojiOnly = emojiOnlyRegex.test(trimmedText) && shortcodeMatches.length > 0;
  
  // Replace emoji placeholders with actual Twemoji images
  processedText = processedText.replace(/\{\{EMOJI:(\w+)\}\}/g, (match, shortcode) => {
    const emoji = getEmojiByShortcode(shortcode);
    if (emoji) {
      const sizeClass = isEmojiOnly && shortcodeMatches.length <= 3 ? 'w-12 h-12' : 'w-5 h-5';
      return `<img src="${getTwemojiUrl(emoji.code)}" alt="${emoji.name}" class="inline-emoji ${sizeClass} cursor-pointer" style="vertical-align: -0.1em; display: inline-block;" loading="lazy" data-emoji-shortcode="${shortcode}" data-emoji-name="${emoji.name}" data-emoji-code="${emoji.code}" />`;
    }
    return match;
  });
  
  return processedText;
};

/**
 * Parses markdown text and returns HTML
 * @param text The markdown text to parse
 * @returns Sanitized HTML with markdown styling
 */
export const parseMarkdown = (text: string): string => {
  if (!text) return '';
  
  // Process mentions BEFORE escaping HTML to avoid escaping mention syntax
  let processedText = processMentionsForMarkdown(text);
  
  // Escape HTML tags after mention processing to display them as plain text
  processedText = escapeHtml(processedText);
  
  // Process emojis after mentions to avoid interference with underline processing
  processedText = processEmojisForMarkdown(processedText);
  
  // Process Discord-style underlines after emojis
  processedText = processUnderlines(processedText);
  
  // Preserve original line breaks and spacing
  // First, handle headings specially - don't add line break markers to heading lines
  const lines = processedText.split('\n');
  const processedLines = lines.map((line, index) => {
    // Check if this line is a heading (starts with #)
    if (line.trim().match(/^#{1,6}\s/)) {
      return line; // Keep heading lines as-is
    }
    // For non-heading lines, check if we need to add line break marker
    const nextLine = lines[index + 1];
    if (nextLine !== undefined && nextLine.trim() !== '') {
      return line + '{{LINEBREAK}}';
    }
    return line;
  });
  processedText = processedLines.join('\n');
  // Keep double line breaks for paragraph separation
  processedText = processedText.replace(/\n\s*\n/g, '\n\n');
  
  // Parse markdown
  const parsedHtml = marked.parse(processedText);
  
  // Sanitize the HTML to prevent XSS attacks
  let sanitizedHtml = DOMPurify.sanitize(parsedHtml.toString(), {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'a', 'p', 'br', 'strong', 'em', 'del', 'span',
      'pre', 'code', 'blockquote', 'ul', 'ol', 'li', 'img', 'button'
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'class', 'title', 'src', 'alt',
      'aria-label', 'data-language', 'style', 'loading', 'data-emoji-shortcode', 'data-emoji-name', 'data-emoji-code',
      'data-mention-type', 'data-mention-id'
    ],
    ALLOW_DATA_ATTR: true
  });
  
  // Replace mention placeholders with rendered HTML components
  sanitizedHtml = renderMentionPlaceholders(sanitizedHtml);
  
  // Convert any remaining line break markers to actual newlines
  sanitizedHtml = sanitizedHtml.replace(/{{LINEBREAK}}/g, '\n');
  
  // Initialize code block utilities in the next tick to ensure DOM is updated
  setTimeout(() => {
    initializeCodeBlockCopyButtons();
    initializeCodeBlockHoverEffects();
  }, 0);
  
  return sanitizedHtml;
};

/**
 * Checks if the text contains any markdown formatting
 * @param text The text to check
 * @returns True if the text contains markdown formatting
 */
export const containsMarkdown = (text: string): boolean => {
  if (!text) return false;
  
  // Check for common markdown patterns
  const markdownPatterns = [
    /\*\*(.+?)\*\*/g, // Bold
    /\*(.+?)\*/g, // Italic
    /\_\_(.+?)\_\_/g, // Underline (Discord style)
    /\~\~(.+?)\~\~/g, // Strikethrough
    /\`(.+?)\`/g, // Inline code
    /\`\`\`([\s\S]+?)\`\`\`/g, // Code blocks
    /^\>\s(.+)/gm, // Blockquotes
    /^\#\s(.+)/gm, // h1
    /^\#\#\s(.+)/gm, // h2
    /^\#\#\#\s(.+)/gm, // h3
    /\[(.+?)\]\((.+?)\)/g, // Links
    /^\*\s(.+)/gm, // Unordered list
    /^\d+\.\s(.+)/gm, // Ordered list
  ];
  
  return markdownPatterns.some(pattern => pattern.test(text));
};