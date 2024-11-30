import { Component, JSX, onMount, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";
import { Motion, Presence } from "solid-motionone";

interface ModalProps {
  isOpen: boolean;
  onClose?: () => void;
  type?: "default" | "full";
  children: JSX.Element;
}

const Modal: Component<ModalProps> = (props) => {
  onMount(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && props.isOpen && props.onClose) {
        props.onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    onCleanup(() => window.removeEventListener("keydown", handleEscape));
  });

  return (
    <Portal>
      <Presence>
        {props.isOpen && (
          <Motion
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            class="fixed inset-0 z-50"
          >
            <Motion
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.8 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              class="fixed inset-0 bg-black"
            />

            <Motion
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{
                duration: 0.3,
                easing: [0.4, 0, 0.2, 1],
              }}
              class={`${
                props.type === "full"
                  ? "fixed inset-0 bg-background"
                  : "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-background2 rounded-lg"
              }`}
            >
              {props.children}
            </Motion>
          </Motion>
        )}
      </Presence>
    </Portal>
  );
};

export default Modal;
