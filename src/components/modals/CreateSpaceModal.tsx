import { Component, createSignal } from "solid-js";
import { API_ENDPOINTS, API_HEADERS } from "../../lib/providers/auth/AuthProvider";
import Modal from "./Modal";

interface CreateSpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateSpaceModal: Component<CreateSpaceModalProps> = (props) => {
  const [name, setName] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal("");

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    
    if (!name().trim()) {
      setError("Space name is required");
      return;
    }
    
    if (name().length < 2 || name().length > 100) {
      setError("Space name must be between 2 and 100 characters");
      return;
    }
    
    setIsLoading(true);
    setError("");
    
    try {
      const payload: any = {
        name: name().trim()
      };
      
      if (description().trim()) {
        payload.description = description().trim();
      }
      
      const response = await fetch(API_ENDPOINTS.SPACES, {
        method: "POST",
        headers: {
          ...API_HEADERS.JSON,
          ...API_HEADERS.SESSION(),
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create space");
      }
      
      const spaceData = await response.json();
      console.log("Space created:", spaceData);
      
      // Reset form
      setName("");
      setDescription("");
      props.onClose();
      
    } catch (err: any) {
      console.error("Failed to create space:", err);
      setError(err.message || "Failed to create space");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleClose = () => {
    if (!isLoading()) {
      setName("");
      setDescription("");
      setError("");
      props.onClose();
    }
  };

  return (
    <Modal isOpen={props.isOpen} onClose={handleClose}>
      <div class="space-y-6">
        <div>
          <h3 class="text-xl font-semibold text-text-primary mb-6">
            Create Space
          </h3>
        </div>
        <form onSubmit={handleSubmit} class="space-y-6">
          <div>
            <label
              for="space-name"
              class="block text-sm font-medium mb-2 text-text-primary"
            >
              Space Name *
            </label>
            <input
              id="space-name"
              type="text"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              class="w-full px-4 py-2.5 bg-background border-2 border-border rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-text-secondary"
              placeholder="Enter space name"
              disabled={isLoading()}
              maxLength={100}
            />
          </div>
          
          <div class="border-t border-border pt-4">
            {error() && (
              <div class="text-sm text-error bg-error/10 px-4 py-2.5 rounded-md mb-4">
                {error()}
              </div>
            )}
            <div class="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                class="px-4 py-2.5 text-text-primary hover:bg-surface rounded-md transition-colors font-medium"
                disabled={isLoading()}
              >
                Cancel
              </button>
              <button
                type="submit"
                class="px-4 py-2.5 bg-primary text-text-primary rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 font-medium"
                disabled={isLoading() || !name().trim()}
              >
                {isLoading() ? "Creating..." : "Create Space"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}