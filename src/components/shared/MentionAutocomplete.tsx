import { Component, createSignal, For, Show, onCleanup, createEffect } from "solid-js";
import { Portal } from "solid-js/web";
import { useCache, User } from "../../lib/providers/cache/CacheProvider";
import { useAuth } from "../../lib/providers/auth/AuthProvider";
import { Avatar } from "../common/Avatar";
import { RoomWithRecipients } from "../../types/rooms";
import { SpaceRole } from "../../lib/cache/SpaceCache";

interface MentionAutocompleteProps {
  type: 'user' | 'role' | 'room';
  query: string;
  position: { top: number; left: number; width?: number };
  onSelect: (id: string, displayName: string, type: 'user' | 'role' | 'room') => void;
  onClose: () => void;
  currentRoomId?: string; // Current room ID for context
}

export const MentionAutocomplete: Component<MentionAutocompleteProps> = (props) => {
  const cache = useCache();
  const { rooms } = useAuth();
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [filteredItems, setFilteredItems] = createSignal<(User | RoomWithRecipients | SpaceRole)[]>([]);
  let autocompleteRef: HTMLDivElement | undefined;

  // Filter items based on query and type
  createEffect(() => {
    const query = props.query.toLowerCase();
    if (query.length === 0) {
      setFilteredItems([]);
      return;
    }

    let items: any[] = [];
    
    // Get current room context if available
    const currentRoomId = props.currentRoomId;
    const currentRoom = currentRoomId ? cache.getRoom(currentRoomId) : undefined;
    
    if (props.type === 'user') {
      // Get all users from cache
      const allUsers = cache.users();
      const usersList = Object.values(allUsers);
      
      // Filter users based on current room context
      if (currentRoom) {
        if (currentRoom.type === 0 || currentRoom.type === 1) { // PM or GROUP_PM
          // For PMs, only show recipients of the room
          const recipients = currentRoom.recipients || [];
          items = usersList.filter((user: User) => 
            recipients.includes(user.id) && (
              user.username.toLowerCase().includes(query) || 
              (user.display_name && user.display_name.toLowerCase().includes(query))
            )
          ).slice(0, 8);
        } else if (currentRoom.space_id) { // Space rooms
          // For space rooms, only show members of that space
          const spaceMembers = cache.getSpaceMembers(currentRoom.space_id);
          const spaceMemberIds = spaceMembers.map(member => member.user_id);
          items = usersList.filter((user: User) => 
            spaceMemberIds.includes(user.id) && (
              user.username.toLowerCase().includes(query) || 
              (user.display_name && user.display_name.toLowerCase().includes(query))
            )
          ).slice(0, 8);
        } else {
          // Fallback to all users if no context available
          items = usersList.filter((user: User) => 
            user.username.toLowerCase().includes(query) || 
            (user.display_name && user.display_name.toLowerCase().includes(query))
          ).slice(0, 8);
        }
      } else {
        // Fallback to all users if no room context
        items = usersList.filter((user: User) => 
          user.username.toLowerCase().includes(query) || 
          (user.display_name && user.display_name.toLowerCase().includes(query))
        ).slice(0, 8);
      }
    } 
    else if (props.type === 'role') {
      // Get all roles from cache - for now, we'll skip this as we need current room context
      // TODO: Add proper room context to get space roles
      items = [];
    } 
    else if (props.type === 'room') {
      // Get all rooms from auth provider
      const allRooms = rooms();
      
      // Filter rooms based on current room context
      if (currentRoom && currentRoom.space_id) {
        // For space rooms, only show rooms in that space
        items = allRooms.filter((room: RoomWithRecipients) => 
          room.space_id === currentRoom.space_id && 
          room.name && room.name.toLowerCase().includes(query)
        ).slice(0, 8);
      } else {
        // Fallback to all rooms if no context available
        items = allRooms.filter((room: RoomWithRecipients) => 
          room.name && room.name.toLowerCase().includes(query)
        ).slice(0, 8);
      }
    }

    setFilteredItems(items);
    setSelectedIndex(0); // Reset selection when results change
  });

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    if (filteredItems().length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredItems().length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev === 0 ? filteredItems().length - 1 : prev - 1);
        break;
      case 'Enter':
        e.preventDefault();
        const selectedItem = filteredItems()[selectedIndex()];
        if (selectedItem) {
          let displayName: string;
          let id: string;
          
          if (props.type === 'user') {
            const user = selectedItem as User;
            displayName = user.display_name || user.username;
            id = user.id;
          } else if (props.type === 'room') {
            const room = selectedItem as RoomWithRecipients;
            displayName = room.name;
            id = room.id;
          } else {
            // SpaceRole case - TODO: implement proper role handling
            displayName = 'Role';
            id = 'role-id';
          }
          
          props.onSelect(id, displayName, props.type);
        }
        break;
      case 'Escape':
        e.preventDefault();
        props.onClose();
        break;
    }
  };

  // Handle click outside to close
  const handleClickOutside = (e: MouseEvent) => {
    if (autocompleteRef && !autocompleteRef.contains(e.target as Node)) {
      props.onClose();
    }
  };

  // Add event listeners
  createEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
  });

  // Cleanup on unmount
  onCleanup(() => {
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('mousedown', handleClickOutside);
  });

  return (
    <Show when={filteredItems().length > 0}>
      <Portal>
        <div
          ref={autocompleteRef}
          class="fixed z-50 bg-background1 border border-border rounded-lg shadow-lg"
          style={{
            top: `${props.position.top}px`,
            left: `${props.position.left}px`,
            width: props.position.width ? `${props.position.width}px` : '256px',
          }}
        >
          <div class="p-2">
            <div class="text-xs text-text-secondary mb-2 px-2">
              {props.type === 'user' ? 'User' : props.type === 'role' ? 'Role' : 'Room'} suggestions
            </div>
            <div class="max-h-48 overflow-y-auto">
              <For each={filteredItems()}>
                {(item, index) => {
                  let displayName: string;
                  let id: string;
                  let username: string = '';
                  
                  if (props.type === 'user') {
                    const user = item as User;
                    displayName = user.display_name || user.username;
                    id = user.id;
                    username = user.username;
                  } else if (props.type === 'room') {
                    const room = item as RoomWithRecipients;
                    displayName = room.name;
                    id = room.id;
                  } else {
                    // SpaceRole case - TODO: implement proper role handling
                    displayName = 'Role';
                    id = 'role-id';
                  }
                  
                  return (
                    <button
                      class={`w-full flex items-center gap-3 px-2 py-2 rounded hover:bg-surface transition-colors text-left ${
                        index() === selectedIndex() ? 'bg-surface' : ''
                      }`}
                      onClick={() => props.onSelect(id, displayName, props.type)}
                      onMouseEnter={() => setSelectedIndex(index())}
                    >
                      {props.type === 'user' && (
                        <Avatar
                          userId={id}
                          avatar={(item as User).avatar}
                          alt={displayName}
                          size="sm"
                          class="w-6 h-6 flex-shrink-0"
                        />
                      )}
                      {props.type === 'role' && (
                        <div 
                          class="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center"
                          style={{ "background-color": (item as SpaceRole).color || '#99AAB5' }}
                        >
                          <span class="text-xs text-white">R</span>
                        </div>
                      )}
                      {props.type === 'room' && (
                        <div class="w-6 h-6 rounded-full bg-surface flex-shrink-0 flex items-center justify-center">
                          <span class="text-xs">#</span>
                        </div>
                      )}
                      <div class="flex-1 min-w-0">
                        <div class="text-sm font-medium text-text-primary truncate">
                          {props.type === 'user' ? '@' : props.type === 'role' ? '@&' : '#'}{displayName}
                        </div>
                        <div class="text-xs text-text-secondary truncate">
                          {props.type === 'user' ? username : props.type === 'role' ? 'Role' : 'Room'}
                        </div>
                      </div>
                    </button>
                  );
                }}
              </For>
            </div>
            <Show when={filteredItems().length === 8}>
              <div class="text-xs text-text-secondary mt-2 px-2">
                Type more to narrow results
              </div>
            </Show>
          </div>
        </div>
      </Portal>
    </Show>
  );
};