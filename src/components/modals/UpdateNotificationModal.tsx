import { Component, Show } from "solid-js";
// import { useTransContext } from "@mbarzda/solid-i18next";
import Modal from "./Modal";
import type { UpdateInfo } from "../../lib/services/githubService";

interface UpdateNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateInfo: UpdateInfo | null;
}

const UpdateNotificationModal: Component<UpdateNotificationModalProps> = (props) => {
  // const [t] = useTransContext();

  const handleViewUpdate = () => {
    if (props.updateInfo?.url) {
      window.open(props.updateInfo.url, '_blank');
    }
    props.onClose();
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const truncateMessage = (message: string, maxLength = 200) => {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + '...';
  };

  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose}>
      <div class="max-w-md mx-auto">
        <div class="flex items-center mb-4">
          <div class="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mr-4">
            <svg class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
          </div>
          <div>
            <h2 class="text-xl font-semibold text-text-primary">
              New Update Available!
            </h2>
            <p class="text-sm text-text-secondary">
              Commit {props.updateInfo?.version}
            </p>
          </div>
        </div>

        <Show when={props.updateInfo}>
          <div class="mb-6">
            <div class="bg-background1 rounded-lg p-4 mb-4">
              <h3 class="font-medium text-text-primary mb-2">
                Commit Message:
              </h3>
              <p class="text-sm text-text-secondary whitespace-pre-wrap">
                {truncateMessage(props.updateInfo?.message || 'No description available')}
              </p>
            </div>

            <div class="text-xs text-text-secondary mb-4">
              Published: {formatDate(props.updateInfo?.publishedAt || '')}
            </div>
          </div>
        </Show>

        <div class="flex gap-3">
          <button
            onClick={props.onClose}
            class="flex-1 px-4 py-2 bg-background1 text-text-primary rounded-lg hover:bg-background2 transition-colors"
          >
            Later
          </button>
          <button
            onClick={handleViewUpdate}
            class="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            View Update
          </button>
        </div>

        <p class="text-xs text-text-secondary mt-3 text-center">
          This notification will only be shown once for this update.
        </p>
      </div>
    </Modal>
  );
};

export default UpdateNotificationModal;