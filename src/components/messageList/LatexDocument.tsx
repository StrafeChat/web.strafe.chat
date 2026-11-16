import type { Component } from 'solid-js';
import { Show, createResource } from 'solid-js';
import {
  latexjsIfLoaded,
  loadLatexJs,
  renderLatexDocument,
  type LatexDocumentResult,
} from '../../lib/latexDocument';
import { t } from '../../i18n';

export interface LatexDocumentProps {
  source: string;
}

export const LatexDocument: Component<LatexDocumentProps> = (props) => {
  const [rendered] = createResource(
    () => props.source,
    async (source): Promise<LatexDocumentResult | null> => {
      if (!latexjsIfLoaded()) await loadLatexJs();
      return renderLatexDocument(source);
    }
  );

  const source = () => (
    <code class="latex-source" title={props.source}>
      {props.source}
    </code>
  );

  const failure = (message?: string) => (
    <code
      class="latex-source latex-error"
      title={message ? `${t('latex.error')}: ${message}` : t('latex.error')}
    >
      {props.source}
    </code>
  );

  return (
    <Show
      when={rendered()}
      fallback={
        <Show when={rendered.error} fallback={source()}>
          {(error) => failure(error() instanceof Error ? error().message : String(error()))}
        </Show>
      }
    >
      {(result) => (
        <Show when={!result().error && result().html} fallback={failure(result().error)}>
          <div
            class="latex-doc"
            // eslint-disable-next-line solid/no-innerhtml -- DOMPurify-sanitised in lib/latexDocument.ts
            innerHTML={result().html}
          />
        </Show>
      )}
    </Show>
  );
};
