import {
  createContext,
  createSignal,
  JSX,
  useContext,
  createRoot,
} from "solid-js";
import type { ModalContextType } from "../types";

const ModalContext = createContext<ModalContextType>({
  isOpen: false,
  content: null,
  openModal: () => {},
  closeModal: () => {},
});

export function ModalProvider(props: { children: JSX.Element }) {
  const [isOpen, setIsOpen] = createSignal(false);
  const [content, setContent] = createSignal<JSX.Element | null>(null);

  const openModal = (modalContent: JSX.Element) => {
    createRoot(() => {
      setContent(modalContent);
      setIsOpen(true);
    });
  };

  const closeModal = () => {
    setIsOpen(false);
    setContent(null);
  };

  return (
    <ModalContext.Provider
      value={{
        isOpen: isOpen(),
        content: content(),
        openModal,
        closeModal,
      }}
    >
      {props.children}

      {isOpen() && (
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeModal();
            }
          }}
        >
          <div
            class="bg-surface border border-border rounded-lg shadow-xl p-6 max-w-md w-full relative"
            onClick={(e) => e.stopPropagation()}
          >
            {content()}
            <button
              class="absolute top-4 right-4 text-text-secondary hover:text-text-primary"
              onClick={closeModal}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}

export function useModal() {
  return useContext(ModalContext);
}
