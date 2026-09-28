import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { inputBaseClass } from './Input';

interface SearchInputProps extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'onInput' | 'size'> {
  value: string;
  onValueChange: (value: string) => void;
  /** `sm` = 32px (header search), `md` = 36px (sidebar / settings). */
  size?: 'sm' | 'md';
  class?: string;
  /** Wrapper class (width, margins). */
  wrapperClass?: string;
}

const sizeClass = {
  sm: 'h-8 pl-7 pr-2 text-xs',
  md: 'h-9 pl-9 pr-3 text-[13px]',
};

const iconClass = {
  sm: 'left-2.5 text-[11px]',
  md: 'left-3 text-[13px]',
};

/** Search field with a leading magnifier - one look for every search box in the app. */
export const SearchInput: Component<SearchInputProps> = (props) => {
  const [local, rest] = splitProps(props, ['value', 'onValueChange', 'size', 'class', 'wrapperClass']);
  const size = () => local.size ?? 'md';
  return (
    <div class={`relative ${local.wrapperClass ?? ''}`}>
      <i
        class={`fa-solid fa-magnifying-glass pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground ${iconClass[size()]}`}
        aria-hidden="true"
      />
      <input
        type="search"
        value={local.value}
        onInput={(e) => local.onValueChange(e.currentTarget.value)}
        class={`${inputBaseClass} ${sizeClass[size()]} [&::-webkit-search-cancel-button]:appearance-none ${local.class ?? ''}`}
        {...rest}
      />
    </div>
  );
};
