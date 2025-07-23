import { Component, createSignal } from "solid-js";
import Modal from "./Modal";

interface LinkConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  href: string;
  onConfirm: () => void;
  onTrustDomain: () => void;
}

/**
 * Modal component for confirming external link navigation
 */
const LinkConfirmModal: Component<LinkConfirmModalProps> = (props) => {
  const [trustDomain, setTrustDomain] = createSignal(false);
  
  const handleConfirm = () => {
    if (trustDomain()) {
      props.onTrustDomain();
    } else {
      props.onConfirm();
      props.onClose();
    }
  };
  
  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose} hideCloseButton={true} class="z-[200]">
      <h2 class="text-xl font-semibold mb-4">External Link</h2>
      <p class="text-gray-300 mb-6">
        You're about to visit an external website: <br />
        <span class="text-primary break-all">{props.href}</span>
      </p>
      {/* <p class="text-sm text-text-secondary mb-6">
        Tip: Hold Ctrl (or Cmd on Mac) while clicking links to bypass this confirmation.
      </p> */}
      <div class="flex items-center mb-4">
        <input
          type="checkbox"
          id="trust-domain"
          checked={trustDomain()}
          onChange={(e) => setTrustDomain(e.target.checked)}
          class="mr-2 h-4 w-4 accent-primary cursor-pointer"
        />
        <label for="trust-domain" class="text-sm cursor-pointer">
          Trust this domain and don't ask again
        </label>
      </div>
      <div class="flex justify-end gap-3">
        <button
          onClick={props.onClose}
          class="px-4 py-2 rounded-md bg-background2 hover:bg-background3 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          class="px-4 py-2 rounded-md bg-primary hover:bg-accent transition-colors"
        >
          Continue
        </button>
      </div>
    </Modal>
  );
};

export default LinkConfirmModal;