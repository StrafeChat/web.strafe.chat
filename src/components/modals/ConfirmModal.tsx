import { Component, JSX } from "solid-js";
import Modal from "./Modal";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: JSX.Element;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

const ConfirmModal: Component<ConfirmModalProps> = (props) => {
  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose}>
      <div class="space-y-6">
        <div>
          <h3 class="text-xl font-semibold text-text-primary mb-6">
            {props.title}
          </h3>
        </div>
        <div class="text-text-primary mb-6">{props.message}</div>
        <div class="border-t border-border pt-4">
          <div class="flex justify-end gap-3">
            <button
              class="px-4 py-2.5 text-text-primary hover:bg-surface rounded-md transition-colors font-medium"
              onClick={props.onClose}
            >
              {props.cancelText || "Cancel"}
            </button>
            <button
              class={`px-4 py-2.5 ${props.isDanger ? "bg-[#da373c]" : "bg-primary"} text-text-primary rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 font-medium`}
              onClick={props.onConfirm}
            >
              {props.confirmText || "Confirm"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmModal;