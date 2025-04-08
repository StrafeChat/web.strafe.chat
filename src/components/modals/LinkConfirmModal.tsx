import { Component } from "solid-js";
import Modal from "./Modal";

interface LinkConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  href: string;
  onConfirm: () => void;
}

const LinkConfirmModal: Component<LinkConfirmModalProps> = (props) => {
  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose}>
      <div class="p-6">
        <h2 class="text-xl font-semibold mb-4">External Link</h2>
        <p class="text-gray-300 mb-6">
          You're about to visit an external website: <br />
          <span class="text-primary break-all">{props.href}</span>
        </p>
        <div class="flex justify-end gap-3">
          <button
            onClick={props.onClose}
            class="px-4 py-2 rounded-md bg-background2 hover:bg-background1 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              props.onConfirm();
              props.onClose();
            }}
            class="px-4 py-2 rounded-md bg-primary hover:bg-accent transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default LinkConfirmModal;