import {
  createContext,
  createSignal,
  JSX,
  useContext,
  createEffect,
  onCleanup,
} from "solid-js";
import { Portal } from "solid-js/web";
import { useTheme } from "../theme/ThemeProvider";
import type { ContextMenuContextType } from "../types";

const ContextMenuContext = createContext<ContextMenuContextType>({
  isOpen: false,
  x: 0,
  y: 0,
  content: null,
  openContextMenu: () => {},
  closeContextMenu: () => {},
});

export function ContextMenuProvider(props: { children: JSX.Element }) {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = createSignal(false);
  const [x, setX] = createSignal(0);
  const [y, setY] = createSignal(0);
  const [content, setContent] = createSignal<(() => JSX.Element) | null>(null);

  const openContextMenu = (event: MouseEvent, menuContent: () => JSX.Element) => {
    event.preventDefault();
    event.stopPropagation();

    const menuWidth = 250;
    const menuHeight = 200;

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let posX = event.clientX;
    let posY = event.clientY;

    if (posX + menuWidth > windowWidth) {
      posX = windowWidth - menuWidth - 10;
    }

    if (posY + menuHeight > windowHeight) {
      posY = windowHeight - menuHeight - 10;
    }

    setX(posX);
    setY(posY);
    setContent(() => menuContent);
    setIsOpen(true);
  };

  const closeContextMenu = () => {
    setIsOpen(false);
    setContent(null);
  };

  // Handle click outside to close context menu
  createEffect(() => {
    if (isOpen()) {
      const handleClickOutside = (_event: MouseEvent) => {
        closeContextMenu();
      };

      // Add listener with a small delay to avoid immediate closure
      const timeoutId = setTimeout(() => {
        document.addEventListener("click", handleClickOutside);
      }, 0);

      onCleanup(() => {
        clearTimeout(timeoutId);
        document.removeEventListener("click", handleClickOutside);
      });
    }
  });

  // Handle escape key to close context menu
  createEffect(() => {
    if (isOpen()) {
      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          closeContextMenu();
        }
      };

      document.addEventListener("keydown", handleEscape);
      onCleanup(() => {
        document.removeEventListener("keydown", handleEscape);
      });
    }
  });

  return (
    <ContextMenuContext.Provider
      value={{
        isOpen: isOpen(),
        x: x(),
        y: y(),
        content: content(),
        openContextMenu,
        closeContextMenu,
      }}
    >
      {props.children}
      
      {/* Render context menu using Portal to maintain provider context */}
      <Portal>
        {isOpen() && content() && (
          <div
            class="fixed z-[9999] rounded-md shadow-lg p-2 pointer-events-auto"
            style={{
              left: `${x()}px`,
              top: `${y()}px`,
              width: "250px",
              "max-height": "400px",
              "overflow-y": "auto",
              "background-color": theme().colors.background2,
              border: `1px solid ${theme().colors.border}`,
              color: theme().colors.text.primary,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div class="divide-y divide-border">
              {content()!()}
            </div>
          </div>
        )}
      </Portal>
    </ContextMenuContext.Provider>
  );
}

export function useContextMenu() {
  return useContext(ContextMenuContext);
}
