import { marked, Tokens } from 'marked';
import { parseEmojis } from './emojiUtils';
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

// Override heading renderer to mach  style
renderer.heading = function({ tokens, depth }: Tokens.Heading): string {
  // Discord only supports h1, h2, and h3
  const headingLevel = depth > 3 ? 3 : depth;
  // Convert tokens back to text
  const text = this.parser.parseInline(tokens);
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

// Override paragraph renderer
renderer.paragraph = function({ tokens }: Tokens.Paragraph): string {
  return `<p class="markdown-paragraph">${this.parser.parseInline(tokens)}</p>`;
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
  // Using a safer regex approach that works in all browsers
  return text.replace(/(?<![\\])__([^_]+?)(?<![\\])__/g, '<span class="markdown-underline">$1</span>');
};

/**
 * Process emojis in text and wrap them in appropriate spans for styling
 * @param text The text to process
 * @returns Text with emojis wrapped in spans
 */
const processEmojisForMarkdown = (text: string): string => {
  // First convert emoji shortcodes to Unicode
  const textWithEmojis = parseEmojis(text);
  
  // Regular expression to match emoji characters
  // Using a more compatible regex pattern
  const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;
  
  // Check if the text contains only emojis (for large emoji display)
  const trimmedText = textWithEmojis.trim();
  const matches = trimmedText.match(emojiRegex) || [];
  const isEmojiOnly = matches.length > 0 && 
    matches.join('').length === trimmedText.length;
  
  // Replace emojis with spans that have appropriate classes
  return textWithEmojis.replace(emojiRegex, (match) => {
    const sizeClass = isEmojiOnly && matches.length <= 3 ? 'text-3xl' : '';
    return `<span class="inline-block ${sizeClass}">${match}</span>`;
  });
};

/**
 * Parses markdown text and returns HTML
 * @param text The markdown text to parse
 * @returns Sanitized HTML with markdown styling
 */
export const parseMarkdown = (text: string): string => {
  if (!text) return '';
  
  // Process Discord-style underlines first
  let processedText = processUnderlines(text);
  
  // Process emojis next
  processedText = processEmojisForMarkdown(processedText);
  
  // Parse markdown
  const parsedHtml = marked.parse(processedText);
  
  // Sanitize the HTML to prevent XSS attacks
  const sanitizedHtml = DOMPurify.sanitize(parsedHtml.toString(), {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'a', 'p', 'br', 'strong', 'em', 'del', 'span',
      'pre', 'code', 'blockquote', 'ul', 'ol', 'li', 'img', 'button'
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'class', 'title', 'src', 'alt',
      'aria-label', 'data-language'
    ],
    ALLOW_DATA_ATTR: true
  });
  
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