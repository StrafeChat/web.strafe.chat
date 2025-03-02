import {
  Component,
  For,
  Show,
  createSignal,
  onCleanup,
  onMount,
  createMemo,
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
  let dropdownRef: HTMLDivElement | undefined;

  const handleClickOutside = (event: MouseEvent) => {
    if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
      setIsOpen(false);
    }
  };

  onMount(() => {
    document.addEventListener("mousedown", handleClickOutside);
  });

  onCleanup(() => {
    document.removeEventListener("mousedown", handleClickOutside);
  });

  const currentOption = createMemo(() =>
    props.options.find((opt) => opt.value === props.value),
  );

  const handleSelect = (value: T) => {
    props.onChange(value);
    setIsOpen(false);
  };

  return (
    <div class={props.class} ref={dropdownRef}>
      <div class="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen())}
          class="flex items-center gap-2 px-3 py-1 border border-border rounded-md bg-background text-text-primary hover:bg-surface focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
        >
          <Show when={currentOption()} keyed>
            {(option) => (
              <>
                {option.icon && <option.icon />}
                <span>{option.label}</span>
              </>
            )}
          </Show>
          <div
            class="transition-transform duration-200"
            classList={{ "rotate-180": isOpen() }}
          >
            <ChevronDown />
          </div>
        </button>

        <Show when={isOpen()}>
          <div class="absolute top-full mt-1 right-0 w-32 py-1 bg-background border border-border rounded-md shadow-lg z-50">
            <For each={props.options}>
              {(option) => (
                <button
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  class="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-surface text-text-primary text-left"
                >
                  {option.icon && <option.icon />}
                  <span>{option.label}</span>
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  );
}
