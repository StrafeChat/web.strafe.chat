import { createSignal, JSX, onCleanup } from "solid-js";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: JSX.Element;
}

export const Drawer = ({ isOpen, onClose, children }: DrawerProps) => {
  const [isVisible, setIsVisible] = createSignal(isOpen);

  const handleTransitionEnd = () => {
    if (!isOpen) setIsVisible(false);
  };

  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown);
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  window.addEventListener("keydown", handleKeyDown);

  return (
    <div
      class={`fixed inset-0 z-50 transition-transform transform ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}
      onTransitionEnd={handleTransitionEnd}
      style={{
        display: isVisible() ? "block" : "none",
      }}
    >
      <div
        class="absolute inset-0 bg-black opacity-50"
        onClick={onClose}
      ></div>
      <div class="relative bg-white w-64 h-full shadow-xl overflow-auto">
        {children}
      </div>
    </div>
  );
};
