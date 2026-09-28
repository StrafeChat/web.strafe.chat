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
    'bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover hover:shadow-md',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:shadow-sm',
  outline:
    'border border-border bg-card/55 text-foreground hover:bg-accent hover:text-accent-foreground',
  ghost: 'text-foreground/90 hover:bg-accent hover:text-accent-foreground',
  destructive:
    'bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:shadow-sm',
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
        inline-flex items-center justify-center gap-2 rounded-lg font-medium
        transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0
        active:scale-[0.99]
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
