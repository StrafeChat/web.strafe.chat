import { Component } from "solid-js";
import { useTransContext } from "@mbarzda/solid-i18next";
import Modal from "./Modal";

interface DeleteMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  messageContent: string;
}

export const DeleteMessageModal: Component<DeleteMessageModalProps> = (props) => {
  const [t] = useTransContext();

  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose}>
      <div class="space-y-6">
        <div>
          <h3 class="text-xl font-semibold text-text-primary mb-2">
            {t("messages.delete.title")}
          </h3>
          <p class="text-text-secondary">
            {t("messages.delete.confirmation")}
          </p>
          <div class="mt-4 p-4 bg-background rounded-lg border border-border">
            <p class="text-text-primary break-all break-words whitespace-pre-wrap">
              {props.messageContent}
            </p>
          </div>
        </div>
        <div class="border-t border-border pt-4">
          <div class="flex justify-end gap-3">
            <button
              type="button"
              onClick={props.onClose}
              class="px-4 py-2.5 text-text-primary hover:bg-surface rounded-md transition-colors font-medium"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={props.onConfirm}
              class="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors disabled:opacity-50 font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-background1"
            >
              {t("messages.delete.confirm")}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default DeleteMessageModal;