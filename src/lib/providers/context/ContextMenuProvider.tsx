import {
  createContext,
  createSignal,
  JSX,
  useContext,
  createEffect,
} from "solid-js";
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
  const [content, setContent] = createSignal<JSX.Element | null>(null);

  const openContextMenu = (event: MouseEvent, menuContent: JSX.Element) => {
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
    setContent(menuContent);
    setIsOpen(true);
  };

  const closeContextMenu = () => {
    setIsOpen(false);
    setContent(null);
  };

  createEffect(() => {
    const handleClickOutside = (_event: MouseEvent) => {
      if (isOpen()) {
        closeContextMenu();
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
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

      {isOpen() && (
        <div
          class="absolute z-[9999] rounded-md shadow-lg p-2"
          style={{
            position: "fixed",
            left: `${x()}px`,
            top: `${y()}px`,
            width: "250px",
            "max-height": "300px",
            "overflow-y": "auto",
            "background-color": theme().colors.surface,
            border: `1px solid ${theme().colors.border}`,
            color: theme().colors.text.primary,
          }}
        >
          <div class="divide-y divide-border">{content()}</div>
        </div>
      )}
    </ContextMenuContext.Provider>
  );
}

export function useContextMenu() {
  return useContext(ContextMenuContext);
}
