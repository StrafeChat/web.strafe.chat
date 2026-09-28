import type { Component, JSX } from 'solid-js';
import { createUniqueId, splitProps } from 'solid-js';
import { FieldError, fieldLabelClass, inputBaseClass, inputErrorClass } from './Input';

interface TextareaProps extends JSX.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  /** Helper text under the field */
  hint?: string;
  class?: string;
}

/** Multi-line sibling of Input - same surface, resizable vertically. */
export const Textarea: Component<TextareaProps> = (props) => {
  const uniqueId = createUniqueId();
  const [local, rest] = splitProps(props, ['label', 'error', 'hint', 'class', 'id']);
  const id = () => local.id ?? uniqueId;
  return (
    <div class="w-full space-y-1.5">
      {local.label ? (
        <label for={id()} class={fieldLabelClass}>
          {local.label}
        </label>
      ) : null}
      <textarea
        id={id()}
        class={`${inputBaseClass} min-h-20 resize-y px-3 py-2 leading-relaxed ${local.error ? inputErrorClass : ''} ${local.class ?? ''}`}
        {...rest}
      />
      {local.hint && !local.error ? <p class="text-xs text-muted-foreground">{local.hint}</p> : null}
      <FieldError message={local.error} />
    </div>
  );
};
