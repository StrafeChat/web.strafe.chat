import { Component, createMemo, Show, For, createSignal, createEffect, Accessor } from "solid-js";
import { useNavigate, useLocation } from "@solidjs/router";
import { useAuth } from "../../lib/providers/auth/AuthProvider";
import { useMobileNav } from "../../lib/providers/mobile/MobileNavProvider";
import { useNavigationHistory } from "../../lib/providers/navigation/NavigationHistoryProvider";
import { Tooltip } from "../common/Tooltip";
import { FS_URL } from "../../constants";
import { RoomType } from "../../types/roomTypes";
import Plus from "../shared/icons/Plus";
import DefaultGroupPM from "../shared/icons/DefaultGroupPM";
import { CreateSpaceModal } from "../modals/CreateSpaceModal";
import CreateFolderModal from "../modals/CreateFolderModal";
import FolderSettingsModal from "../modals/FolderSettingsModal";
import ContextMenu from "../common/ContextMenu";
import { Space } from "../../lib/cache/SpaceCache";

// Folder interface for organizing spaces
interface Folder {
  id: string;
  name: string;
  color?: string;
  isOpen: boolean;
  spaceIds: string[];
}

// Item type for unified handling of spaces and folders
type SpaceListItem =
  | { type: "space"; data: Space }
  | { type: "folder"; data: Folder };

const SpacesList: Component = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, rooms, isMobile, spaces } = useAuth();
  const { setCurrentView } = useMobileNav();
  const { getLastHomeRoute, getLastSpaceRoute } = useNavigationHistory();
  const [showCreateModal, setShowCreateModal] = createSignal(false);
  const [showCreateFolderModal, setShowCreateFolderModal] = createSignal(false);
  const [showFolderSettingsModal, setShowFolderSettingsModal] = createSignal(false);
  const [selectedFolder, setSelectedFolder] = createSignal<Folder | null>(null);
  const [contextMenu, setContextMenu] = createSignal<{
    isOpen: boolean;
    x: number;
    y: number;
    folderId: string | null;
  }>({ isOpen: false, x: 0, y: 0, folderId: null });
  const [hoveredSpace, setHoveredSpace] = createSignal<string | null>(null);
  const [hoveredHome, setHoveredHome] = createSignal(false);

  // Drag and drop state
  const [draggedSpace, setDraggedSpace] = createSignal<string | null>(null);
  const [dragOverSpace, setDragOverSpace] = createSignal<string | null>(null);
  const [spacesOrder, setSpacesOrder] = createSignal<string[]>([]);
  const [folders, setFolders] = createSignal<Folder[]>([]);
  const [draggedItem, setDraggedItem] = createSignal<{ type: "space" | "folder"; id: string } | null>(null);
  const [dragOverFolder, setDragOverFolder] = createSignal<string | null>(null);

  // localStorage keys
  const SPACES_ORDER_KEY = "sc_spaces_order";
  const FOLDERS_KEY = "sc_folders";

  // Memoized function to check if a space is currently active
  const isSpaceActive = createMemo(() => {
    const pathname = location.pathname;
    const spaceMatch = pathname.match(/\/spaces\/(\d+)/);
    return spaceMatch ? String(spaceMatch[1]) : null;
  });

  // Memoized function to check if we're on the home page
  const isHomePage = createMemo(() => {
    const path = location.pathname;
    return (
      path === "/" ||
      path === "/home" ||
      path === "/friends" ||
      path === "/notes" ||
      path.startsWith("/rooms")
    );
  });

  // Load spaces order from localStorage
  const loadSpacesOrder = (): string[] => {
    try {
      const stored = localStorage.getItem(SPACES_ORDER_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn("[SpacesList] Failed to load spaces order from localStorage:", error);
      return [];
    }
  };

  // Save spaces order to localStorage
  const saveSpacesOrder = (order: string[]) => {
    try {
      localStorage.setItem(SPACES_ORDER_KEY, JSON.stringify(order));
    } catch (error) {
      console.warn("[SpacesList] Failed to save spaces order to localStorage:", error);
    }
  };

  // Load folders from localStorage
  const loadFolders = (): Folder[] => {
    try {
      const stored = localStorage.getItem(FOLDERS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn("[SpacesList] Failed to load folders from localStorage:", error);
      return [];
    }
  };

  // Save folders to localStorage
  const saveFolders = (folderList: Folder[]) => {
    try {
      localStorage.setItem(FOLDERS_KEY, JSON.stringify(folderList));
    } catch (error) {
      console.warn("[SpacesList] Failed to save folders to localStorage:", error);
    }
  };

  // Create a new folder
  const createFolder = (name: string, color: string = "#6366f1"): Folder => {
    return {
      id: `folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      color,
      isOpen: true,
      spaceIds: [],
    };
  };

  // Add space to folder
  const addSpaceToFolder = (spaceId: string, folderId: string) => {
    const currentFolders = folders();
    const updatedFolders = currentFolders.map((folder) => {
      if (folder.id === folderId) {
        return { ...folder, spaceIds: [...folder.spaceIds, spaceId] };
      }
      return { ...folder, spaceIds: folder.spaceIds.filter((id) => id !== spaceId) };
    });
    setFolders(updatedFolders);
    saveFolders(updatedFolders);
  };

  // Remove space from folder
  const removeSpaceFromFolder = (spaceId: string) => {
    const currentFolders = folders();
    const updatedFolders = currentFolders.map((folder) => ({
      ...folder,
      spaceIds: folder.spaceIds.filter((id) => id !== spaceId),
    }));
    setFolders(updatedFolders);
    saveFolders(updatedFolders);
  };

  // Toggle folder open/closed state
  const toggleFolder = (folderId: string) => {
    const currentFolders = folders();
    const updatedFolders = currentFolders.map((folder) =>
      folder.id === folderId ? { ...folder, isOpen: !folder.isOpen } : folder
    );
    setFolders(updatedFolders);
    saveFolders(updatedFolders);
  };

  // Get user's spaces from auth provider signal
  const userSpaces = createMemo(() => {
    const spaceData = spaces();
    console.log("[SpacesList] Spaces from auth signal:", spaceData);
    return spaceData || [];
  });

  // Get organized spaces and folders
  const organizedItems = createMemo(() => {
    const allSpaces = userSpaces();
    const currentFolders = folders();
    const order = spacesOrder();

    if (allSpaces.length === 0) {
      return [];
    }

    const spaceMap = new Map(allSpaces.map((space) => [space.id, space]));
    const spacesInFolders = new Set<string>();
    currentFolders.forEach((folder) => {
      folder.spaceIds.forEach((spaceId) => spacesInFolders.add(spaceId));
    });

    const standaloneSpaces = allSpaces.filter((space) => !spacesInFolders.has(space.id));
    const sortedStandaloneSpaces: Space[] = [];
    const addedIds = new Set<string>();

    if (order.length > 0) {
      order.forEach((spaceId) => {
        const space = spaceMap.get(spaceId);
        if (space && !spacesInFolders.has(space.id)) {
          sortedStandaloneSpaces.push(space);
          addedIds.add(spaceId);
        }
      });
      standaloneSpaces.forEach((space) => {
        if (!addedIds.has(space.id)) {
          sortedStandaloneSpaces.push(space);
        }
      });
    } else {
      sortedStandaloneSpaces.push(...standaloneSpaces);
    }

    const items: SpaceListItem[] = [];
    currentFolders.forEach((folder) => {
      items.push({ type: "folder", data: folder });
    });
    sortedStandaloneSpaces.forEach((space) => {
      items.push({ type: "space", data: space });
    });

    return items;
  });

  // Get spaces within a folder
  const getFolderSpaces = (folder: Folder): Space[] => {
    const allSpaces = userSpaces();
    const spaceMap = new Map(allSpaces.map((space) => [space.id, space]));
    return folder.spaceIds.map((id) => spaceMap.get(id)).filter((space): space is Space => !!space);
  };

  // Initialize spaces order and folders from localStorage
  createEffect(() => {
    const currentSpaces = userSpaces();
    if (currentSpaces.length > 0) {
      const savedOrder = loadSpacesOrder();
      if (savedOrder.length === 0) {
        const currentOrder = currentSpaces.map((space) => space.id);
        setSpacesOrder(currentOrder);
        saveSpacesOrder(currentOrder);
      } else {
        setSpacesOrder(savedOrder);
      }
      const savedFolders = loadFolders();
      setFolders(savedFolders);
    }
  });

  // Get PM rooms with unread messages (exclude text rooms from spaces)
  const unreadRooms = createMemo(() => {
    const allRooms = rooms();
    const currentUser = user();
    if (currentUser?.presence?.status === "dnd") return [];
    return allRooms.filter(
      (room) =>
        (room.unread_count ?? 0) > 0 &&
        (room.type === RoomType.PM || room.type === RoomType.GROUP_PM)
    );
  });

  // Calculate unread count for a specific space (excluding mentions)
  const getSpaceUnreadCount = (spaceId: string) => {
    const allRooms = rooms();
    const currentUser = user();
    if (currentUser?.presence?.status === "dnd") return 0;
    return allRooms
      .filter((room) => String(room.space_id) === String(spaceId))
      .reduce((total, room) => {
        const unreads = room.unread_count || 0;
        const mentions = room.mention_count || 0;
        return total + Math.max(0, unreads - mentions);
      }, 0);
  };

  // Calculate mention count for a specific space
  const getSpaceMentionCount = (spaceId: string) => {
    const allRooms = rooms();
    const currentUser = user();
    if (currentUser?.presence?.status === "dnd") return 0;
    return allRooms
      .filter((room) => String(room.space_id) === String(spaceId))
      .reduce((total, room) => total + (room.mention_count || 0), 0);
  };

  // Helper function to get room avatar
  const getRoomAvatar = (room: any) => {
    if (room.icon) return `${FS_URL}/icons/${room.id}/${room.icon}`;
    if (room.type === RoomType.GROUP_PM) return null;
    if (room.recipients_data && room.recipients_data.length > 0) {
      const currentUserId = user()?.id;
      const recipient = room.recipients_data.find((r: any) => r.id !== currentUserId);
      if (recipient) {
        return `${FS_URL}/avatars/${recipient.id}/${recipient.avatar || "default.webp"}`;
      }
      const firstRecipient = room.recipients_data[0];
      return `${FS_URL}/avatars/${firstRecipient.id}/${firstRecipient.avatar || "default.webp"}`;
    }
    const currentUserId = user()?.id || "default";
    return `${FS_URL}/avatars/${currentUserId}/default.webp`;
  };

  // Enhanced drag and drop handlers
  const handleItemDragStart = (e: DragEvent, type: "space" | "folder", id: string) => {
    e.dataTransfer!.effectAllowed = "move";
    e.dataTransfer!.setData("text/plain", `${type}:${id}`);
    setDraggedItem({ type, id });
    if (type === "space") {
      setDraggedSpace(id);
    }
  };

  const handleItemDragOver = (e: DragEvent, type: "space" | "folder", id: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer!.dropEffect = "move";
    const currentDraggedItem = draggedItem();
    if (!currentDraggedItem || currentDraggedItem.id !== id) {
      if (type === "space") {
        setDragOverSpace(id);
        setDragOverFolder(null);
      }
    }
  };

  const handleFolderDragOver = (e: DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer!.dropEffect = "move";
    setDragOverFolder(folderId);
  };

  const handleItemDragLeave = (e: DragEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverSpace(null);
      setDragOverFolder(null);
    }
  };

  const handleFolderDrop = (e: DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Immediately clear drag states to hide drop zones
    setDraggedItem(null);
    setDraggedSpace(null);
    setDragOverSpace(null);
    setDragOverFolder(null);
    
    const draggedData = e.dataTransfer!.getData("text/plain");
    if (draggedData.startsWith("space:")) {
      const spaceId = draggedData.replace("space:", "");
      addSpaceToFolder(spaceId, folderId);
    }
  };

  const handleItemDrop = (e: DragEvent, targetType: "space" | "folder", targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Immediately clear drag states to hide drop zones
    setDraggedItem(null);
    setDraggedSpace(null);
    setDragOverSpace(null);
    setDragOverFolder(null);
    
    const draggedData = e.dataTransfer!.getData("text/plain");
    
    if (draggedData.startsWith("space:")) {
      const draggedSpaceId = draggedData.replace("space:", "");
      if (targetType === "space" && draggedSpaceId !== targetId) {
        // Remove space from any folder it might be in
        removeSpaceFromFolder(draggedSpaceId);
        
        // Find the target space position in the current order
        const currentOrder = spacesOrder();
        const targetIndex = currentOrder.indexOf(targetId);
        const draggedIndex = currentOrder.indexOf(draggedSpaceId);
        
        if (targetIndex !== -1 && draggedIndex !== -1) {
          const newOrder = [...currentOrder];
          // Remove dragged space from its current position
          newOrder.splice(draggedIndex, 1);
          // Insert it after the target space
          const newTargetIndex = newOrder.indexOf(targetId);
          newOrder.splice(newTargetIndex + 1, 0, draggedSpaceId);
          setSpacesOrder(newOrder);
          saveSpacesOrder(newOrder);
        }
      }
    }
  };

  const handleReorderDrop = (e: DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedData = e.dataTransfer!.getData("text/plain");
    const currentItems = organizedItems();
    const currentDraggedItem = draggedItem();
    
    // Immediately clear drag states to hide drop zones
    setDraggedItem(null);
    setDraggedSpace(null);
    setDragOverSpace(null);
    setDragOverFolder(null);
    
    if (!currentDraggedItem || !draggedData) {
      return;
    }
    
    const currentIndex = currentItems.findIndex(
      (item) => item.data.id === currentDraggedItem.id && item.type === currentDraggedItem.type
    );
    
    if (currentIndex === -1 || currentIndex === targetIndex) {
      return;
    }
    
    if (draggedData.startsWith("space:")) {
      const spaceId = draggedData.replace("space:", "");
      removeSpaceFromFolder(spaceId);
      const currentOrder = spacesOrder();
      const newOrder = [...currentOrder];
      const spaceIndex = newOrder.indexOf(spaceId);
      
      if (spaceIndex > -1) {
        newOrder.splice(spaceIndex, 1);
      }
      
      let spacePosition = 0;
      for (let i = 0; i < targetIndex; i++) {
        if (currentItems[i].type === "space") {
          spacePosition++;
        }
      }
      
      newOrder.splice(spacePosition, 0, spaceId);
      setSpacesOrder(newOrder);
      saveSpacesOrder(newOrder);
    } else if (draggedData.startsWith("folder:")) {
      const folderId = draggedData.replace("folder:", "");
      const currentFolders = folders();
      const folderIndex = currentFolders.findIndex((f) => f.id === folderId);
      
      if (folderIndex > -1) {
        const newFolders = [...currentFolders];
        const [movedFolder] = newFolders.splice(folderIndex, 1);
        
        let folderPosition = 0;
        for (let i = 0; i < targetIndex; i++) {
          if (currentItems[i].type === "folder") {
            folderPosition++;
          }
        }
        
        newFolders.splice(folderPosition, 0, movedFolder);
        setFolders(newFolders);
        saveFolders(newFolders);
      }
    }
  };

  const handleItemDragEnd = (e: DragEvent) => {
    e.preventDefault();
    // Clear all drag states
    setDraggedItem(null);
    setDraggedSpace(null);
    setDragOverSpace(null);
    setDragOverFolder(null);
  };

  const handleCreateFolder = (name: string, color: string) => {
    const newFolder = createFolder(name, color);
    const currentFolders = folders();
    setFolders([...currentFolders, newFolder]);
    saveFolders([...currentFolders, newFolder]);
  };

  const handleUpdateFolder = (folderId: string, name: string, color: string) => {
    const currentFolders = folders();
    const updatedFolders = currentFolders.map((folder) =>
      folder.id === folderId ? { ...folder, name, color } : folder
    );
    setFolders(updatedFolders);
    saveFolders(updatedFolders);
  };

  const handleDeleteFolder = (folderId: string) => {
    const currentFolders = folders();
    const folderToDelete = currentFolders.find((f) => f.id === folderId);
    if (folderToDelete) {
      const currentOrder = spacesOrder();
      const newOrder = [...currentOrder, ...folderToDelete.spaceIds];
      setSpacesOrder(newOrder);
      saveSpacesOrder(newOrder);
      const updatedFolders = currentFolders.filter((f) => f.id !== folderId);
      setFolders(updatedFolders);
      saveFolders(updatedFolders);
    }
  };

  const handleFolderContextMenu = (e: MouseEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      folderId,
    });
  };

  const closeContextMenu = () => {
    setContextMenu({ isOpen: false, x: 0, y: 0, folderId: null });
  };

  createEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu().isOpen) {
        closeContextMenu();
      }
    };
    if (contextMenu().isOpen) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  });

  const folderContainsActiveSpace = (folder: Folder): boolean => {
    const activeSpaceId = isSpaceActive();
    return activeSpaceId ? folder.spaceIds.includes(activeSpaceId) : false;
  };

  return (
    <div class="flex flex-col items-center h-full py-3 pb-14 md:pb-3 gap-3 bg-[var(--background)] relative overflow-y-auto hide-scrollbar">
      {/* Home button container */}
      <div class="flex flex-col gap-2 w-full items-center">
        <Tooltip content="Home" position="right">
          <button
            class="w-12 h-12 rounded-full bg-surface hover:bg-accent transition-all group relative"
            onClick={() => {
              const lastHomeRoute = getLastHomeRoute();
              navigate(lastHomeRoute);
            }}
            onMouseEnter={() => setHoveredHome(true)}
            onMouseLeave={() => setHoveredHome(false)}
          >
            <Show when={isHomePage()}>
              <div class="absolute -left-3 top-1/2 transform -translate-y-1/2 w-1 h-10 bg-primary rounded-r-md"></div>
            </Show>
            <Show when={hoveredHome() && !isHomePage()}>
              <div class="absolute -left-3 top-1/2 transform -translate-y-1/2 w-1 h-5 bg-primary rounded-r-md"></div>
            </Show>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-6 h-6 mx-auto"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </button>
        </Tooltip>
      </div>

      {/* Unread messages avatars */}
      <Show when={unreadRooms().length > 0}>
        <div class="flex flex-col gap-2 mt-1 w-full items-center">
          <For each={unreadRooms().slice(0, 3)}>
            {(room) => (
              <Tooltip content={`Unread messages in ${room.name || "chat"}`} position="right">
                <button
                  class="w-10 h-10 rounded-full relative border-2 border-surface transition-all"
                  onClick={() => {
                    navigate(`/rooms/${room.id}`);
                    if (isMobile()) {
                      setCurrentView("content");
                    }
                  }}
                >
                  {room.type === RoomType.GROUP_PM && !room.icon ? (
                    <div class="w-full h-full rounded-full bg-surface bg-opacity-20 text-text-primary flex items-center justify-center">
                      <DefaultGroupPM />
                    </div>
                  ) : (
                    <img
                      src={getRoomAvatar(room) || undefined}
                      alt="Room avatar"
                      class="w-full h-full rounded-full"
                      draggable="false"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        const container = target.parentElement;
                        if (container && room.type === RoomType.GROUP_PM) {
                          container.innerHTML =
                            '<div class="w-full h-full bg-surface bg-opacity-20 text-text-primary flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-full h-full"><path fill-rule="evenodd" d="M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" clip-rule="evenodd" /><path d="M8.25 9.75a3 3 0 10-6 0 3 3 0 006 0zm9.5 0a3 3 0 10-6 0 3 3 0 006 0z" fill-opacity="0.5" /></svg></div>';
                        }
                      }}
                    />
                  )}
                  <div class="absolute bottom-0.5 right-0.5 bg-red-500 w-[16px] h-[16px] rounded-full border-2 border-[var(--background)] z-10 transform translate-x-1 translate-y-1"></div>
                </button>
              </Tooltip>
            )}
          </For>
          <Show when={unreadRooms().length > 3}>
            <Tooltip content={`${unreadRooms().length - 3} more rooms with unread messages`} position="right">
              <div class="w-10 h-10 rounded-full bg-surface text-text-primary flex items-center justify-center text-xs font-medium relative">
                +{unreadRooms().length - 3}
                <div class="absolute bottom-0 right-0 bg-red-500 w-[12px] h-[12px] rounded-full border-2 border-[var(--background)]"></div>
              </div>
            </Tooltip>
          </Show>
        </div>
      </Show>

      {/* Spaces and Folders List */}
      <div class="flex flex-col gap-2 w-full items-center">
        <For each={organizedItems()}>
          {(item, index: Accessor<number>) => {
            const currentDraggedItem = draggedItem();
            const showDropZone = draggedItem() && draggedItem()!.id !== item.data.id;

            return (
              <div class="w-full flex flex-col items-center">
                {/* Drop zone above item */}
                <Show when={showDropZone}>
                  <div
                    class="w-full h-2 bg-primary opacity-50 hover:opacity-100 transition-opacity duration-200 rounded-full mb-1"
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.dataTransfer!.dropEffect = "move";
                    }}
                    onDrop={(e) => handleReorderDrop(e, index())}
                  />
                </Show>

                {item.type === "folder" ? (
                  <div
                    class={`relative flex flex-col items-center w-12 transition-all duration-200 ${
                      dragOverFolder() === item.data.id ? "bg-accent bg-opacity-20 rounded-lg p-1" : ""
                    }`}
                    onDragOver={(e) => handleFolderDragOver(e, item.data.id)}
                    onDragLeave={handleItemDragLeave}
                    onDrop={(e) => handleFolderDrop(e, item.data.id)}
                  >
                    {/* Folder Header */}
                    <Tooltip content={item.data.name} position="right">
                      <button
                        class={`w-12 h-12 ${item.data.isOpen ? "rounded-2xl" : "rounded-full hover:rounded-2xl"} bg-surface hover:bg-accent transition-all duration-200 relative overflow-hidden ${
                          !item.data.isOpen && folderContainsActiveSpace(item.data) ? "ring-2 ring-primary" : ""
                        }`}
                        onClick={() => toggleFolder(item.data.id)}
                        onContextMenu={(e) => handleFolderContextMenu(e, item.data.id)}
                        draggable={true}
                        onDragStart={(e) => handleItemDragStart(e, "folder", item.data.id)}
                        onDragEnd={handleItemDragEnd}
                      >
                        <Show
                          when={item.data.isOpen}
                          fallback={
                            <Show when={getFolderSpaces(item.data).length === 0}>
                              <div class="w-full h-full flex items-center justify-center">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  class="w-6 h-6"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  stroke-width="2"
                                >
                                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                                </svg>
                              </div>
                            </Show>
                          }
                        >
                          <div class="w-full h-full flex items-center justify-center">
                            <svg
                              class="w-6 h-6 text-text-secondary"
                              style={{ color: item.data.color }}
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z" />
                            </svg>
                          </div>
                        </Show>
                        <Show when={!item.data.isOpen && getFolderSpaces(item.data).length > 0}>
                          <div class="w-full h-full grid grid-cols-2 gap-0.5 p-1">
                            <For each={getFolderSpaces(item.data).slice(0, 4)}>
                              {(space, index) => (
                                <div
                                  class={`${index() < 2 ? "row-start-1" : "row-start-2"} ${
                                    index() % 2 === 0 ? "col-start-1" : "col-start-2"
                                  } aspect-square rounded-sm overflow-hidden`}
                                >
                                  <Show
                                    when={space.icon}
                                    fallback={
                                      <div class="w-full h-full bg-surface bg-opacity-40 text-text-primary flex items-center justify-center text-xs font-semibold">
                                        {space.name_acronym}
                                      </div>
                                    }
                                  >
                                    <img
                                      src={`${FS_URL}/space_icons/${space.id}/${space.icon}`}
                                      alt={space.name}
                                      class="w-full h-full object-cover"
                                      draggable="false"
                                    />
                                  </Show>
                                </div>
                              )}
                            </For>
                          </div>
                        </Show>
                        <Show when={!item.data.isOpen && folderContainsActiveSpace(item.data)}>
                          <div class="absolute -left-3 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-primary rounded-r-md" />
                        </Show>
                      </button>
                    </Tooltip>

                    {/* Folder Spaces */}
                    <Show when={item.data.isOpen}>
                      <div class="flex flex-col gap-1 w-full items-center bg-surface bg-opacity-30 rounded-lg p-1 mt-1">
                        <For each={getFolderSpaces(item.data)}>
                          {(space) => {
                            const isDragging = () => draggedSpace() === space.id;
                            // Calculate unread rooms for this specific space
                            const spaceUnreadRooms = createMemo(() => {
                              const allRooms = rooms();
                              return allRooms.filter(
                                (room: any) => String(room.space_id) === String(space.id) && room.unread_count > 0
                              );
                            });

                            return (
                              <div
                                class={`relative flex-shrink-0 w-12 h-12 transition-all duration-200 bg-surface bg-opacity-50 rounded-lg p-1 ${
                                  isDragging() ? "opacity-50 scale-95" : ""
                                } ${dragOverSpace() === space.id ? "transform translate-y-1" : ""}`}
                                onDragOver={(e) => handleItemDragOver(e, "space", space.id)}
                                onDragLeave={handleItemDragLeave}
                                onDrop={(e) => handleItemDrop(e, "space", space.id)}
                              >
                                {/* Space indicators */}
                                <Show when={isSpaceActive() === String(space.id)}>
                                  <div class="absolute -left-2 top-1/2 transform -translate-y-1/2 w-0.5 h-8 bg-primary rounded-r-md z-30"></div>
                                </Show>
                                <Show when={hoveredSpace() === String(space.id) && isSpaceActive() !== String(space.id)}>
                                  <div class="absolute -left-2 top-1/2 transform -translate-y-1/2 w-0.5 h-4 bg-primary rounded-r-md z-30"></div>
                                </Show>
                                <Show
                                  when={
                                    getSpaceUnreadCount(space.id) > 0 &&
                                    getSpaceMentionCount(space.id) === 0 &&
                                    isSpaceActive() !== String(space.id) &&
                                    hoveredSpace() !== String(space.id)
                                  }
                                >
                                  <div class="absolute -left-2 top-1/2 transform -translate-y-1/2 w-0.5 h-2 bg-primary rounded-r-md z-30"></div>
                                </Show>
                                <Show
                                  when={
                                    getSpaceMentionCount(space.id) > 0 &&
                                    isSpaceActive() !== String(space.id) &&
                                    hoveredSpace() !== String(space.id)
                                  }
                                >
                                  <div class="absolute -left-2 top-1/2 transform -translate-y-1/2 w-0.5 h-2 bg-red-500 rounded-r-md z-30"></div>
                                </Show>
                                <Tooltip content={space.name} position="right">
                                  <button
                                    class={`w-10 h-10 flex-shrink-0 ${
                                      isSpaceActive() === String(space.id)
                                        ? "rounded-2xl"
                                        : "rounded-full hover:rounded-2xl"
                                    } bg-surface relative group transition-all duration-200 cursor-grab active:cursor-grabbing`}
                                    draggable={true}
                                    onDragStart={(e) => handleItemDragStart(e, "space", space.id)}
                                    onDragEnd={handleItemDragEnd}
                                    onClick={() => {
                                      const lastSpaceRoute = getLastSpaceRoute(String(space.id));
                                      navigate(lastSpaceRoute);
                                      if (isMobile()) {
                                        setCurrentView("content");
                                      }
                                    }}
                                    onMouseEnter={() => setHoveredSpace(String(space.id))}
                                    onMouseLeave={() => setHoveredSpace(null)}
                                  >
                                    <Show
                                      when={space.icon}
                                      fallback={
                                        <div
                                          class={`w-full h-full bg-surface bg-opacity-20 text-text-primary flex items-center justify-center text-sm font-semibold transition-all duration-200 ${
                                            isSpaceActive() === String(space.id)
                                              ? "rounded-2xl"
                                              : hoveredSpace() === String(space.id)
                                              ? "rounded-2xl"
                                              : "rounded-full"
                                          }`}
                                        >
                                          {space.name_acronym}
                                        </div>
                                      }
                                    >
                                      <img
                                        src={`${FS_URL}/space_icons/${space.id}/${space.icon}`}
                                        alt={space.name}
                                        class={`w-full h-full object-cover transition-all duration-200 ${
                                          isSpaceActive() === String(space.id)
                                            ? "rounded-2xl"
                                            : hoveredSpace() === String(space.id)
                                            ? "rounded-2xl"
                                            : "rounded-full"
                                        }`}
                                        draggable="false"
                                      />
                                    </Show>
                                  </button>
                                </Tooltip>
                                {/* Mention badge for spaces in folders */}
                                <Show when={getSpaceMentionCount(space.id) > 0}>
                                  <div class="absolute -bottom-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center border border-background z-40">
                                    {getSpaceMentionCount(space.id)}
                                  </div>
                                </Show>
                                {/* Unread indicator for spaces in folders */}
                                <Show when={spaceUnreadRooms().length > 0 && getSpaceMentionCount(space.id) === 0}>
                                  <div class="absolute -top-1 -right-1 flex flex-wrap gap-0.5 max-w-6">
                                    <For each={spaceUnreadRooms().slice(0, 3)}>
                                      {() => (
                                        <div class="w-2 h-2 rounded-full bg-red-500 border border-background"></div>
                                      )}
                                    </For>
                                    <Show when={spaceUnreadRooms().length > 3}>
                                      <div class="w-2 h-2 rounded-full bg-red-500 border border-background flex items-center justify-center">
                                        <span class="text-xs text-white font-bold">+</span>
                                      </div>
                                    </Show>
                                  </div>
                                </Show>
                              </div>
                            );
                          }}
                        </For>
                      </div>
                    </Show>
                  </div>
                ) : (
                  <div class="w-full flex flex-col items-center">
                    {/* Drop indicator line above */}
                    <Show when={dragOverSpace() === item.data.id && draggedSpace() !== null && draggedSpace() !== item.data.id}>
                      <div class="w-8 h-0.5 bg-primary rounded-full transition-all duration-200"></div>
                    </Show>
                    <div
                      class={`relative flex-shrink-0 w-12 h-12 transition-all duration-200 ${
                        draggedSpace() === item.data.id ? "opacity-50 scale-95" : ""
                      } ${dragOverSpace() === item.data.id ? "transform translate-y-1" : ""}`}
                      onDragOver={(e) => handleItemDragOver(e, "space", item.data.id)}
                      onDragLeave={handleItemDragLeave}
                      onDrop={(e) => handleItemDrop(e, "space", item.data.id)}
                    >
                      <Show when={isSpaceActive() === String(item.data.id)}>
                        <div class="absolute -left-3 top-1/2 transform -translate-y-1/2 w-1 h-10 bg-primary rounded-r-md z-30"></div>
                      </Show>
                      <Show when={hoveredSpace() === String(item.data.id) && isSpaceActive() !== String(item.data.id)}>
                        <div class="absolute -left-3 top-1/2 transform -translate-y-1/2 w-1 h-5 bg-primary rounded-r-md z-30"></div>
                      </Show>
                      <Show
                        when={
                          getSpaceUnreadCount(item.data.id) > 0 &&
                          getSpaceMentionCount(item.data.id) === 0 &&
                          isSpaceActive() !== String(item.data.id) &&
                          hoveredSpace() !== String(item.data.id)
                        }
                      >
                        <div class="absolute -left-3 top-1/2 transform -translate-y-1/2 w-1 h-2 bg-primary rounded-r-md z-30"></div>
                      </Show>
                      <Show
                        when={
                          getSpaceMentionCount(item.data.id) > 0 &&
                          isSpaceActive() !== String(item.data.id) &&
                          hoveredSpace() !== String(item.data.id)
                        }
                      >
                        <div class="absolute -left-3 top-1/2 transform -translate-y-1/2 w-1 h-2 bg-red-500 rounded-r-md z-30"></div>
                      </Show>
                      <Tooltip content={item.data.name} position="right">
                        <button
                          class={`w-12 h-12 flex-shrink-0 ${
                            isSpaceActive() === String(item.data.id) ? "rounded-2xl" : "rounded-full hover:rounded-2xl"
                          } bg-surface relative group transition-all duration-200 cursor-grab active:cursor-grabbing`}
                          draggable={true}
                          onDragStart={(e) => handleItemDragStart(e, "space", item.data.id)}
                          onDragEnd={handleItemDragEnd}
                          onClick={() => {
                            const lastSpaceRoute = getLastSpaceRoute(String(item.data.id));
                            navigate(lastSpaceRoute);
                            if (isMobile()) {
                              setCurrentView("content");
                            }
                          }}
                          onMouseEnter={() => setHoveredSpace(String(item.data.id))}
                          onMouseLeave={() => setHoveredSpace(null)}
                        >
                          <Show
                            when={item.data.icon}
                            fallback={
                              <div
                                class={`w-full h-full bg-surface bg-opacity-20 text-text-primary flex items-center justify-center text-lg font-semibold transition-all duration-200 ${
                                  isSpaceActive() === String(item.data.id)
                                    ? "rounded-2xl"
                                    : hoveredSpace() === String(item.data.id)
                                    ? "rounded-2xl"
                                    : "rounded-full"
                                }`}
                              >
                                {item.data.name_acronym}
                              </div>
                            }
                          >
                            <img
                              src={`${FS_URL}/space_icons/${item.data.id}/${item.data.icon}`}
                              alt={item.data.name}
                              class={`w-full h-full object-cover transition-all duration-200 ${
                                isSpaceActive() === String(item.data.id)
                                  ? "rounded-2xl"
                                  : hoveredSpace() === String(item.data.id)
                                  ? "rounded-2xl"
                                  : "rounded-full"
                              }`}
                              draggable="false"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                const container = target.parentElement;
                                if (container) {
                                  const isActive = isSpaceActive() === String(item.data.id);
                                  const isHovered = hoveredSpace() === String(item.data.id);
                                  const roundingClass = isActive || isHovered ? "rounded-2xl" : "rounded-full";
                                  container.innerHTML = `<div class="w-full h-full bg-surface bg-opacity-20 text-text-primary flex items-center justify-center text-lg font-semibold transition-all duration-200 ${roundingClass}">${item.data.name_acronym}</div>`;
                                }
                              }}
                            />
                          </Show>
                        </button>
                      </Tooltip>
                      {/* Mention badge for standalone spaces */}
                      <Show when={getSpaceMentionCount(item.data.id) > 0}>
                        <div class="absolute -bottom-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center border-2 border-background z-40">
                          {getSpaceMentionCount(item.data.id)}
                        </div>
                      </Show>
                    </div>
                    {/* Drop indicator line below (for last item) */}
                    <Show
                      when={index() === organizedItems().length - 1 && dragOverSpace() === item.data.id && draggedSpace() !== null && draggedSpace() !== item.data.id}
                    >
                      <div class="w-8 h-0.5 bg-primary rounded-full transition-all duration-200 animate-pulse"></div>
                    </Show>
                    {/* Drop zone below item */}
                    <Show when={showDropZone && index() === organizedItems().length - 1}>
                      <div
                        class="w-full h-2 bg-primary opacity-50 hover:opacity-100 transition-opacity duration-200 rounded-full mt-1"
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.dataTransfer!.dropEffect = "move";
                        }}
                        onDrop={(e) => handleReorderDrop(e, index() + 1)}
                      />
                    </Show>
                  </div>
                )}
              </div>
            );
          }}
        </For>
      </div>

      {/* Bottom buttons container */}
      <div class="flex flex-col gap-2 w-full items-center">
        <Tooltip content="Add a Space" position="right">
          <button
            class="w-12 h-12 rounded-full bg-surface hover:bg-accent transition-all duration-200"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus />
          </button>
        </Tooltip>
        <Tooltip content="Create Folder" position="right">
          <button
            class="w-12 h-12 rounded-full bg-surface hover:bg-accent transition-all duration-200"
            onClick={() => setShowCreateFolderModal(true)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-6 h-6 mx-auto"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              <line x1="12" y1="11" x2="12" y2="17" />
              <line x1="9" y1="14" x2="15" y2="14" />
            </svg>
          </button>
        </Tooltip>
        <Tooltip content="Discover" position="right">
          <button class="w-12 h-12 rounded-full bg-surface hover:bg-accent transition-all duration-200">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-6 h-6 mx-auto"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
          </button>
        </Tooltip>
      </div>

      {/* Create Space Modal */}
      <CreateSpaceModal isOpen={showCreateModal()} onClose={() => setShowCreateModal(false)} />

      {/* Create Folder Modal */}
      <CreateFolderModal
        isOpen={showCreateFolderModal()}
        onClose={() => setShowCreateFolderModal(false)}
        onCreateFolder={handleCreateFolder}
      />

      {/* Folder Settings Modal */}
      <Show when={selectedFolder()}>
        {(folder) => (
          <FolderSettingsModal
            isOpen={showFolderSettingsModal()}
            onClose={() => {
              setShowFolderSettingsModal(false);
              setSelectedFolder(null);
            }}
            folder={folder()}
            onUpdateFolder={handleUpdateFolder}
            onDeleteFolder={handleDeleteFolder}
          />
        )}
      </Show>

      {/* Context Menu */}
      <Show when={contextMenu().isOpen}>
        <ContextMenu
          isOpen={contextMenu().isOpen}
          x={contextMenu().x}
          y={contextMenu().y}
          onClose={closeContextMenu}
          items={[
            {
              label: "Edit Folder",
              onClick: () => {
                const folder = folders().find((f) => f.id === contextMenu().folderId);
                if (folder) {
                  setSelectedFolder(folder);
                  setShowFolderSettingsModal(true);
                }
                closeContextMenu();
              },
            },
            {
              label: "Delete Folder",
              onClick: () => {
                const folderId = contextMenu().folderId;
                if (folderId) {
                  handleDeleteFolder(folderId);
                }
                closeContextMenu();
              },
              danger: true,
            },
          ]}
        />
      </Show>
    </div>
  );
};

export default SpacesList;