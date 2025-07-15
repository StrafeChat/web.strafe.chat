import { Component, createSignal, onMount, onCleanup, Show } from "solid-js";
import SpaceSettings from "../../settings/SpaceSettings";

interface SpaceHeaderDropdownProps {
  spaceId?: string;
  spaceName?: string;
}

export const SpaceHeaderDropdown: Component<SpaceHeaderDropdownProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal(false);
  const [isSpaceSettingsOpen, setIsSpaceSettingsOpen] = createSignal(false);
  let dropdownRef: HTMLDivElement | undefined;

  // Handle clicking outside dropdown to close it
  const handleClickOutside = (event: MouseEvent) => {
    if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
      setIsOpen(false);
    }
  };

  onMount(() => {
    document.addEventListener('mousedown', handleClickOutside);
  });

  onCleanup(() => {
    document.removeEventListener('mousedown', handleClickOutside);
  });

  // Dropdown action handlers
  const handleInvitePeople = () => {
    console.log('Invite People clicked for space:', props.spaceId);
    setIsOpen(false);
    // TODO: Implement invite people functionality
  };

  const handleSpaceSettings = () => {
    console.log('Space Settings clicked for space:', props.spaceId);
    setIsOpen(false);
    setIsSpaceSettingsOpen(true);
  };

  const handleCreateRoom = () => {
    console.log('Create Room clicked for space:', props.spaceId);
    setIsOpen(false);
    // TODO: Implement create room functionality
  };

  const handleCreateSection = () => {
    console.log('Create Section clicked for space:', props.spaceId);
    setIsOpen(false);
    // TODO: Implement create section functionality
  };

  return (
    <div class="relative p-2 flex flex-col border-b border-surface border-opacity-20 flex-shrink-0" ref={dropdownRef}>
      <div 
        class="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-surface hover:bg-opacity-10 rounded-md transition-colors"
        onClick={() => setIsOpen(!isOpen())}
      >
        <h3 class="text-xl font-bold text-text-primary truncate">
          {props.spaceName || "Unknown Space"}
        </h3>
        <div
          class="transition-transform duration-200"
          classList={{ "rotate-180": isOpen() }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6,9 12,15 18,9" />
          </svg>
        </div>
      </div>
      
      <Show when={isOpen()}>
        <div class="absolute top-full left-2 right-2 mt-1 py-1 bg-background1 border border-surface border-opacity-20 rounded-md shadow-lg z-50">
          <button
            type="button"
            onClick={handleInvitePeople}
            class="w-full flex items-center gap-3 px-3 py-2 hover:bg-surface hover:bg-opacity-10 text-text-primary text-left transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
            <span>Invite People</span>
          </button>
          
          <button
            type="button"
            onClick={handleSpaceSettings}
            class="w-full flex items-center gap-3 px-3 py-2 hover:bg-surface hover:bg-opacity-10 text-text-primary text-left transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span>Space Settings</span>
          </button>
          
          <div class="mx-2 my-1 h-px bg-surface bg-opacity-20"></div>
          
          <button
            type="button"
            onClick={handleCreateRoom}
            class="w-full flex items-center gap-3 px-3 py-2 hover:bg-surface hover:bg-opacity-10 text-text-primary text-left transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 5v14m-7-7h14" />
            </svg>
            <span>Create Room</span>
          </button>
          
          <button
            type="button"
            onClick={handleCreateSection}
            class="w-full flex items-center gap-3 px-3 py-2 hover:bg-surface hover:bg-opacity-10 text-text-primary text-left transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              <line x1="12" y1="11" x2="12" y2="17" />
              <line x1="9" y1="14" x2="15" y2="14" />
            </svg>
            <span>Create Section</span>
          </button>
        </div>
      </Show>
      
      {/* Space Settings Modal */}
      <Show when={isSpaceSettingsOpen()}>
        <SpaceSettings
          isOpen={isSpaceSettingsOpen()}
          onClose={() => setIsSpaceSettingsOpen(false)}
          spaceId={props.spaceId || ""}
        />
      </Show>
    </div>
  );
};