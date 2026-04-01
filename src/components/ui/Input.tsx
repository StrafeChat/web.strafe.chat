import type { Component, JSX } from 'solid-js';
import { createUniqueId, splitProps } from 'solid-js';

interface InputProps extends JSX.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  class?: string;
  /** Show required asterisk on label */
  required?: boolean;
}

export const Input: Component<InputProps> = (props) => {
  const uniqueId = createUniqueId();
  const [local, rest] = splitProps(props, ['label', 'error', 'required', 'class', 'id']);
  const inputId = () => local.id ?? uniqueId;

  return (
    <div class="w-full space-y-1.5">
      {local.label ? (
        <label for={inputId()} class="text-sm font-medium text-foreground">
          {local.label}
          {local.required ? <span class="text-destructive"> *</span> : null}
        </label>
      ) : null}
      <input
        id={inputId()}
        class={`
          box-border flex h-10 min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground
          placeholder:text-muted-foreground
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0
          disabled:cursor-not-allowed disabled:opacity-50
          ${local.error ? 'border-destructive' : ''}
          ${local.class ?? ''}
        `}
        {...rest}
      />
      {local.error ? (
        <div class="flex gap-1.5 text-xs text-destructive" role="alert">
          <i class="fa-solid fa-circle-exclamation mt-0.5 shrink-0 text-destructive" aria-hidden="true" />
          <span>{local.error}</span>
        </div>
      ) : null}
    </div>
  );
};
