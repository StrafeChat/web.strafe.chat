/**
 * Utility for rendering mentions with dynamic content lookup
 * This will be used to replace static mention placeholders with actual user/room names
 */
// import { FS_URL } from "../../constants";

// Global cache references for mention rendering
let globalCache: any = null;
let globalRooms: any = null;

/**
 * Set global references for mention rendering
 * This should be called from the MessageContent component
 */
export function setMentionGlobals(cache: any, rooms: any) {
  globalCache = cache;
  globalRooms = rooms;
}

/**
 * Initialize click handlers for mentions
 * This adds global document click listeners to handle mention clicks
 */
export function initializeMentionClickHandlers() {
  // Remove any existing handlers first to prevent duplicates
  document.removeEventListener('click', handleMentionClick);
  
  // Add the click handler
  document.addEventListener('click', handleMentionClick);
}

/**
 * Handle clicks on mention elements
 */
function handleMentionClick(event: MouseEvent) {
  const target = event.target as HTMLElement;
  const mentionElement = target.closest('.mention') as HTMLElement;
  
  if (!mentionElement) return;
  
  // Check if there's already an open popup
  const existingPopup = document.querySelector('.user-popup-open');
  if (existingPopup) {
    existingPopup.classList.remove('user-popup-open');
  }
  
  const mentionType = mentionElement.getAttribute('data-mention-type');
  const mentionId = mentionElement.getAttribute('data-mention-id');
  
  if (!mentionType || (mentionType !== 'everyone' && !mentionId)) return;
  
  // Handle different mention types
  switch (mentionType) {
    case 'user':
      openUserPopup(mentionElement, mentionId!);
      break;
    case 'room':
      navigateToRoom(mentionId!);
      break;
    case 'role':
      // Future implementation for role mentions
      break;
    case 'everyone':
      // Future implementation for everyone mentions
      break;
  }
}

/**
 * Open the user popup menu for a user mention
 */
function openUserPopup(element: HTMLElement, userId: string) {
  // Stop any existing events to prevent multiple popups
  const existingEvent = document.querySelector('.user-popup-open');
  if (existingEvent) {
    return; // Don't open another popup if one is already open
  }
  
  // Double-check that we have the correct userId from the element
  // This ensures we're using the ID from the element that was actually clicked
  const elementUserId = element.getAttribute('data-mention-id');
  if (elementUserId && elementUserId !== userId) {
    userId = elementUserId; // Use the ID from the element if it differs
  }
  
  // Mark this element to prevent multiple popups
  element.classList.add('user-popup-open');
  
  // Dispatch a custom event that the Message component can listen for
  const event = new CustomEvent('openUserPopup', {
    detail: {
      userId,
      triggerElement: element
    },
    bubbles: false // Set to false to prevent event bubbling
  });
  
  // Dispatch directly to document to ensure only one handler processes it
  document.dispatchEvent(event);
}

/**
 * Navigate to a room when a room mention is clicked
 */
function navigateToRoom(roomId: string) {
  // Use the router to navigate to the room
  // Since we can't directly import the router here, we'll dispatch a custom event
  const event = new CustomEvent('navigateToRoom', {
    detail: {
      roomId
    },
    bubbles: false // Set to false to prevent event bubbling
  });
  
  // Dispatch directly to document to ensure only one handler processes it
  document.dispatchEvent(event);
}

/**
 * Render a user mention with actual user data
 */
function renderUserMention(userId: string): string {
  if (!globalCache) {
    return `<span class="mention mention-user bg-surface text-primary px-1 rounded-md cursor-pointer hover:bg-opacity-80 transition-colors" data-mention-type="user" data-mention-id="${userId}" title="@User">@User</span>`;
  }
  
  const allUsers = globalCache.users();
  const user = allUsers ? allUsers[userId] : null;
  const displayName = user ? (user.display_name || user.username) : 'Unknown User';
  
  // Render mention without avatar
  return `<span class="mention mention-user bg-surface text-primary px-1 rounded-md cursor-pointer hover:bg-opacity-80 transition-colors" data-mention-type="user" data-mention-id="${userId}" title="@${displayName}">@${displayName}</span>`;
}

/**
 * Render a room mention with actual room data
 */
function renderRoomMention(roomId: string): string {
  if (!globalRooms) {
    return `<span class="mention mention-room bg-surface text-primary px-1 rounded-md cursor-pointer hover:bg-opacity-80 transition-colors" data-mention-type="room" data-mention-id="${roomId}" title="#Room">#Room</span>`;
  }
  
  const allRooms = globalRooms();
  const room = allRooms ? allRooms.find((r: any) => r.id === roomId) : null;
  const displayName = room ? (room.name || `Room ${roomId}`) : 'Unknown Room';
  
  return `<span class="mention mention-room bg-surface text-primary px-1 rounded-md cursor-pointer hover:bg-opacity-80 transition-colors" data-mention-type="room" data-mention-id="${roomId}" title="#${displayName}">#${displayName}</span>`;
}

/**
 * Render a role mention
 */
function renderRoleMention(roleId: string): string {
  // TODO: Implement role lookup when role system is available
  const displayName = `Role ${roleId}`;
  return `<span class="mention mention-role bg-background text-primary px-1 rounded-md cursor-pointer hover:bg-opacity-80 transition-colors" data-mention-type="role" data-mention-id="${roleId}" title="@${displayName}">@${displayName}</span>`;
}

/**
 * Render an everyone mention
 */
function renderEveryoneMention(): string {
  return `<span class="mention mention-everyone bg-surface text-primary px-1 rounded-md cursor-pointer hover:bg-opacity-80 transition-colors font-semibold" data-mention-type="everyone" title="@everyone">@everyone</span>`;
}

/**
 * Replace mention placeholders with rendered HTML
 */
export function renderMentionPlaceholders(html: string): string {
  return html.replace(/\{\{MENTION:(USER|ROLE|ROOM|EVERYONE)(?::([^}]+))?\}\}/g, (match, type, id) => {
    switch (type) {
      case 'USER':
        return renderUserMention(id);
      case 'ROLE':
        return renderRoleMention(id);
      case 'ROOM':
        return renderRoomMention(id);
      case 'EVERYONE':
        return renderEveryoneMention();
      default:
        return match;
    }
  });
}