import { Component, createSignal, Show, createEffect } from "solid-js";
// import { useAuth } from "../../lib/providers/auth/AuthProvider";
// import { useCache } from "../../lib/providers/cache/CacheProvider";
import Modal from "./Modal";
// import { Avatar } from "../common/Avatar";
import { BASE_URL, FS_URL } from "../../constants";
import { RoomWithRecipients } from "../../types/rooms";
// import { StatusIndicator, UserStatus } from "../common/StatusIndicator";

interface GroupManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: RoomWithRecipients;
}

export const GroupManagementModal: Component<GroupManagementModalProps> = (props) => {
  // const { user } = useAuth();
  // const cache = useCache();
  const [groupName, setGroupName] = createSignal(props.room.name || "");
  const [groupTopic, setGroupTopic] = createSignal(props.room.topic || "");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [iconFile, setIconFile] = createSignal<File | null>(null);
  const [iconPreview, setIconPreview] = createSignal<string | null>(null);

  // Update form fields when room changes
  createEffect(() => {
    setGroupName(props.room.name || "");
    setGroupTopic(props.room.topic || "");
    setIconFile(null);
    setIconPreview(null);
    setError("");
  });

  // Handle icon file selection
  const handleIconChange = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError("Icon file must be smaller than 5MB");
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        setError("Please select an image file");
        return;
      }
      
      setIconFile(() => file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setIconPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle saving group settings
  const handleSaveSettings = async () => {
    setLoading(true);
    setError("");
    
    try {
      const updateData: any = {};
      
      // Add name and topic if changed
      if (groupName().trim() !== props.room.name) {
        updateData.name = groupName().trim();
      }
      
      if (groupTopic().trim() !== (props.room.topic || '')) {
        updateData.topic = groupTopic().trim();
      }
      
      // Only proceed if there are changes to make
      if (Object.keys(updateData).length === 0 && !iconFile()) {
        props.onClose();
        return;
      }
      
      // Update room settings (name/topic)
      if (Object.keys(updateData).length > 0) {
        const response = await fetch(`${BASE_URL}/rooms/${props.room.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Token': localStorage.getItem('sc_token') || '',
          },
          body: JSON.stringify(updateData)
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to update group settings');
        }
      }
      
      // Handle icon upload separately
      if (iconFile()) {
        const formData = new FormData();
        formData.append('icon', iconFile()!);
        
        const response = await fetch(`${FS_URL}/api/v1/rooms/${props.room.id}/icon`, {
          method: 'POST',
          headers: {
            'X-Session-Token': localStorage.getItem('sc_token') || '',
          },
          body: formData
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to upload icon');
        }
      }
      
      props.onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // // Handle removing a member from the group
  // const handleRemoveMember = async (memberId: string) => {
  //   setError("");
  //   setLoading(true);

  //   try {
  //     const token = localStorage.getItem('session_token');
  //     const response = await fetch(`${BASE_URL}/rooms/${props.room.id}/members`, {
  //       method: "DELETE",
  //       headers: {
  //         'Content-Type': 'application/json',
  //         'X-Session-Token': token || '',
  //       },
  //       body: JSON.stringify({ user_id: memberId }),
  //     });

  //     if (!response.ok) {
  //       const errorData = await response.json();
  //       throw new Error(errorData.message || "Failed to remove member");
  //     }

  //     // Optionally refresh the room data or update the cache
  //   } catch (err) {
  //     setError(err instanceof Error ? err.message : "An error occurred");
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  // const renderUserItem = (friend: any, isSelected: boolean, onToggle: () => void, showRemove = false) => (
  //   <div
  //     class={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
  //       isSelected
  //         ? "bg-primary bg-opacity-20 border border-primary border-opacity-30"
  //         : "hover:bg-surface hover:bg-opacity-10"
  //     }`}
  //     onClick={onToggle}
  //   >
  //     <div class="relative flex-shrink-0">
  //       <div class="w-10 h-10 rounded-full overflow-hidden">
  //         <Avatar
  //           userId={friend.id}
  //           avatar={friend.avatar}
  //           alt={`${friend.display_name}'s avatar`}
  //         />
  //       </div>
  //       <StatusIndicator
  //         status={(friend.presence?.status || "offline") as UserStatus}
  //         class="absolute -bottom-0.5 -right-0.5 border-2 border-background1"
  //       />
  //     </div>
  //     <div class="flex-1 min-w-0">
  //       <div class="text-sm font-medium text-text-primary truncate">
  //         {friend.display_name}
  //       </div>
  //       <div class="text-xs text-text-secondary truncate">
  //         {friend.username}#{friend.discriminator}
  //       </div>
  //     </div>
  //     {showRemove && (
  //       <button
  //         class={`p-1 rounded-md transition-colors ${
  //           friend.id === user()?.id
  //             ? "text-gray-500 cursor-not-allowed"
  //             : "hover:bg-red-500 hover:bg-opacity-20 text-red-400 hover:text-red-300"
  //         }`}
  //         onClick={(e) => {
  //           e.stopPropagation();
  //           if (friend.id !== user()?.id) {
  //             handleRemoveMember(friend.id);
  //           }
  //         }}
  //         disabled={loading() || friend.id === user()?.id}
  //         title={friend.id === user()?.id ? "Cannot remove yourself" : "Remove member"}
  //       >
  //         <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  //           <line x1="18" y1="6" x2="6" y2="18"></line>
  //           <line x1="6" y1="6" x2="18" y2="18"></line>
  //         </svg>
  //       </button>
  //     )}
  //   </div>
  // );

  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose}>
      <div class="space-y-4">
        <div>
          <h3 class="text-xl font-semibold text-text-primary mb-1">
            Group Settings
          </h3>
          <p class="text-sm text-text-secondary">
            Manage group settings and members
          </p>
        </div>

        {/* Error Display */}
        <Show when={error()}>
          <div class="p-3 bg-red-500 bg-opacity-20 border border-red-500 border-opacity-30 rounded-lg">
            <p class="text-sm text-red-400">{error()}</p>
          </div>
        </Show>

        {/* Group Icon */}
        <div class="space-y-2">
          <label class="block text-sm font-medium text-text-primary">Group Icon</label>
          <div class="flex items-start gap-3">
            <div class="w-12 h-12 rounded-full overflow-hidden bg-surface border border-border flex items-center justify-center flex-shrink-0">
              <Show 
                when={iconPreview() || props.room.icon} 
                fallback={
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                }
              >
                <img 
                  src={iconPreview() || `${FS_URL}/icons/${props.room.id}/${props.room.icon}`} 
                  alt="Group icon" 
                  class="w-full h-full object-cover"
                />
              </Show>
            </div>
            <div class="flex-1 min-w-0">
              <input
                type="file"
                accept="image/*"
                onChange={handleIconChange}
                class="block w-full text-sm text-text-secondary file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-primary file:text-white hover:file:bg-primary-hover file:cursor-pointer cursor-pointer"
              />
              <p class="text-xs text-text-secondary mt-1">PNG, JPG up to 5MB</p>
            </div>
          </div>
        </div>

        {/* Group Name */}
        <div class="space-y-2">
          <label class="block text-sm font-medium text-text-primary">Group Name</label>
          <input
            type="text"
            value={groupName()}
            onInput={(e) => setGroupName(e.currentTarget.value)}
            placeholder="Enter group name"
            class="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        {/* Group Topic */}
        <div class="space-y-2">
          <label class="block text-sm font-medium text-text-primary">Group Topic</label>
          <textarea
            value={groupTopic()}
            onInput={(e) => setGroupTopic(e.currentTarget.value)}
            placeholder="Enter group topic (optional)"
            rows={2}
            class="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
          />
        </div>

        {/* Save Settings Button */}
        <div class="flex justify-end gap-3 pt-2">
          <button
            onClick={props.onClose}
            class="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveSettings}
            disabled={loading()}
            class="px-4 py-2 bg-primary hover:bg-primary-dark disabled:bg-surface disabled:bg-opacity-20 disabled:text-text-secondary text-white text-sm font-medium rounded-lg transition-colors"
          >
            {loading() ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </Modal>
  );
};