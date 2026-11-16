import type { Component } from 'solid-js';
import { For, Show, createMemo } from 'solid-js';
import { collectLatexSegments } from '../../lib/utils/markdown';
import { LatexMath } from '../messageList/LatexMath';
import { t } from '../../i18n';

const MAX_PREVIEWED = 12;

export const LatexPreview: Component<{ text: string }> = (props) => {
  const snippets = createMemo(() => collectLatexSegments(props.text).slice(0, MAX_PREVIEWED));
  return (
    <Show when={snippets().length > 0}>
      <div class="mb-1.5 rounded-lg border border-border/60 bg-muted/30 px-3 py-2" aria-live="polite">
        <div class="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <i class="fa-solid fa-square-root-variable" aria-hidden="true" />
          {t('latex.preview')}
        </div>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 overflow-x-auto">
          <For each={snippets()}>{(snippet) => <LatexMath tex={snippet.tex} display={snippet.display} />}</For>
        </div>
      </div>
    </Show>
  );
};
