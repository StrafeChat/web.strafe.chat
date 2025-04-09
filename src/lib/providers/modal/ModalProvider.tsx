import {
  createContext,
  createSignal,
  JSX,
  useContext,
} from "solid-js";
import type { ModalContextType } from "../types";

// Global flag to track if a modal is currently being processed
// This prevents duplicate modals from being opened simultaneously
let globalModalProcessing = false;

// Track the current modal content for debugging
let currentModalContent: string = "none";

const ModalContext = createContext<ModalContextType>({
  isOpen: false,
  content: null,
  openModal: () => {},
  closeModal: () => {},
});

export function ModalProvider(props: { children: JSX.Element }) {
  const [isOpen, setIsOpen] = createSignal(false);
  const [content, setContent] = createSignal<JSX.Element | null>(null);
  
  // Add a flag to prevent duplicate modals
  let isProcessingModal = false;

  const openModal = (modalContent: JSX.Element) => {
    // Try to get the component name for better logging
    const modalType = typeof modalContent === 'object' && modalContent !== null 
      ? (modalContent as any).type?.name || "Unknown" 
      : "Unknown";
    
    console.log(`Modal open requested: ${modalType} at ${new Date().toISOString()}`);
    
    // If global flag is set, block all modal openings
    if (globalModalProcessing) {
      console.warn(`BLOCKED: Global modal processing flag is active (${currentModalContent}), skipping new modal (${modalType})`);
      return;
    }
    
    // If we're already processing a modal, skip this one
    if (isProcessingModal) {
      console.warn(`BLOCKED: Local modal processing flag is active, skipping new modal (${modalType})`);
      return;
    }
    
    // If a modal is already open, don't open another one
    if (isOpen()) {
      console.warn(`BLOCKED: A modal is already open (${currentModalContent}), skipping new modal (${modalType})`);
      return;
    }
    
    // Set both flags to prevent duplicate modals
    isProcessingModal = true;
    globalModalProcessing = true;
    currentModalContent = modalType;
    console.log(`Modal processing flags set for ${modalType}:`, { isProcessingModal, globalModalProcessing });
    
    // Open the modal
    setContent(modalContent);
    setIsOpen(true);
    console.log(`Modal opened: ${modalType}`);
    
    // Reset the flags after a delay
    setTimeout(() => {
      isProcessingModal = false;
      console.log(`Local modal processing flag reset for ${modalType}`);
    }, 300);
  };

  const closeModal = () => {
    const modalType = currentModalContent;
    console.log(`Modal close requested: ${modalType} at ${new Date().toISOString()}`);
    
    setIsOpen(false);
    
    // Clear the content after the animation completes
    setTimeout(() => {
      setContent(null);
      
      // Reset the global flag when the modal is fully closed
      globalModalProcessing = false;
      currentModalContent = "none";
      console.log(`Modal fully closed and global flag reset: ${modalType}`);
    }, 300);
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
        <div class="fixed inset-0 z-50 flex items-center justify-center">
          <div
            class="absolute inset-0 bg-black/50"
            onClick={closeModal}
          ></div>
          <div class="relative z-10 max-w-md w-full mx-4 bg-surface rounded-lg shadow-xl">
            {content()}
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}

export function useModal() {
  return useContext(ModalContext);
}
