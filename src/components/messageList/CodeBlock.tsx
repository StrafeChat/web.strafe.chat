import type { Component } from 'solid-js';
import { Show, createResource, createSignal } from 'solid-js';
import { highlightCode } from '../../lib/codeHighlight';
import { t } from '../../i18n';

export interface CodeBlockProps {
  lang: string;
  content: string;
}

/**
 * A fenced code block, Discord-style: the language's name in the corner when we can colour
 * it, and a copy button that appears on hover. Highlighting is asynchronous (the engine is
 * fetched on first use), so the code shows immediately as plain text and gains its colours
 * a moment later rather than holding the message back.
 */
export const CodeBlock: Component<CodeBlockProps> = (props) => {
  const [highlighted] = createResource(
    () => ({ lang: props.lang, code: props.content }),
    ({ lang, code }) => highlightCode(code, lang)
  );
  const [copied, setCopied] = createSignal(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(props.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard refused (permissions, insecure origin) - nothing useful to say */
    }
  }

  return (
    <div class="group/code relative my-1.5 block max-w-full">
      <div class="absolute end-1.5 top-1.5 z-10 flex items-center gap-1.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/code:opacity-100">
        <Show when={highlighted()?.language}>
          {(lang) => <span class="select-none text-[10px] uppercase tracking-wide text-muted-foreground">{lang()}</span>}
        </Show>
        <button
          type="button"
          class="rounded border border-border/70 bg-background/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => void copy()}
        >
          {copied() ? t('common.copied') : t('common.copy')}
        </button>
      </div>
      <pre class="message-code-block overflow-x-auto rounded-md border border-border bg-muted/50 px-3 py-2">
        <Show
          when={highlighted()}
          fallback={<code class="hljs font-mono text-[0.85em]">{props.content}</code>}
        >
          {(result) => (
            <code
              class="hljs font-mono text-[0.85em]"
              // eslint-disable-next-line solid/no-innerhtml -- highlight.js escapes the source and the result is DOMPurify-sanitised in lib/codeHighlight.ts
              innerHTML={result().html}
            />
          )}
        </Show>
      </pre>
    </div>
  );
};
