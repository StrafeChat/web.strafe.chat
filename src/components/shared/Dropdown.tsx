import {
  Component,
  For,
  Show,
  createSignal,
  createMemo,
  onMount,
  onCleanup,
} from "solid-js";
import { ChevronDown } from "./icons/ChevronDown";

export type DropdownOption<T> = {
  value: T;
  label: string;
  icon?: Component;
};

type DropdownProps<T> = {
  options: DropdownOption<T>[];
  value: T;
  onChange: (value: T) => void;
  class?: string;
};

export function Dropdown<T>(props: DropdownProps<T>) {
  const [isOpen, setIsOpen] = createSignal(false);
  let ref: HTMLDivElement | undefined;

  const handleClickOutside = (e: MouseEvent) => {
    if (ref && !ref.contains(e.target as Node)) setIsOpen(false);
  };

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") setIsOpen(false);
  };

  onMount(() => {
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
  });

  onCleanup(() => {
    document.removeEventListener("mousedown", handleClickOutside);
    document.removeEventListener("keydown", handleKey);
  });

  const selected = createMemo(() =>
    props.options.find((opt) => opt.value === props.value),
  );

  const handleSelect = (val: T) => {
    props.onChange(val);
    setIsOpen(false);
  };

  return (
    <div ref={ref} class={`relative ${props.class ?? ""}`}>
      <div
        role="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen()}
        tabindex={0}
        onClick={() => setIsOpen(!isOpen())}
        class="w-full min-h-[44px] px-3 py-2 grid grid-cols-[1fr_auto] items-center gap-2 bg-background text-text-primary border border-border rounded-md cursor-pointer hover:bg-surface focus:outline-none transition-colors"
      >
        <div class="truncate text-[16px] font-medium leading-tight flex items-center gap-2">
          <Show when={selected()} keyed>
            {(option: DropdownOption<T>) => (
              <>
                {option.icon && <option.icon />}
                <span class="truncate">{option.label}</span>
              </>
            )}
          </Show>
        </div>
        <div
          class="transition-transform duration-200"
          classList={{ "rotate-180": isOpen() }}
        >
          <ChevronDown />
        </div>
      </div>

      <Show when={isOpen()}>
        <div class="absolute left-0 mt-1 w-full bg-background border border-border rounded-md shadow-lg z-50 overflow-hidden">
          <For each={props.options}>
            {(option) => (
              <button
                type="button"
                onClick={() => handleSelect(option.value)}
                class="w-full text-left px-3 py-2 hover:bg-surface flex items-center gap-2 text-text-primary text-sm truncate"
              >
                {option.icon && <option.icon />}
                <span class="truncate">{option.label}</span>
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
