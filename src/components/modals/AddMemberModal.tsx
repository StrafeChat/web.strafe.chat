import { Component, createSignal, createMemo, Show, For } from "solid-js";
import { useAuth } from "../../lib/providers/auth/AuthProvider";
import { useCache } from "../../lib/providers/cache/CacheProvider";
import Modal from "./Modal";
import { BASE_URL } from "../../constants";
import { RoomWithRecipients } from "../../types/rooms";
import { Avatar } from "../common/Avatar";
import { StatusIndicator, UserStatus } from "../common/StatusIndicator";

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: RoomWithRecipients;
}

export const AddMemberModal: Component<AddMemberModalProps> = (props) => {
  const { relationships } = useAuth();
  const cache = useCache();
  const [searchTerm, setSearchTerm] = createSignal("");
  const [selectedFriends, setSelectedFriends] = createSignal<string[]>([]);
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  // Get friends that are not already in the room
  const availableFriends = createMemo(() => {
    const relationshipIds = relationships() || [];
    const roomMembers = props.room.recipients || [];
    
    // Convert relationship IDs to User objects using cache
    const friends = relationshipIds
      .map(id => cache.getUser(id))
      .filter(user => user !== undefined);
    
    return friends.filter(friend => 
      !roomMembers.includes(friend.id) &&
      (friend.display_name?.toLowerCase().includes(searchTerm().toLowerCase()) ||
       friend.username?.toLowerCase().includes(searchTerm().toLowerCase()))
    );
  });

  const toggleFriendSelection = (friendId: string) => {
    setSelectedFriends(prev => 
      prev.includes(friendId) 
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };

  const handleAddMembers = async () => {
    if (selectedFriends().length === 0) return;
    
    setLoading(true);
    setError("");
    
    try {
      const response = await fetch(`${BASE_URL}/rooms/${props.room.id}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': localStorage.getItem("sc_token") || "",
        },
        body: JSON.stringify({
          user_ids: selectedFriends()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add members');
      }

      setSelectedFriends([]);
      setSearchTerm("");
      props.onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Reset state when modal closes
  const handleClose = () => {
    setSelectedFriends([]);
    setSearchTerm("");
    setError("");
    props.onClose();
  };

  return (
    <Modal isOpen={props.isOpen} onClose={handleClose}>
      <div class="space-y-4">
        {/* Error display */}
        <Show when={error()}>
          <div class="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error()}
          </div>
        </Show>

        {/* Search input */}
        <div class="relative">
          <input
            type="text"
            placeholder="Search friends..."
            value={searchTerm()}
            onInput={(e) => setSearchTerm(e.currentTarget.value)}
            class="w-full pl-10 pr-4 py-2 bg-surface border border-border rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-secondary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        {/* Selected friends display */}
        <Show when={selectedFriends().length > 0}>
          <div class="space-y-2">
            <p class="text-sm font-medium text-text-primary">
              Selected ({selectedFriends().length})
            </p>
            <div class="flex flex-wrap gap-2">
              <For each={selectedFriends()}>
                {(friendId) => {
                  const friend = availableFriends().find(f => f.id === friendId);
                  return (
                    <div class="flex items-center gap-2 px-3 py-1 bg-primary bg-opacity-20 rounded-full">
                      <span class="text-sm text-text-primary">
                        {friend?.display_name || friend?.username || "Unknown"}
                      </span>
                      <button
                        onClick={() => toggleFriendSelection(friendId)}
                        class="text-text-secondary hover:text-text-primary"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  );
                }}
              </For>
            </div>
          </div>
        </Show>

        {/* Available friends list */}
        <div class="space-y-2">
          <p class="text-sm font-medium text-text-primary">
            Available Friends
          </p>
          <div class="max-h-60 overflow-y-auto space-y-1">
            <For each={availableFriends()}>
              {(friend) => (
                <div
                  class={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedFriends().includes(friend.id)
                      ? "bg-primary bg-opacity-20 border border-primary border-opacity-30"
                      : "hover:bg-surface hover:bg-opacity-10"
                  }`}
                  onClick={() => toggleFriendSelection(friend.id)}
                >
                  <Avatar
                    userId={friend.id}
                    avatar={friend.avatar}
                    alt={friend.display_name || friend.username}
                    size="sm"
                  />
                  <div class="flex-1">
                    <p class="text-sm font-medium text-text-primary">
                      {friend.display_name || friend.username}
                    </p>
                    <Show when={friend.presence?.status}>
                      <div class="flex items-center gap-1">
                        <StatusIndicator
                          status={friend.presence!.status as UserStatus}
                        />
                        <span class="text-xs text-text-secondary">
                          {friend.presence?.custom_status || 
                           (friend.presence?.status && friend.presence.status.charAt(0).toUpperCase() + friend.presence.status.slice(1))}
                        </span>
                      </div>
                    </Show>
                  </div>
                  <Show when={selectedFriends().includes(friend.id)}>
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                  </Show>
                </div>
              )}
            </For>
            <Show when={availableFriends().length === 0}>
              <div class="text-center py-8 text-text-secondary">
                <p class="text-sm">
                  {searchTerm() ? "No friends found matching your search." : "No friends available to add."}
                </p>
              </div>
            </Show>
          </div>
        </div>

        {/* Add members button */}
        <div class="flex justify-end gap-2">
          <button
            onClick={handleClose}
            class="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAddMembers}
            disabled={selectedFriends().length === 0 || loading()}
            class="px-4 py-2 bg-primary hover:bg-primary-dark disabled:bg-surface disabled:bg-opacity-20 disabled:text-text-secondary text-white text-sm font-medium rounded-lg transition-colors"
          >
            {loading() ? "Adding..." : `Add ${selectedFriends().length} Member${selectedFriends().length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </Modal>
  );
};