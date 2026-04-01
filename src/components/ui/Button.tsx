import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';

interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  class?: string;
  children?: JSX.Element;
}

const variantStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-primary text-primary-foreground hover:bg-primary-hover',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  outline:
    'border border-border bg-transparent hover:bg-accent hover:text-accent-foreground',
  ghost: 'hover:bg-accent hover:text-accent-foreground',
  destructive:
    'bg-destructive text-destructive-foreground hover:bg-destructive/90',
};

const sizeStyles: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-6 text-base',
};

export const Button: Component<ButtonProps> = (props) => {
  const [local, rest] = splitProps(props, ['variant', 'size', 'loading', 'class', 'children', 'disabled']);

  const variant = () => local.variant ?? 'primary';
  const size = () => local.size ?? 'md';
  const loading = () => local.loading ?? false;
  const className = () => local.class ?? '';

  return (
    <button
      type="button"
      class={`
        inline-flex items-center justify-center gap-2 rounded-md font-medium
        transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0
        disabled:pointer-events-none disabled:opacity-50 hover:cursor-pointer
        ${variantStyles[variant()]}
        ${sizeStyles[size()]}
        ${className()}
      `}
      disabled={local.disabled ?? loading()}
      {...rest}
    >
      {loading() ? (
        <span class="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {local.children}
    </button>
  );
};
