import { Component, Show, createMemo, For, createSignal, createEffect } from "solid-js";
import { useAuth } from "../../../lib/providers/auth/AuthProvider";
// import { useCache } from "../../../lib/providers/cache/CacheProvider";
import { ClientUserArea } from "../../shared/ClientUserArea";
import { FS_URL, BASE_URL } from "../../../constants";
import Home from "../../shared/icons/Home";
import { A, useNavigate, useLocation } from "@solidjs/router";
import { RoomType } from "../../../types/roomTypes";
import { Room, RoomWithRecipients } from "../../../types/rooms";
import { SpaceHeaderDropdown } from "./SpaceHeaderDropdown";
import { api } from "../../../lib/api";

interface RoomsListProps {
  spaceId?: string;
  currentSpace?: any;
}

// Global drag state
const [globalDragState, setGlobalDragState] = createSignal<{
  isDragging: boolean;
  draggedId: string | null;
  draggedType: 'room' | 'section' | null;
  dragOverId: string | null;
  dragOverType: 'room' | 'section' | 'zone' | null;
}>({ 
  isDragging: false, 
  draggedId: null, 
  draggedType: null, 
  dragOverId: null, 
  dragOverType: null 
});



interface DraggableRoomItemProps {
  room: RoomWithRecipients;
  spaceId: string;
  onReorder: (draggedId: string, targetId: string, position: 'before' | 'after') => void;
  canDrag?: boolean;
}

interface OrphanedRoomItemProps {
  room: RoomWithRecipients;
  spaceId: string;
  onReorder: (draggedId: string, targetId: string, position: 'before' | 'after') => void;
  canDrag?: boolean;
}

const OrphanedRoomItem: Component<OrphanedRoomItemProps> = (props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isDragging = () => globalDragState().draggedId === props.room.id;
  const isActive = () => location.pathname === `/spaces/${props.spaceId}/rooms/${props.room.id}`;

  const handleDragStart = (e: DragEvent) => {
    e.stopPropagation();
    e.dataTransfer!.setData('text/plain', `room:${props.room.id}`);
    e.dataTransfer!.effectAllowed = 'move';
    setGlobalDragState({
      isDragging: true,
      draggedId: props.room.id,
      draggedType: 'room',
      dragOverId: null,
      dragOverType: null
    });
    console.log('Drag started for room:', props.room.id);
  };

  const handleDragEnd = (e: DragEvent) => {
    e.stopPropagation();
    setGlobalDragState({
      isDragging: false,
      draggedId: null,
      draggedType: null,
      dragOverId: null,
      dragOverType: null
    });
    console.log('Drag ended for room:', props.room.id);
  };

  return (
    <div
      class={`group relative transition-all duration-200 ${
        isDragging() 
          ? 'opacity-50 scale-95 bg-blue-500 bg-opacity-20' 
          : ''
      }`}
    >
      <div class={`flex items-center gap-2 p-3 rounded-md transition-colors ${
        isActive() 
          ? 'bg-surface bg-opacity-10 text-text-primary' 
          : 'text-text-secondary hover:bg-surface hover:bg-opacity-10 hover:text-text-primary'
      }`}>
        {/* Clickable area for navigation */}
        <div 
          class="flex items-center gap-2 flex-1 cursor-pointer"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Only navigate if we're not in a drag operation
            if (!globalDragState().isDragging) {
              navigate(`/spaces/${props.spaceId}/rooms/${props.room.id}`);
            }
          }}
          onMouseDown={(e) => {
            // Prevent mouse down from interfering with drag
            if (e.button === 0) { // Left mouse button
              e.stopPropagation();
            }
          }}
        >
          <Show when={props.room.type === RoomType.TEXT_ROOM} fallback={
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          }>
            <span class="text-lg">#</span>
          </Show>
          <span class="flex-1 select-none">{props.room.name}</span>
        </div>
        
        {/* Drag indicator */}
        <Show when={props.canDrag}>
          <div 
            draggable="true"
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            class="opacity-50 group-hover:opacity-100 transition-opacity p-1 cursor-grab active:cursor-grabbing"
            style={{ "user-select": "none" }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="9" cy="12" r="1" />
              <circle cx="9" cy="5" r="1" />
              <circle cx="9" cy="19" r="1" />
              <circle cx="15" cy="12" r="1" />
              <circle cx="15" cy="5" r="1" />
              <circle cx="15" cy="19" r="1" />
            </svg>
          </div>
        </Show>
      </div>
    </div>
  );
};

const DraggableRoomItem: Component<DraggableRoomItemProps> = (props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isDragging = () => globalDragState().draggedId === props.room.id;
  const isActive = () => location.pathname === `/spaces/${props.spaceId}/rooms/${props.room.id}`;

  const handleDragStart = (e: DragEvent) => {
    e.stopPropagation();
    e.dataTransfer!.setData('text/plain', `room:${props.room.id}`);
    e.dataTransfer!.effectAllowed = 'move';
    setGlobalDragState({
      isDragging: true,
      draggedId: props.room.id,
      draggedType: 'room',
      dragOverId: null,
      dragOverType: null
    });
    console.log('Drag started for room:', props.room.id);
  };

  const handleDragEnd = (e: DragEvent) => {
    e.stopPropagation();
    setGlobalDragState({
      isDragging: false,
      draggedId: null,
      draggedType: null,
      dragOverId: null,
      dragOverType: null
    });
    console.log('Drag ended for room:', props.room.id);
  };

  // Remove drop functionality from room items - only drop zones should accept drops

  return (
    <div
      class={`group relative transition-all duration-200 ${
        isDragging() 
          ? 'opacity-50 scale-95 bg-blue-500 bg-opacity-20' 
          : ''
      }`}
    >
      <div class={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${
        isActive() 
          ? 'bg-surface bg-opacity-10 text-text-primary font-semibold' 
          : 'text-text-secondary hover:bg-surface hover:bg-opacity-10 hover:text-text-primary'
      }`}>
        {/* Clickable area for navigation */}
        <div 
          class="flex items-center gap-2 flex-1 cursor-pointer"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Only navigate if we're not in a drag operation
            if (!globalDragState().isDragging) {
              navigate(`/spaces/${props.spaceId}/rooms/${props.room.id}`);
            }
          }}
          onMouseDown={(e) => {
            // Prevent mouse down from interfering with drag
            if (e.button === 0) { // Left mouse button
              e.stopPropagation();
            }
          }}
        >
          <Show when={props.room.type === RoomType.TEXT_ROOM} fallback={
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          }>
            <span class="text-lg">#</span>
          </Show>
          <span class="flex-1 select-none">{props.room.name}</span>
        </div>
        
        {/* Drag indicator */}
        <Show when={props.canDrag}>
          <div 
            draggable="true"
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            class="opacity-50 group-hover:opacity-100 transition-opacity p-1 cursor-grab active:cursor-grabbing"
            style={{ "user-select": "none" }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="9" cy="12" r="1" />
              <circle cx="9" cy="5" r="1" />
              <circle cx="9" cy="19" r="1" />
              <circle cx="15" cy="12" r="1" />
              <circle cx="15" cy="5" r="1" />
              <circle cx="15" cy="19" r="1" />
            </svg>
          </div>
        </Show>
      </div>
    </div>
  );
};

interface DropZoneProps {
  onDrop: (draggedId: string) => void;
  acceptType: 'room' | 'section';
  zoneId: string;
  class?: string;
}

const DropZone: Component<DropZoneProps> = (props) => {
  const isActive = () => {
    const active = globalDragState().draggedType === props.acceptType;
    if (active) {
      console.log('[DropZone] Zone is active:', props.zoneId, 'acceptType:', props.acceptType, 'draggedType:', globalDragState().draggedType);
    }
    return active;
  };
  const isDropTarget = () => globalDragState().dragOverId === props.zoneId && globalDragState().dragOverType === 'zone';

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (globalDragState().draggedType === props.acceptType) {
      setGlobalDragState(prev => ({ ...prev, dragOverId: props.zoneId, dragOverType: 'zone' }));
    }
  };

  const handleDragLeave = (e: DragEvent) => {
    e.stopPropagation();
    if (e.currentTarget instanceof Node && !e.currentTarget.contains(e.relatedTarget as Node)) {
      setGlobalDragState(prev => ({ ...prev, dragOverId: null, dragOverType: null }));
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedData = e.dataTransfer!.getData('text/plain');
    const prefix = props.acceptType === 'room' ? 'room:' : 'section:';
    if (draggedData.startsWith(prefix)) {
      const draggedId = draggedData.replace(prefix, '');
      props.onDrop(draggedId);
    }
    setGlobalDragState(prev => ({ ...prev, dragOverId: null, dragOverType: null }));
  };

  return (
    <div
      class={`transition-all duration-200 ${
        isActive() && isDropTarget()
          ? props.acceptType === 'room' 
            ? 'h-4 bg-blue-400 border-blue-400 opacity-70' 
            : 'h-4 bg-green-400 border-green-400 opacity-70'
          : isActive()
          ? props.acceptType === 'room'
            ? 'h-2 bg-blue-200 border-blue-200 opacity-30'
            : 'h-2 bg-green-200 border-green-200 opacity-30'
          : 'h-1 bg-transparent border-transparent opacity-0'
      } mx-2 my-1 rounded-md border-2 border-dashed ${props.class || ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    />
  );
};

interface DraggableSectionProps {
  section: Room;
  rooms: RoomWithRecipients[];
  spaceId: string;
  updateTrigger: () => number;
  onRoomReorder: (draggedId: string, targetId: string, position: 'before' | 'after') => void;
  onSectionReorder: (draggedId: string, targetId: string, position: 'before' | 'after') => void;
  onRoomMoveToSection: (draggedRoomId: string, targetSectionId: string) => void;
  onRoomMoveToSectionAtPosition?: (draggedRoomId: string, targetSectionId: string, position: number) => void;
  canDrag: boolean;
}

const DraggableSection: Component<DraggableSectionProps> = (props) => {
  const [isCollapsed, setIsCollapsed] = createSignal(false);
  const isDragging = () => globalDragState().draggedId === props.section.id;
  const isDropTarget = () => globalDragState().dragOverId === props.section.id && globalDragState().dragOverType === 'section';
  const isRoomDropTarget = () => isDropTarget() && globalDragState().draggedType === 'room';
  const isSectionDropTarget = () => isDropTarget() && globalDragState().draggedType === 'section';

  const sortedRooms = createMemo(() => {
    return [...props.rooms].sort((a, b) => {
      const aPos = a.position ?? 999999;
      const bPos = b.position ?? 999999;
      return aPos - bPos;
    });
  });

  const handleSectionDragStart = (e: DragEvent) => {
    e.stopPropagation();
    e.dataTransfer!.setData('text/plain', `section:${props.section.id}`);
    e.dataTransfer!.effectAllowed = 'move';
    setGlobalDragState({
      isDragging: true,
      draggedId: props.section.id,
      draggedType: 'section',
      dragOverId: null,
      dragOverType: null
    });
  };

  const handleSectionDragEnd = (e: DragEvent) => {
    e.stopPropagation();
    setGlobalDragState({
      isDragging: false,
      draggedId: null,
      draggedType: null,
      dragOverId: null,
      dragOverType: null
    });
  };

  const handleSectionDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedType = globalDragState().draggedType;
    if ((draggedType === 'section' && globalDragState().draggedId !== props.section.id) ||
        (draggedType === 'room')) {
      setGlobalDragState(prev => ({ ...prev, dragOverId: props.section.id, dragOverType: 'section' }));
    }
  };

  const handleSectionDragLeave = (e: DragEvent) => {
    e.stopPropagation();
    if (e.currentTarget instanceof Node && !e.currentTarget.contains(e.relatedTarget as Node)) {
      setGlobalDragState(prev => ({ ...prev, dragOverId: null, dragOverType: null }));
    }
  };

  const handleSectionDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedData = e.dataTransfer!.getData('text/plain');
    if (draggedData.startsWith('section:')) {
      const draggedSectionId = draggedData.replace('section:', '');
      if (draggedSectionId !== props.section.id) {
        props.onSectionReorder(draggedSectionId, props.section.id, 'before');
      }
    } else if (draggedData.startsWith('room:')) {
      const draggedRoomId = draggedData.replace('room:', '');
      props.onRoomMoveToSection(draggedRoomId, props.section.id);
    }
    setGlobalDragState(prev => ({ ...prev, dragOverId: null, dragOverType: null }));
  };

  return (
    <div class={`transition-all duration-200 ${
      isDragging() ? 'opacity-50' : 'opacity-100'
    } ${
      isRoomDropTarget() ? 'bg-blue-500 bg-opacity-20 border-2 border-blue-500 border-dashed rounded-md p-2' : 
      isSectionDropTarget() ? 'bg-green-500 bg-opacity-20 border-2 border-green-500 border-dashed rounded-md p-2' : ''
    }`}>
      <div 
        draggable={true}
        onDragStart={handleSectionDragStart}
        onDragEnd={handleSectionDragEnd}
        onDragOver={handleSectionDragOver}
        onDragLeave={handleSectionDragLeave}
        onDrop={handleSectionDrop}
        onClick={() => setIsCollapsed(!isCollapsed())}
        class="flex items-center gap-2 text-xs font-bold text-text-secondary uppercase tracking-wide cursor-pointer group select-none hover:text-text-primary transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class={`w-3 h-3 transition-transform duration-200 ${
          isCollapsed() ? 'transform rotate-0' : 'transform rotate-90'
        }`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9,18 15,12 9,6" />
        </svg>
        <span class="flex-1">{props.section.name}</span>
      </div>
      
      <div class={`overflow-hidden transition-all duration-300 ease-in-out ${
        isCollapsed() ? 'max-h-0 opacity-0' : 'max-h-[1000px] opacity-100'
      }`}>
        {/* Drop zone for empty sections or inserting at the beginning */}
        <Show when={!isCollapsed() && globalDragState().draggedType === 'room'}>
          <DropZone 
            acceptType="room" 
            zoneId={`section-start-${props.section.id}`}
            onDrop={(draggedId) => {
              const draggedRoom = props.rooms.find(r => r.id === draggedId);
              if (!draggedRoom) {
                // Room is from outside this section, move it to the beginning
                props.onRoomMoveToSectionAtPosition?.(draggedId, props.section.id, 0);
              }
            }}
          />
        </Show>
        <For each={sortedRooms()}>
          {(room, index) => {
            const draggedRoomId = globalDragState().draggedId;
            const isDraggingThisRoom = draggedRoomId === room.id;
            const prevRoom = sortedRooms()[index() - 1];
            const isDraggingPrevRoom = prevRoom && draggedRoomId === prevRoom.id;
            
            return (
                <div>
                <Show when={!isDraggingThisRoom && !isDraggingPrevRoom}>
                  <DropZone 
                    acceptType="room" 
                    zoneId={`room-before-${room.id}`}
                    onDrop={(draggedId) => {
                      const draggedRoom = props.rooms.find(r => r.id === draggedId);
                      if (draggedRoom) {
                        // Room is already in this section, just reorder
                        props.onRoomReorder(draggedId, room.id, 'before');
                      } else {
                        // Room is from outside this section, move it here with specific position
                        const targetIndex = props.rooms.findIndex(r => r.id === room.id);
                        props.onRoomMoveToSectionAtPosition?.(draggedId, props.section.id, targetIndex);
                      }
                    }}
                  />
                </Show>
                <DraggableRoomItem
                  room={room}
                  spaceId={props.spaceId}
                  onReorder={props.onRoomReorder}
                  canDrag={props.canDrag}
                />
                <Show when={index() === sortedRooms().length - 1 && !isDraggingThisRoom}>
                  <DropZone 
                    acceptType="room" 
                    zoneId={`room-after-${room.id}`}
                    onDrop={(draggedId) => {
                      const draggedRoom = props.rooms.find(r => r.id === draggedId);
                      if (draggedRoom) {
                        // Room is already in this section, just reorder
                        props.onRoomReorder(draggedId, room.id, 'after');
                      } else {
                        // Room is from outside this section, move it here with specific position
                        const targetIndex = props.rooms.findIndex(r => r.id === room.id);
                        props.onRoomMoveToSectionAtPosition?.(draggedId, props.section.id, targetIndex + 1);
                      }
                    }}
                  />
                </Show>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
};

const RoomsList: Component<RoomsListProps> = (props) => {
  const { rooms } = useAuth();
  // const cache = useCache();
  
  // Permission checking
  const [canManageChannels, setCanManageChannels] = createSignal(false);
  
  // Check MANAGE_CHANNELS permission when spaceId changes
  createEffect(async () => {
    if (props.spaceId) {
      try {
        const result = await api.spaces.permissions.check(props.spaceId, 'MANAGE_CHANNELS');
        setCanManageChannels(result.has_permission);
      } catch (error) {
        console.error('Error checking MANAGE_CHANNELS permission:', error);
        setCanManageChannels(false);
      }
    } else {
      setCanManageChannels(false);
    }
  });

  const updateRoomPositions = async (roomPositions: { room_id: string; position: number }[]) => {
    try {
      const response = await fetch(`${BASE_URL}/rooms/positions`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': localStorage.getItem('sc_token') || ''
        },
        body: JSON.stringify({ room_positions: roomPositions })
      });

      if (!response.ok) {
        throw new Error('Failed to update room positions');
      }

      console.log('Room positions updated successfully');
    } catch (error) {
      console.error('Error updating room positions:', error);
    }
  };

  const updateRoomParent = async (roomId: string, newParentId: string | null, newPosition: number) => {
    console.log('[RoomsList] updateRoomParent called with:', { roomId, newParentId, newPosition });
    try {
      const requestBody = { 
        room_positions: [{
          room_id: roomId,
          position: newPosition,
          parent_id: newParentId
        }]
      };
      console.log('[RoomsList] Sending request body:', JSON.stringify(requestBody, null, 2));
      
      const response = await fetch(`${BASE_URL}/rooms/positions`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': localStorage.getItem('sc_token') || ''
        },
        body: JSON.stringify(requestBody)
      });

      console.log('[RoomsList] Response status:', response.status);
      const responseText = await response.text();
      console.log('[RoomsList] Response body:', responseText);

      if (!response.ok) {
        throw new Error(`Failed to update room parent: ${response.status} ${responseText}`);
      }

      console.log('Room parent updated successfully');
    } catch (error) {
      console.error('Error updating room parent:', error);
    }
  };

  // Filter rooms by space and type
  const spaceRooms = createMemo(() => {
    console.log('[RoomsList] spaceRooms memo triggered, props.spaceId:', props.spaceId);
    if (!props.spaceId) return [];
    const allRooms = rooms();
    console.log('[RoomsList] spaceRooms allRooms from AuthProvider:', allRooms?.length || 0);
    if (!allRooms) return [];
    
    const filtered = allRooms.filter((room: RoomWithRecipients) => {
      const spaceIdMatch = String(room.space_id) === String(props.spaceId);
      const typeMatch = (room.type === RoomType.TEXT_ROOM || room.type === RoomType.VOICE_ROOM || room.type === RoomType.SPACE_SECTION);
      return spaceIdMatch && typeMatch;
    });
    console.log('[RoomsList] spaceRooms filtered result:', filtered.length, 'rooms:', filtered.map(r => ({ id: r.id, name: r.name, parent_id: r.parent_id, position: r.position })));
    return filtered;
  });

  // Separate sections and rooms
  const sections = createMemo(() => {
    const sectionRooms = spaceRooms().filter((room: RoomWithRecipients) => room.type === RoomType.SPACE_SECTION);
    const sorted = [...sectionRooms].sort((a, b) => {
      const aPos = a.position ?? 999999;
      const bPos = b.position ?? 999999;
      return aPos - bPos;
    });
    
    // Debug logging to see section positions
    console.log('Sections sorted by position:', sorted.map(s => ({ name: s.name, position: s.position, id: s.id })));
    
    return sorted;
  });

  const allRoomsInSpace = createMemo(() => {
    console.log('[RoomsList] allRoomsInSpace memo triggered, spaceRooms:', spaceRooms().length);
    const filtered = spaceRooms().filter((room: RoomWithRecipients) => 
      room.type === RoomType.TEXT_ROOM || room.type === RoomType.VOICE_ROOM
    );
    console.log('[RoomsList] allRoomsInSpace filtered:', filtered.length, 'rooms with parent_ids:', filtered.map(r => ({ id: r.id, parent_id: r.parent_id, position: r.position })));
    return filtered;
  });

  // Add a reactive trigger for forcing updates
  const [updateTrigger, setUpdateTrigger] = createSignal(0);
  
  // Watch for room changes and trigger updates
  createEffect(() => {
    const currentRooms = allRoomsInSpace();
    // Create a signature based on room positions and parent_ids
    const signature = currentRooms.map(r => `${r.id}:${r.parent_id}:${r.position}`).join('|');
    console.log('[RoomsList] Room signature changed:', signature);
    setUpdateTrigger(prev => prev + 1);
  });

  // Group rooms by their parent section ID - make it reactive with forced updates
  const roomsBySection = createMemo(() => {
    updateTrigger(); // Subscribe to the trigger
    console.log('[RoomsList] roomsBySection memo triggered, allRoomsInSpace:', allRoomsInSpace().length);
    const grouped = new Map<string, RoomWithRecipients[]>();
    
    // Force reactivity by creating new array references
    const currentRooms = allRoomsInSpace();
    currentRooms.forEach(room => {
      if (room.parent_id) {
        if (!grouped.has(room.parent_id)) {
          grouped.set(room.parent_id, []);
        }
        grouped.get(room.parent_id)!.push({ ...room }); // Create new object reference
      }
    });
    
    // Sort rooms within each section by position
    grouped.forEach(rooms => {
      rooms.sort((a, b) => {
        const aPos = a.position ?? 999999;
        const bPos = b.position ?? 999999;
        return aPos - bPos;
      });
    });
    
    console.log('[RoomsList] roomsBySection grouped:', Array.from(grouped.entries()).map(([k, v]) => [k, v.length]));
    // Return a new Map instance to force re-rendering
    return new Map(grouped);
  });
  
  const getRoomsForSection = (sectionId: string) => {
    return roomsBySection().get(sectionId) || [];
  };

  // Get rooms that don't belong to any section
  const orphanedRooms = createMemo(() => {
    updateTrigger(); // Subscribe to the trigger
    console.log('[RoomsList] orphanedRooms memo triggered');
    const currentRooms = allRoomsInSpace();
    const orphaned = currentRooms.filter((room: RoomWithRecipients) => 
      !room.parent_id
    ).map(room => ({ ...room })); // Create new object references
    
    const sorted = orphaned.sort((a, b) => {
      const aPos = a.position ?? 999999;
      const bPos = b.position ?? 999999;
      return aPos - bPos;
    });
    console.log('[RoomsList] orphanedRooms count:', sorted.length);
    return sorted;
  });

  const handleRoomReorder = async (draggedId: string, targetId: string, position: 'before' | 'after') => {
    // Find all rooms in the same context (orphaned or in same section)
    const draggedRoom = allRoomsInSpace().find(r => r.id === draggedId);
    const targetRoom = allRoomsInSpace().find(r => r.id === targetId);
    
    if (!draggedRoom || !targetRoom) return;
    
    // Determine the context (orphaned or section)
    const isOrphaned = !targetRoom.parent_id;
    const contextRooms = isOrphaned 
      ? orphanedRooms()
      : getRoomsForSection(targetRoom.parent_id!);
    
    const draggedIndex = contextRooms.findIndex(r => r.id === draggedId);
    const targetIndex = contextRooms.findIndex(r => r.id === targetId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;
    
    const newOrder = [...contextRooms];
    const [removed] = newOrder.splice(draggedIndex, 1);
    
    const insertIndex = position === 'before' 
      ? (draggedIndex < targetIndex ? targetIndex - 1 : targetIndex)
      : (draggedIndex < targetIndex ? targetIndex : targetIndex + 1);
    
    newOrder.splice(insertIndex, 0, removed);
    
    const updates = newOrder.map((room, index) => ({
      room_id: room.id,
      position: index
    }));
    
    await updateRoomPositions(updates);
  };

  const handleSectionReorder = async (draggedId: string, targetId: string, position: 'before' | 'after') => {
    const currentSections = sections();
    const draggedIndex = currentSections.findIndex(s => s.id === draggedId);
    const targetIndex = currentSections.findIndex(s => s.id === targetId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;
    
    const newOrder = [...currentSections];
    const [removed] = newOrder.splice(draggedIndex, 1);
    
    const insertIndex = position === 'before'
      ? (draggedIndex < targetIndex ? targetIndex - 1 : targetIndex)
      : (draggedIndex < targetIndex ? targetIndex : targetIndex + 1);
    
    newOrder.splice(insertIndex, 0, removed);
    
    const updates = newOrder.map((section, index) => ({
      room_id: section.id,
      position: index
    }));
    
    await updateRoomPositions(updates);
  };

  const handleRoomMoveToSection = async (draggedRoomId: string, targetSectionId: string) => {
    console.log('[RoomsList] Moving room to section:', { draggedRoomId, targetSectionId });
    const sectionRooms = getRoomsForSection(targetSectionId);
    const newPosition = sectionRooms.length; // Add to end of section
    console.log('[RoomsList] New position will be:', newPosition);
    await updateRoomParent(draggedRoomId, targetSectionId, newPosition);
  };

  const handleRoomMoveToSectionAtPosition = async (draggedRoomId: string, targetSectionId: string, position: number) => {
    console.log('[RoomsList] Moving room to section at position:', { draggedRoomId, targetSectionId, position });
    await updateRoomParent(draggedRoomId, targetSectionId, position);
  };

  const handleRoomOrphan = async (draggedRoomId: string, targetRoomId?: string, position?: 'before' | 'after') => {
    if (targetRoomId && position) {
      // Insert at specific position among orphaned rooms
      const currentOrphaned = orphanedRooms();
      const targetIndex = currentOrphaned.findIndex(r => r.id === targetRoomId);
      const insertPosition = position === 'before' ? targetIndex : targetIndex + 1;
      await updateRoomParent(draggedRoomId, null, insertPosition);
    } else {
      // Add to end of orphaned rooms
      const newPosition = orphanedRooms().length;
      await updateRoomParent(draggedRoomId, null, newPosition);
    }
  };

  return (
    <div class="flex flex-col h-full bg-background1 rounded-tl-2xl overflow-hidden">
      {/* Space banner */}
      <Show when={props.currentSpace?.banner}>
        <div class="h-[120px] relative overflow-hidden">
          <img
            src={`${FS_URL}/banners/${props.currentSpace?.id}/${props.currentSpace?.banner}`}
            alt="Space banner"
            class="w-full h-full object-cover"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-background1 via-transparent to-transparent" />
        </div>
      </Show>
      
      {/* Space header with dropdown */}
      <SpaceHeaderDropdown 
        spaceId={props.spaceId}
        spaceName={props.currentSpace?.name}
      />
      
      {/* Navigation and Rooms content area */}
      <div class="flex flex-col gap-1 p-2 flex-1 overflow-y-auto min-h-0">
        <A
          href={`/spaces/${props.spaceId}`}
          class="flex items-center gap-2 p-3 rounded-md hover:bg-surface hover:bg-opacity-10 transition-colors"
          activeClass="bg-surface bg-opacity-10"
          end
        >
          <Home />
          <span class="text-text-primary select-none">
           Home
          </span>
        </A>

        {/* Separator */}
        {/* <div class="mx-2 mt-1.5 h-px bg-surface bg-opacity-20"></div> */}

        {/* Orphaned Rooms (not in any section) */}
        {/* Drop zone for orphaning rooms */}
        <Show when={globalDragState().draggedType === 'room'}>
          <DropZone 
            acceptType="room" 
            zoneId="orphan-top"
            onDrop={(draggedId) => handleRoomOrphan(draggedId)}
            class="bg-yellow-200 border-yellow-400"
          />
        </Show>
        
        <Show when={orphanedRooms().length > 0}>
          <For each={orphanedRooms()}>
            {(room, index) => {
              const draggedRoomId = globalDragState().draggedId;
              const isDraggingThisRoom = draggedRoomId === room.id;
              const prevRoom = orphanedRooms()[index() - 1];
              const isDraggingPrevRoom = prevRoom && draggedRoomId === prevRoom.id;
              // const roomKey = () => `orphan-${room.id}-${room.parent_id || 'null'}-${room.position}-${updateTrigger()}`;
              
              return (
                <div>
                  <Show when={!isDraggingThisRoom && !isDraggingPrevRoom}>
                    <DropZone 
                      acceptType="room" 
                      zoneId={`orphan-before-${room.id}`}
                      onDrop={(draggedId) => handleRoomReorder(draggedId, room.id, 'before')}
                    />
                  </Show>
                  <OrphanedRoomItem
                    room={room}
                    spaceId={props.spaceId || ''}
                    onReorder={handleRoomReorder}
                    canDrag={canManageChannels()}
                  />
                  <Show when={index() === orphanedRooms().length - 1 && !isDraggingThisRoom}>
                    <DropZone 
                      acceptType="room" 
                      zoneId={`orphan-after-${room.id}`}
                      onDrop={(draggedId) => handleRoomReorder(draggedId, room.id, 'after')}
                    />
                  </Show>
                </div>
              );
            }}
          </For>
        </Show>
 
        {/* Dynamic Sections */}
         <For each={sections()}>
           {(section, index) => {
             const sectionRooms = () => getRoomsForSection(section.id);
             const draggedSectionId = globalDragState().draggedId;
             const isDraggingThisSection = draggedSectionId === section.id;
             const prevSection = sections()[index() - 1];
             const isDraggingPrevSection = prevSection && draggedSectionId === prevSection.id;
            //  const sectionKey = () => `section-${section.id}-${sectionRooms().length}-${updateTrigger()}`;
             
             return (
               <div>
                 <Show when={!isDraggingThisSection && !isDraggingPrevSection}>
                   <DropZone 
                     acceptType="section" 
                     zoneId={`section-before-${section.id}`}
                     onDrop={(draggedId) => handleSectionReorder(draggedId, section.id, 'before')}
                   />
                 </Show>
                 <DraggableSection
                      section={section as Room}
                      rooms={sectionRooms()}
                      spaceId={props.spaceId!}
                      updateTrigger={updateTrigger}
                      onRoomReorder={handleRoomReorder}
                      onSectionReorder={handleSectionReorder}
                      onRoomMoveToSection={handleRoomMoveToSection}
                      onRoomMoveToSectionAtPosition={handleRoomMoveToSectionAtPosition}
                      canDrag={canManageChannels()}
                     />
                 <Show when={index() === sections().length - 1 && !isDraggingThisSection}>
                   <DropZone 
                     acceptType="section" 
                     zoneId={`section-after-${section.id}`}
                     onDrop={(draggedId) => handleSectionReorder(draggedId, section.id, 'after')}
                   />
                 </Show>
               </div>
             );
           }}
         </For>
      </div>
      
      <ClientUserArea />
    </div>
  );
};

export default RoomsList;
