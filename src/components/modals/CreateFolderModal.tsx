import { Component, createSignal } from "solid-js";
import Modal from "./Modal";
import { useToast } from "../common/Toast";

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateFolder: (name: string, color: string) => void;
}

const CreateFolderModal: Component<CreateFolderModalProps> = (props) => {
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

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    
    const name = folderName().trim();
    if (!name) {
      showToast("Please enter a folder name", "error");
      return;
    }

    setIsLoading(true);
    try {
      props.onCreateFolder(name, folderColor());
      showToast("Folder created successfully", "success");
      handleClose();
    } catch (error) {
      showToast("Failed to create folder", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setFolderName("");
    setFolderColor("#6366f1");
    setIsLoading(false);
    props.onClose();
  };

  return (
    <Modal isOpen={props.isOpen} onClose={handleClose}>
      <div class="space-y-6">
        <div class="text-center">
          <h2 class="text-xl font-semibold text-text-primary mb-2">Create Folder</h2>
          <p class="text-text-secondary text-sm">Organize your spaces into folders</p>
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

          <div class="flex gap-3 pt-4">
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
              {isLoading() ? "Creating..." : "Create Folder"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default CreateFolderModal;