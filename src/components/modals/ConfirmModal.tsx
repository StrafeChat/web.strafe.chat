import { Component, Show, JSX } from "solid-js";
import Modal from "./Modal";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  variant?: "danger" | "warning" | "info";
  isDanger?: boolean;
  icon?: JSX.Element;
}

const ConfirmModal: Component<ConfirmModalProps> = (props) => {
  // Handle backward compatibility
  const displayText = props.description || props.message || "";
  const effectiveVariant = props.isDanger ? "danger" : props.variant;

  const getVariantStyles = () => {
    switch (effectiveVariant) {
      case "danger":
        return {
          iconBg: "bg-red-500/10",
          iconColor: "text-red-500",
          confirmButton: "bg-red-500 hover:bg-red-600 text-white"
        };
      case "warning":
        return {
          iconBg: "bg-yellow-500/10",
          iconColor: "text-yellow-500",
          confirmButton: "bg-yellow-500 hover:bg-yellow-600 text-white"
        };
      case "info":
      default:
        return {
          iconBg: "bg-blue-500/10",
          iconColor: "text-blue-500",
          confirmButton: "bg-blue-500 hover:bg-blue-600 text-white"
        };
    }
  };

  const styles = getVariantStyles();



  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose}>
      <div class="space-y-6">
        <div class="flex items-start gap-4">
          {/* Icon */}
          <div class={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${styles.iconBg}`}>
            <Show when={props.icon} fallback={
              <svg class={`w-6 h-6 ${styles.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            }>
              {props.icon}
            </Show>
          </div>
          
          {/* Content */}
          <div class="flex-1">
            <h3 class="text-xl font-semibold text-text-primary mb-2">
              {props.title}
            </h3>
            <p class="text-text-secondary">
              {displayText}
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
              {props.cancelText || "Cancel"}
            </button>
            <button
              type="button"
              onClick={props.onConfirm}
              disabled={props.isLoading}
              class={`px-4 py-2.5 rounded-md transition-colors disabled:opacity-50 font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background1 ${
                effectiveVariant === "danger"
                  ? "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500"
                  : "bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500"
              }`}
            >
              {props.isLoading ? 'Loading...' : (props.confirmText || "Confirm")}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmModal;