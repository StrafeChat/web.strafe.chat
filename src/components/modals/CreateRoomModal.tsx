import { Component, createSignal, createEffect, Show } from 'solid-js';
import { useAuth } from '../../lib/providers/auth/AuthProvider';
import { useToast } from '../common/Toast';
import { useCache } from '../../lib/providers/cache/CacheProvider';
import { SpaceRole } from '../../lib/cache/SpaceCache';
import Modal from './Modal';
import ToggleSwitch from '../shared/ToggleSwitch';
import { BASE_URL } from '../../constants';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  parentId?: string; // Section ID if creating room in a section
}



const CreateRoomModal: Component<CreateRoomModalProps> = (props) => {
  const { spaces } = useAuth();
  const { showToast } = useToast();
  const cache = useCache();
  const [step, setStep] = createSignal(1); // 1: Room type and name, 2: Role selection for private rooms
  const [roomName, setRoomName] = createSignal('');
  const [roomType, setRoomType] = createSignal<2 | 3>(2); // 2 = Text Room, 3 = Voice Room
  const [topic, setTopic] = createSignal('');
  const [isPrivate, setIsPrivate] = createSignal(false);
  const [selectedRoles, setSelectedRoles] = createSignal<string[]>([]);
  const [isLoading, setIsLoading] = createSignal(false);

  const space = () => spaces()?.find(s => s.id === props.spaceId);

  createEffect(() => {
    if (props.isOpen) {
      // Reset form when modal opens
      setStep(1);
      setRoomName('');
      setRoomType(2);
      setTopic('');
      setIsPrivate(false);
      setSelectedRoles([]);
    }
  });

  // Get available roles from cache
  const availableRoles = () => {
    const cachedRoles = cache.getCachedSpaceRoles(props.spaceId) || [];
    // Filter out @everyone role as it's automatically assigned
    return cachedRoles.filter(role => role.name !== "@everyone");
  };



  const handleNext = () => {
    if (step() === 1 && isPrivate()) {
      setStep(2);
    } else {
      handleCreateRoom();
    }
  };

  const handleBack = () => {
    setStep(1);
  };

  const handleCreateRoom = async () => {
    if (!roomName().trim()) {
      showToast('Room name is required', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const requestBody = {
        name: roomName().trim(),
        type: roomType(),
        topic: topic().trim() || undefined,
        parent_id: props.parentId || undefined,
        is_private: isPrivate(),
        allowed_roles: isPrivate() ? selectedRoles() : undefined
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
        showToast(`${roomType() === 2 ? 'Text' : 'Voice'} room created successfully!`, 'success');
        props.onClose();
      } else {
        const errorData = await response.json();
        showToast(errorData.error || 'Failed to create room', 'error');
      }
    } catch (error) {
      console.error('Error creating room:', error);
      showToast('Failed to create room', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRoleSelection = (roleId: string) => {
    setSelectedRoles(prev => 
      prev.includes(roleId) 
        ? prev.filter(id => id !== roleId)
        : [...prev, roleId]
    );
  };



  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose}>
      <div class="space-y-6">
        <div>
          <h3 class="text-xl font-semibold text-text-primary mb-6">
            {step() === 1 ? 'Create Room' : 'Select Roles'}
          </h3>
        </div>

        <Show when={step() === 1}>
          {/* Space Info */}
          <div class="mb-4">
            <p class="text-sm text-text-secondary">
              Creating room in <span class="text-text-primary font-medium">{space()?.name}</span>
              <Show when={props.parentId}>
                <span class="text-text-secondary"> → Section</span>
              </Show>
            </p>
          </div>

          {/* Room Type Selection */}
          <div class="mb-6">
            <label class="block text-sm font-medium text-text-primary mb-3">
              Room Type
            </label>
            <div class="relative bg-surface rounded-lg p-1 flex">
              <div 
                class={`absolute top-1 bottom-1 bg-primary rounded-md transition-all duration-300 ease-in-out ${
                  roomType() === 2 ? 'left-1 right-1/2 mr-0.5' : 'left-1/2 right-1 ml-0.5'
                }`}
              />
              <button
                type="button"
                onClick={() => setRoomType(2)}
                class={`relative z-10 flex-1 py-2 px-3 rounded-md transition-all duration-200 flex items-center justify-center gap-2 ${
                  roomType() === 2 ? 'text-white' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="4" y1="9" x2="20" y2="9"></line>
                  <line x1="4" y1="15" x2="20" y2="15"></line>
                  <line x1="10" y1="3" x2="8" y2="21"></line>
                  <line x1="16" y1="3" x2="14" y2="21"></line>
                </svg>
                <span class="text-sm font-medium">Text</span>
              </button>
              <button
                type="button"
                onClick={() => setRoomType(3)}
                class={`relative z-10 flex-1 py-2 px-3 rounded-md transition-all duration-200 flex items-center justify-center gap-2 ${
                  roomType() === 3 ? 'text-white' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                  <path d="M19 10v1a7 7 0 0 1-14 0v-1"></path>
                  <line x1="12" y1="19" x2="12" y2="23"></line>
                  <line x1="8" y1="23" x2="16" y2="23"></line>
                </svg>
                <span class="text-sm font-medium">Voice</span>
              </button>
            </div>
          </div>

          {/* Room Name */}
          <div class="mb-4">
            <label class="block text-sm font-medium text-text-primary mb-2">
              Room Name *
            </label>
            <input
              type="text"
              value={roomName()}
              onInput={(e) => setRoomName(e.currentTarget.value)}
              placeholder="Enter room name"
              class="w-full px-4 py-2.5 bg-background border-2 border-border rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-text-secondary"
              maxLength={100}
            />
          </div>

          {/* Room Topic */}
          <div class="mb-4">
            <label class="block text-sm font-medium text-text-primary mb-2">
              Topic (Optional)
            </label>
            <input
              type="text"
              value={topic()}
              onInput={(e) => setTopic(e.currentTarget.value)}
              placeholder="What's this room about?"
              class="w-full px-4 py-2.5 bg-background border-2 border-border rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-text-secondary"
              maxLength={1024}
            />
          </div>

          {/* Private Room Toggle */}
          <div class="mb-6">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <circle cx="12" cy="16" r="1"></circle>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <span class="text-sm font-medium text-text-primary">Private Room</span>
              </div>
              <ToggleSwitch
                checked={isPrivate()}
                onChange={setIsPrivate}
              />
            </div>
            <Show when={isPrivate()}>
              <p class="text-xs text-text-secondary mt-2">
                Only selected roles will be able to access this room
              </p>
            </Show>
          </div>
        </Show>

        <Show when={step() === 2}>
          {/* Role Selection */}
          <div class="mb-6">
            <p class="text-sm text-text-secondary mb-4">
              Select which roles can access this private room:
            </p>
            
            <Show when={availableRoles().length === 0} fallback={
              <div class="space-y-3 max-h-60 overflow-y-auto">
                {availableRoles().map((role: SpaceRole) => (
                  <div class="flex items-center justify-between p-3 rounded-lg bg-surface hover:bg-opacity-80 transition-colors">
                    <div class="flex items-center space-x-3">
                      <div
                        class="w-3 h-3 rounded-full"
                        style={{ "background-color": role.color || "#99aab5" }}
                      />
                      <span class="text-sm font-medium text-text-primary">{role.name}</span>
                    </div>
                    <ToggleSwitch
                      checked={selectedRoles().includes(role.role_id)}
                      onChange={() => toggleRoleSelection(role.role_id)}
                    />
                  </div>
                ))}
              </div>
            }>
              <div class="text-center py-4">
                <div class="text-text-secondary">No roles available to assign.</div>
              </div>
            </Show>
          </div>
        </Show>

        {/* Footer */}
        <div class="border-t border-border pt-4">
          <div class="flex justify-end gap-3">
            <Show when={step() === 2}>
              <button
                onClick={handleBack}
                class="px-4 py-2.5 text-text-primary hover:bg-surface rounded-md transition-colors font-medium"
              >
                Back
              </button>
            </Show>
            <button
              onClick={props.onClose}
              class="px-4 py-2.5 text-text-primary hover:bg-surface rounded-md transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleNext}
              disabled={isLoading() || !roomName().trim()}
              class="px-4 py-2.5 bg-primary text-text-primary rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 font-medium"
            >
              {isLoading() ? 'Creating...' : (step() === 1 && isPrivate() ? 'Next' : 'Create Room')}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default CreateRoomModal;