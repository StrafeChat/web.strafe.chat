import { Component, createSignal, createEffect } from "solid-js";
import Modal from "./Modal";
import { useToast } from "../common/Toast";

interface Folder {
  id: string;
  name: string;
  color?: string;
  isOpen: boolean;
  spaceIds: string[];
}

interface FolderSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  folder: Folder | null;
  onUpdateFolder: (folderId: string, name: string, color: string) => void;
  onDeleteFolder: (folderId: string) => void;
}

const FolderSettingsModal: Component<FolderSettingsModalProps> = (props) => {
  const [folderName, setFolderName] = createSignal("");
  const [folderColor, setFolderColor] = createSignal("#6366f1");
  const [isLoading, setIsLoading] = createSignal(false);
  const { showToast } = useToast();

  const predefinedColors = [
    "#6366f1", // indigo
    "#8b5cf6", // violet
    "#ec4899", // pink
    "#ef4444", // red
    "#f97316", // orange
    "#eab308", // yellow
    "#22c55e", // green
    "#06b6d4", // cyan
    "#3b82f6", // blue
    "#6b7280", // gray
  ];

  // Update form when folder changes
  createEffect(() => {
    const folder = props.folder;
    if (folder) {
      setFolderName(folder.name);
      setFolderColor(folder.color || "#6366f1");
    }
  });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    
    const name = folderName().trim();
    if (!name) {
      showToast("Please enter a folder name", "error");
      return;
    }

    if (!props.folder) return;

    setIsLoading(true);
    try {
      props.onUpdateFolder(props.folder.id, name, folderColor());
      showToast("Folder updated successfully", "success");
      handleClose();
    } catch (error) {
      showToast("Failed to update folder", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setIsLoading(false);
    props.onClose();
  };

  const handleDelete = () => {
    if (!props.folder) return;
    
    const confirmed = confirm(`Are you sure you want to delete the folder "${props.folder.name}"? All spaces will be moved back to the main list.`);
    if (confirmed) {
      props.onDeleteFolder(props.folder.id);
      showToast("Folder deleted successfully", "success");
      handleClose();
    }
  };

  return (
    <Modal isOpen={props.isOpen} onClose={handleClose}>
      <div class="space-y-6">
        <div class="text-center">
          <h2 class="text-xl font-semibold text-text-primary mb-2">Folder Settings</h2>
          <p class="text-text-secondary text-sm">Edit folder name and color</p>
        </div>

        <form onSubmit={handleSubmit} class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-text-primary mb-2">
              Folder Name
            </label>
            <input
              type="text"
              value={folderName()}
              onInput={(e) => setFolderName(e.currentTarget.value)}
              placeholder="Enter folder name"
              class="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-text-primary placeholder-text-secondary"
              maxLength={32}
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-text-primary mb-2">
              Folder Color
            </label>
            <div class="grid grid-cols-5 gap-2">
              {predefinedColors.map((color) => (
                <button
                  type="button"
                  class={`w-8 h-8 rounded-full border-2 transition-all ${
                    folderColor() === color
                      ? "border-text-primary scale-110"
                      : "border-border hover:border-text-secondary"
                  }`}
                  style={{ "background-color": color }}
                  onClick={() => setFolderColor(color)}
                />
              ))}
            </div>
          </div>

          <div class="space-y-3 pt-4">
            <div class="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                class="flex-1 px-4 py-2 text-text-secondary hover:text-text-primary border border-border hover:border-text-secondary rounded-lg transition-colors"
                disabled={isLoading()}
              >
                Cancel
              </button>
              <button
                type="submit"
                class="flex-1 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading() || !folderName().trim()}
              >
                {isLoading() ? "Updating..." : "Update Folder"}
              </button>
            </div>
            <button
              type="button"
              onClick={handleDelete}
              class="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading()}
            >
              Delete Folder
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default FolderSettingsModal;