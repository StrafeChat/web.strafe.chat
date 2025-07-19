import { Component, JSX, onMount, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";
import { Motion, Presence } from "solid-motionone";

interface ModalProps {
  isOpen: boolean;
  onClose?: () => void;
  type?: "default" | "full";
  children: JSX.Element;
  hideCloseButton?: boolean;
}

const Modal: Component<ModalProps> = (props) => {
  console.log('Modal rendered with isOpen:', props.isOpen);
  
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
        {(() => {
          console.log('Presence condition check - isOpen:', props.isOpen);
          return props.isOpen;
        })() && (
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
              onClick={() => props.type !== "full" && props.onClose?.()}
            />

            {props.type === "full" ? (
              <Motion
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                class="fixed inset-0 bg-background"
              >
                {props.children}
              </Motion>
            ) : (
              <div
                class="fixed inset-0 overflow-y-auto"
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    props.onClose?.();
                  }
                }}
              >
                <div
                  class="flex min-h-full items-center justify-center p-4"
                  onClick={(e) => {
                    if (e.target === e.currentTarget) {
                      props.onClose?.();
                    }
                  }}
                >
                  <Motion
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{
                      duration: 0.3,
                      easing: [0.4, 0, 0.2, 1],
                    }}
                    class="relative w-full max-w-md bg-background2 rounded-lg shadow-xl border border-border overflow-hidden"
                  >
                    <div class="p-6">
                      {props.children}
                      {!props.hideCloseButton && props.onClose && (
                        <button
                          class="absolute top-4 right-4 text-text-secondary hover:text-text-primary"
                          onClick={props.onClose}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </Motion>
                </div>
              </div>
            )}
          </Motion>
        )}
      </Presence>
    </Portal>
  );
};

export default Modal;
