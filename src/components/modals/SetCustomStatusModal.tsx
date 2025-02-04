// src/components/modals/SetCustomStatusModal.tsx
import { Component, createSignal } from "solid-js";
import Modal from "../modals/Modal";
import { useTransContext } from "@mbarzda/solid-i18next";
import { useAuth } from "../../lib/providers/auth/AuthProvider";
import { useToast } from "../common/Toast";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const SetCustomStatusModal: Component<Props> = (props) => {
  const [t] = useTransContext();
  const { user, updateStatus } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = createSignal(false);
  const [customStatus, setCustomStatus] = createSignal(
    user()?.presence?.custom_status || ""
  );

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setLoading(true);

    try {
      const success = await updateStatus(
        user()?.presence?.status,
        customStatus()
      );
      if (success) {
        showToast(t("customStatus.success"), "success");
        props.onClose();
      } else {
        showToast(t("status.error"), "error");
      }
    } catch (error) {
      console.error("Error updating custom status:", error);
      showToast(t("status.error"), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose}>
      <form onSubmit={handleSubmit} class="space-y-6">
        <div>
          <h3 class="text-xl font-semibold text-text-primary mb-6">
            {t("customStatus.title", "Set a custom status")}
          </h3>
        </div>

        <div>
          <label
            for="customStatus"
            class="block text-sm font-medium mb-2 text-text-primary"
          >
            {t("customStatus.label", "Custom Status")}
          </label>
          <input
            type="text"
            value={customStatus()}
            onInput={(e) => setCustomStatus(e.currentTarget.value)}
            placeholder={t(
              "customStatus.placeholder",
              "What's your status? (e.g. 🎉 Celebrating)"
            )}
            class="w-full px-4 py-2.5 bg-background border-2 border-border rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-text-secondary"
            disabled={loading()}
          />
        </div>

        <div class="border-t border-border pt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={props.onClose}
            class="px-4 py-2 text-text-primary hover:bg-surface rounded-md"
          >
            {t("common.cancel", "Cancel")}
          </button>
          <button
            type="submit"
            disabled={loading()}
            class="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading()
              ? t("common.saving", "Saving...")
              : t("common.save", "Save")}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default SetCustomStatusModal;
