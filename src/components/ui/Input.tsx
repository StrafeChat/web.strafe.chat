import type { Component, JSX } from 'solid-js';
import { createUniqueId, Show, splitProps } from 'solid-js';

/**
 * Shared text-field surface. Every text input, textarea, search box and select in the
 * app builds on this so they all share the same border, fill, radius and focus ring.
 */
export const inputBaseClass =
  'box-border flex w-full rounded-lg border border-input bg-background/80 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50';

export const inputErrorClass = 'border-destructive';

export const fieldLabelClass = 'text-sm font-medium text-foreground';

interface InputProps extends JSX.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  class?: string;
  /** Show required asterisk on label */
  required?: boolean;
}

/**
 * `Show`, not a ternary in the component body: a Solid component body runs once, so
 * `props.message ? ... : null` there is evaluated a single time - at mount, when a field's
 * error is virtually always still empty - and never again. Every message that appears *after*
 * mount (which is all of them: failed submits, wrong codes, validation) silently rendered
 * nothing.
 */
export const FieldError: Component<{ message?: string }> = (props) => (
  <Show when={props.message}>
    {(message) => (
      <div class="flex gap-1.5 text-xs text-destructive" role="alert">
        <i class="fa-solid fa-circle-exclamation mt-0.5 shrink-0 text-destructive" aria-hidden="true" />
        <span>{message()}</span>
      </div>
    )}
  </Show>
);

export const Input: Component<InputProps> = (props) => {
  const uniqueId = createUniqueId();
  const [local, rest] = splitProps(props, ['label', 'error', 'required', 'class', 'id']);
  const inputId = () => local.id ?? uniqueId;

  return (
    <div class="w-full space-y-1.5">
      {local.label ? (
        <label for={inputId()} class={fieldLabelClass}>
          {local.label}
          {local.required ? <span class="text-destructive"> *</span> : null}
        </label>
      ) : null}
      <input
        id={inputId()}
        class={`${inputBaseClass} h-10 min-h-10 px-3 py-2 ${local.error ? inputErrorClass : ''} ${local.class ?? ''}`}
        {...rest}
      />
      <FieldError message={local.error} />
    </div>
  );
};
