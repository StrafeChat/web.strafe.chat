import { Component, createSignal, createEffect } from 'solid-js';
import { useAuth } from '../../lib/providers/auth/AuthProvider';
import { useToast } from '../common/Toast';
import Modal from './Modal';
import { BASE_URL } from '../../constants';

interface CreateSectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
}

const CreateSectionModal: Component<CreateSectionModalProps> = (props) => {
  const { spaces } = useAuth();
  const { showToast } = useToast();
  const [sectionName, setSectionName] = createSignal('');
  const [isLoading, setIsLoading] = createSignal(false);

  const space = () => spaces()?.find(s => s.id === props.spaceId);

  createEffect(() => {
    if (props.isOpen) {
      // Reset form when modal opens
      setSectionName('');
    }
  });

  const handleCreateSection = async () => {
    if (!sectionName().trim()) {
      showToast('Section name is required', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const requestBody = {
        name: sectionName().trim(),
        type: 4 // Section type
      };

      const response = await fetch(`${BASE_URL}/spaces/${props.spaceId}/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': localStorage.getItem('sc_token') || ''
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        await response.json();
        showToast('Section created successfully!', 'success');
        props.onClose();
      } else {
        const errorData = await response.json();
        showToast(errorData.error || 'Failed to create section', 'error');
      }
    } catch (error) {
      console.error('Error creating section:', error);
      showToast('Failed to create section', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    handleCreateSection();
  };

  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose}>
      <div class="space-y-6">
        <div>
          <h3 class="text-xl font-semibold text-text-primary mb-6">
            Create Section
          </h3>
        </div>

        {/* Space Info */}
        <div class="mb-4">
          <p class="text-sm text-text-secondary">
            Creating section in <span class="text-text-primary font-medium">{space()?.name}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Section Name */}
          <div class="mb-6">
            <label class="block text-sm font-medium text-text-primary mb-2">
              Section Name *
            </label>
            <input
              type="text"
              value={sectionName()}
              onInput={(e) => setSectionName(e.currentTarget.value)}
              placeholder="Enter section name"
              class="w-full px-4 py-2.5 bg-background border-2 border-border rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-text-secondary"
              maxLength={100}
              required
            />
          </div>

          {/* Action Buttons */}
          <div class="flex justify-end gap-3">
            <button
              type="button"
              onClick={props.onClose}
              class="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
              disabled={isLoading()}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading() || !sectionName().trim()}
              class="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading() && (
                <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              Create Section
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default CreateSectionModal;