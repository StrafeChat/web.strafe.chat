import type { Component, JSX } from 'solid-js';

interface InputProps extends JSX.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  class?: string;
}

export const Input: Component<InputProps> = (props) => {
  const { label, error, class: className = '', id, ...rest } = props;
  const inputId = id ?? `input-${Math.random().toString(36).slice(2)}`;

  return (
    <div class="space-y-1.5">
      {label ? (
        <label for={inputId} class="text-sm font-medium text-foreground">
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        class={`
          flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground
          placeholder:text-muted-foreground
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
          disabled:cursor-not-allowed disabled:opacity-50
          ${error ? 'border-destructive' : ''}
          ${className}
        `}
        {...rest}
      />
      {error ? (
        <p class="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
};
