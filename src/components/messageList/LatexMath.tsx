import type { Component } from 'solid-js';
import { Show, createResource } from 'solid-js';
import { katexIfLoaded, loadKatex, renderLatex, type LatexRenderResult } from '../../lib/latex';
import { t } from '../../i18n';

export interface LatexMathProps {
  tex: string;
  display?: boolean;
}

export const LatexMath: Component<LatexMathProps> = (props) => {
  const [rendered] = createResource(
    () => `${props.display ? 'D' : 'I'}\u0000${props.tex}`,
    async (key): Promise<LatexRenderResult | null> => {
      if (!katexIfLoaded()) await loadKatex();
      const sep = key.indexOf('\u0000');
      return renderLatex(key.slice(sep + 1), key[0] === 'D');
    }
  );

  const source = () => (
    <code class="latex-source" title={props.tex}>
      {props.tex}
    </code>
  );

  return (
    <Show when={rendered()} fallback={source()}>
      {(result) => (
        <Show when={result().html} fallback={source()}>
          <span
            class={props.display ? 'latex-block block' : 'latex-inline'}
            classList={{ 'latex-error': !!result().error }}
            title={result().error ? `${t('latex.error')}: ${result().error}` : undefined}
            // eslint-disable-next-line solid/no-innerhtml
            innerHTML={result().html}
          />
        </Show>
      )}
    </Show>
  );
};
