import { Component, JSX, createSignal, onMount, onCleanup, Show } from "solid-js";
import { Portal } from "solid-js/web";

interface ContextMenuItem {
  label: string;
  icon?: JSX.Element;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface ContextMenuProps {
  isOpen: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

const ContextMenu: Component<ContextMenuProps> = (props) => {
  let menuRef: HTMLDivElement | undefined;

  const handleClickOutside = (e: MouseEvent) => {
    if (menuRef && !menuRef.contains(e.target as Node)) {
      props.onClose();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      props.onClose();
    }
  };

  onMount(() => {
    if (props.isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
      
      // Focus the menu for keyboard navigation
      setTimeout(() => menuRef?.focus(), 0);
    }
  });

  onCleanup(() => {
    document.removeEventListener("mousedown", handleClickOutside);
    document.removeEventListener("keydown", handleKeyDown);
  });

  const getMenuPosition = () => {
    if (!props.isOpen) return { left: 0, top: 0 };
    
    const menuWidth = 200; // Approximate menu width
    const menuHeight = props.items.length * 40; // Approximate item height
    
    let left = props.x;
    let top = props.y;
    
    // Adjust if menu would go off-screen
    if (left + menuWidth > window.innerWidth) {
      left = props.x - menuWidth;
    }
    
    if (top + menuHeight > window.innerHeight) {
      top = props.y - menuHeight;
    }
    
    return { left: Math.max(0, left), top: Math.max(0, top) };
  };

  return (
    <Show when={props.isOpen}>
      <Portal>
        <div
          ref={menuRef}
          class="fixed z-[200] min-w-[200px] bg-background2 border border-border rounded-lg shadow-xl py-1 focus:outline-none"
          style={{
            left: `${getMenuPosition().left}px`,
            top: `${getMenuPosition().top}px`,
          }}
          tabIndex={-1}
        >
          {props.items.map((item, index) => (
            <button
              class={`w-full px-3 py-2 text-left text-sm transition-colors flex items-center gap-2 ${
                item.danger
                  ? "text-red-400 hover:bg-red-500 hover:bg-opacity-10"
                  : "text-text-primary hover:bg-surface"
              } ${
                item.disabled
                  ? "opacity-50 cursor-not-allowed"
                  : "cursor-pointer"
              }`}
              onClick={() => {
                if (!item.disabled) {
                  item.onClick();
                  props.onClose();
                }
              }}
              disabled={item.disabled}
            >
              {item.icon && (
                <span class="w-4 h-4 flex-shrink-0">
                  {item.icon}
                </span>
              )}
              <span class="flex-1">{item.label}</span>
            </button>
          ))}
        </div>
      </Portal>
    </Show>
  );
};

export default ContextMenu;