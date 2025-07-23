import { Component, createSignal, Show, For, onMount, JSX } from "solid-js";
import { Room, RoomWithRecipients } from "../../types/rooms";
import { useAuth } from "../../lib/providers/auth/AuthProvider";
import { useCache } from "../../lib/providers/cache/CacheProvider";
import { usePermissions } from "../../lib/hooks/usePermissions";
import { api } from "../../lib/api";
import Modal from "./Modal";
import ConfirmModal from "./ConfirmModal";
import SwipeableView from "../shared/SwipeableView";
import { ToastProvider, useToast } from "../common/Toast";
import { RoomType } from "../../types/roomTypes";

// Import icons
import Settings from "../shared/icons/Settings";
import Shield from "../shared/icons/Shield";
import Users from "../shared/icons/Users";
import Crown from "../shared/icons/Crown";
import Ban from "../shared/icons/Ban";
import Check from "../shared/icons/Check";
import Minus from "../shared/icons/Minus";

interface RoomEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: RoomWithRecipients;
}

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface Role {
  id: string;
  name: string;
  color?: string;
  permissions: string[];
  position?: number;
  member_count?: number;
}

interface LocalSpaceMember {
  id: string;
  username: string;
  display_name?: string;
  avatar?: string;
}

// Permission override states
type PermissionOverride = "deny" | "grant" | "default";

interface RolePermissionOverrides {
  [roleId: string]: {
    [permissionId: string]: PermissionOverride;
  };
}

interface MemberPermissionOverrides {
  [memberId: string]: {
    [permissionId: string]: PermissionOverride;
  };
}

const RoomEditModal: Component<RoomEditModalProps> = (props) => {
  const { isMobile } = useAuth();
  const { setRoom, getCachedSpaceRoles, getCachedSpaceMembers, setCachedSpaceRoles, setCachedSpaceMembers } = useCache();
  const { showToast } = useToast();
  const { checkPermission } = usePermissions();
  const [isSidebarOpen, setIsSidebarOpen] = createSignal(true);
  const [activeSection, setActiveSection] = createSignal("overview");
  const [isSaving, setIsSaving] = createSignal(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);
  const [isDeleting, setIsDeleting] = createSignal(false);
  
  // Room settings state
  const [roomName, setRoomName] = createSignal(props.room.name);
  const [roomTopic, setRoomTopic] = createSignal(props.room.topic || "");
  const [slowmode, setSlowmode] = createSignal(0);

  // Permission checking
  const canManageChannels = () => {
    if (!props.room.space_id) return false;
    return checkPermission(props.room.space_id.toString(), "MANAGE_CHANNELS");
  };

  const canDeleteRoom = () => {
    // Can delete space rooms if user has MANAGE_CHANNELS permission
    if (props.room.type === RoomType.TEXT_ROOM || props.room.type === RoomType.VOICE_ROOM || props.room.type === RoomType.SPACE_SECTION) {
      return canManageChannels();
    }
    // Can delete group PMs (handled by backend permission checks)
    if (props.room.type === RoomType.GROUP_PM) {
      return true;
    }
    return false;
  };

  const getRoomTypeName = () => {
    switch (props.room.type) {
      case RoomType.TEXT_ROOM:
        return "Room";
      case RoomType.VOICE_ROOM:
        return "Room";
      case RoomType.SPACE_SECTION:
        return "Section";
      case RoomType.GROUP_PM:
        return "group";
      default:
        return "room";
    }
  };

  const handleDeleteRoom = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDeleteRoom = async () => {
    setIsDeleting(true);
    try {
      await api.rooms.delete(props.room.id);
      showToast("Room deleted successfully", "success");
      setShowDeleteConfirm(false);
      props.onClose(); // Close the edit modal
    } catch (error) {
      console.error("Failed to delete room:", error);
      showToast("Failed to delete room", "error");
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Permission override state
  const [roleOverrides, setRoleOverrides] = createSignal<RolePermissionOverrides>({});
  const [memberOverrides, setMemberOverrides] = createSignal<MemberPermissionOverrides>({});
  const [permissionsLoaded, setPermissionsLoaded] = createSignal(false);
  
  // Selected target for permission editing
  const [selectedTarget, setSelectedTarget] = createSignal<{type: 'role' | 'member', data: Role | LocalSpaceMember} | null>(null);
  
  // Ensure selected target has initialized overrides
  const ensureTargetOverrides = (type: 'role' | 'member', targetId: string) => {
    if (type === 'role') {
      const currentOverrides = roleOverrides();
      if (!currentOverrides[targetId]) {
        // Initialize with all permissions set to default
        const defaultOverrides: { [key: string]: PermissionOverride } = {};
        availablePermissions().forEach(permission => {
          defaultOverrides[permission.id] = "default";
        });
        setRoleOverrides(prev => ({
          ...prev,
          [targetId]: defaultOverrides
        }));
        console.log("[RoomEditModal] Initialized role overrides for:", targetId);
      }
    } else {
      const currentOverrides = memberOverrides();
      if (!currentOverrides[targetId]) {
        // Initialize with all permissions set to default
        const defaultOverrides: { [key: string]: PermissionOverride } = {};
        availablePermissions().forEach(permission => {
          defaultOverrides[permission.id] = "default";
        });
        setMemberOverrides(prev => ({
          ...prev,
          [targetId]: defaultOverrides
        }));
        console.log("[RoomEditModal] Initialized member overrides for:", targetId);
      }
    }
  };
  
  // Data from cache
  const [availablePermissions] = createSignal<Permission[]>([
    { id: "VIEW_ROOM", name: "View Room", description: "View and access this room", category: "general" },
    { id: "SEND_MESSAGES", name: "Send Messages", description: "Send messages in this room", category: "text" },
    { id: "MANAGE_MESSAGES", name: "Manage Messages", description: "Delete and edit messages", category: "text" },
    { id: "READ_MESSAGE_HISTORY", name: "Read Message History", description: "Read previous messages", category: "text" },
    { id: "ADD_REACTIONS", name: "Add Reactions", description: "Add reactions to messages", category: "text" },
    { id: "ATTACH_FILES", name: "Attach Files", description: "Upload files and media", category: "text" },
    { id: "EMBED_LINKS", name: "Embed Links", description: "Links sent will be embedded", category: "text" },
    { id: "MENTION_EVERYONE", name: "Mention @everyone", description: "Use @everyone and @here mentions", category: "text" },
    { id: "USE_EXTERNAL_EMOJIS", name: "Use External Emojis", description: "Use emojis from other spaces", category: "text" },
  ]);
  
  const [spaceRoles, setSpaceRoles] = createSignal<Role[]>([]);
  const [spaceMembers, setSpaceMembers] = createSignal<LocalSpaceMember[]>([]);
  
  // Fetch roles if needed
  const fetchRolesIfNeeded = async () => {
    if (!props.room.space_id) return;
    
    const spaceId = props.room.space_id.toString();
    
    // Check if we have valid cached data
    const cachedRoles = getCachedSpaceRoles(spaceId);
    if (cachedRoles) {
      const convertedRoles = cachedRoles.map((role: any) => ({
        id: role.role_id,
        name: role.name,
        color: role.color || '#99aab5',
        permissions: role.permissions || [],
        position: role.position || 0,
        member_count: 0
      }));
      setSpaceRoles(convertedRoles);
      return;
    }

    try {
      const response = await api.spaces.roles.list(spaceId) as { roles: any[] };
      setCachedSpaceRoles(spaceId, response.roles || []);
      
      const convertedRoles = (response.roles || []).map((role: any) => ({
        id: role.role_id,
        name: role.name,
        color: role.color || '#99aab5',
        permissions: role.permissions || [],
        position: role.position || 0,
        member_count: 0
      }));
      setSpaceRoles(convertedRoles);
    } catch (error) {
      console.error("Failed to fetch space roles:", error);
    }
  };

  // Fetch members if needed
  const fetchMembersIfNeeded = async () => {
    if (!props.room.space_id) return;
    
    const spaceId = props.room.space_id.toString();
    
    // Check if we have valid cached data
    const cachedMembers = getCachedSpaceMembers(spaceId);
    if (cachedMembers && cachedMembers.length > 0) {
      const convertedMembers = cachedMembers.map((member: any) => ({
        id: member.user_id,
        username: member.user?.username || `user_${member.user_id}`,
        display_name: member.user?.display_name || member.user?.username || `User ${member.user_id}`,
        avatar: member.user?.avatar || ''
      }));
      setSpaceMembers(convertedMembers);
      return;
    }

    try {
      const response = await api.spaces.members.list(spaceId) as { members: any[] };
      setCachedSpaceMembers(spaceId, response.members || []);
      
      const convertedMembers = (response.members || []).map((member: any) => ({
        id: member.user_id,
        username: member.user?.username || `user_${member.user_id}`,
        display_name: member.user?.display_name || member.user?.username || `User ${member.user_id}`,
        avatar: member.user?.avatar || ''
      }));
      setSpaceMembers(convertedMembers);
    } catch (error) {
      console.error("Failed to fetch space members:", error);
    }
  };

  // Store original overrides for change detection
  const [originalRoleOverrides, setOriginalRoleOverrides] = createSignal<RolePermissionOverrides>({});
  const [originalMemberOverrides, setOriginalMemberOverrides] = createSignal<MemberPermissionOverrides>({});

  // Load existing permission overrides
  const loadExistingOverrides = async () => {
    try {
      console.log("[RoomEditModal] Loading permission overrides for room:", props.room.id);
      
      const response = await api.rooms.permissions.get(props.room.id) as {
        room_id: string;
        roles: Array<{
          role_id: string;
          overrides: Array<{
            permission_id: string;
            override: string;
          }>;
        }>;
        members: Array<{
          user_id: string;
          overrides: Array<{
            permission_id: string;
            override: string;
          }>;
        }>;
      };
      
      console.log("[RoomEditModal] Received permission data:", response);
      console.log("[RoomEditModal] Available roles:", spaceRoles());
      console.log("[RoomEditModal] Available members:", spaceMembers());
      console.log("[RoomEditModal] Available permissions:", availablePermissions());

      // Initialize role overrides - only for roles that have explicit overrides
      const newRoleOverrides: RolePermissionOverrides = {};
      
      // Process existing role overrides from server
      console.log(response)
      if (response.roles && response.roles.length > 0) {
        response.roles.forEach(override => {
          console.log("[RoomEditModal] Processing role override:", override);
          
          // Verify this role still exists in the space
          const roleExists = spaceRoles().some(role => role.id === override.role_id);
          if (!roleExists) {
            console.warn("[RoomEditModal] Role not found in space:", override.role_id);
            return;
          }
          
          // Initialize role permissions object
          newRoleOverrides[override.role_id] = {};
          
          // Set all permissions to default first
          availablePermissions().forEach(permission => {
            newRoleOverrides[override.role_id][permission.id] = "default";
          });
          
          // Apply overrides from the API response
          if (override.overrides && override.overrides.length > 0) {
            override.overrides.forEach(permissionOverride => {
              if (availablePermissions().some(p => p.id === permissionOverride.permission_id)) {
                newRoleOverrides[override.role_id][permissionOverride.permission_id] = permissionOverride.override as PermissionOverride;
                console.log("[RoomEditModal] Set role", override.role_id, "permission", permissionOverride.permission_id, "to", permissionOverride.override);
              }
            });
          }
        });
      }

      // Initialize member overrides - only for members that have explicit overrides
      const newMemberOverrides: MemberPermissionOverrides = {};
      
      // Process existing member overrides from server
      if (response.members && response.members.length > 0) {
        response.members.forEach(override => {
          console.log("[RoomEditModal] Processing member override:", override);
          
          // Verify this member still exists in the space
          const memberExists = spaceMembers().some(member => member.id === override.user_id);
          if (!memberExists) {
            console.warn("[RoomEditModal] Member not found in space:", override.user_id);
            return;
          }
          
          // Initialize member permissions object
          newMemberOverrides[override.user_id] = {};
          
          // Set all permissions to default first
          availablePermissions().forEach(permission => {
            newMemberOverrides[override.user_id][permission.id] = "default";
          });
          
          // Apply overrides from the API response
          if (override.overrides && override.overrides.length > 0) {
            override.overrides.forEach(permissionOverride => {
              if (availablePermissions().some(p => p.id === permissionOverride.permission_id)) {
                newMemberOverrides[override.user_id][permissionOverride.permission_id] = permissionOverride.override as PermissionOverride;
                console.log("[RoomEditModal] Set member", override.user_id, "permission", permissionOverride.permission_id, "to", permissionOverride.override);
              }
            });
          }
        });
      }

      console.log("[RoomEditModal] Final role overrides:", newRoleOverrides);
      console.log("[RoomEditModal] Final member overrides:", newMemberOverrides);
      
      setRoleOverrides(newRoleOverrides);
      setMemberOverrides(newMemberOverrides);
      
      // Store original state for change detection
      setOriginalRoleOverrides(JSON.parse(JSON.stringify(newRoleOverrides)));
      setOriginalMemberOverrides(JSON.parse(JSON.stringify(newMemberOverrides)));
      
      // Mark permissions as loaded
      setPermissionsLoaded(true);
      
      console.log("[RoomEditModal] Permission overrides loaded successfully");
    } catch (error) {
      console.error("[RoomEditModal] Failed to load existing permission overrides:", error);
      showToast("Failed to load permission data", "error");
      setPermissionsLoaded(true); // Still mark as loaded to show UI
    }
  };

  // Load data on mount
  onMount(async () => {
    await fetchRolesIfNeeded();
    await fetchMembersIfNeeded();
    await loadExistingOverrides();
  });

  // const space = () => getSpace(props.room.space_id?.toString() || "");

  const sections = ["overview", "permissions"];

  const handleSwipeLeft = () => {
    const currentIndex = sections.indexOf(activeSection());
    if (currentIndex < sections.length - 1) {
      setActiveSection(sections[currentIndex + 1]);
    }
  };

  const handleSwipeRight = () => {
    const currentIndex = sections.indexOf(activeSection());
    if (currentIndex > 0) {
      setActiveSection(sections[currentIndex - 1]);
    }
  };

  const handleSaveOverview = async () => {
    if (isSaving()) return;
    
    setIsSaving(true);
    
    try {
      const updateData: { name?: string; topic?: string } = {};
      
      // Only include fields that have changed
      if (roomName() !== props.room.name) {
        updateData.name = roomName();
      }
      
      if (roomTopic() !== (props.room.topic || "")) {
        updateData.topic = roomTopic();
      }
      
      // Only make API call if there are changes
      if (Object.keys(updateData).length === 0) {
        showToast("No changes to save", "info");
        return;
      }
      
      await api.rooms.update(props.room.id, updateData);
      
      // Update the room in cache
        const updatedRoom: Room = {
          id: props.room.id,
          name: updateData.name ?? props.room.name,
          topic: updateData.topic ?? props.room.topic,
          type: props.room.type,
          recipients: props.room.recipients,
          owner_id: props.room.owner_id,
          last_message_id: props.room.last_message_id,
          icon: props.room.icon ?? undefined,
          created_at: props.room.created_at,
          updated_at: props.room.updated_at ?? undefined,
          space_id: props.room.space_id,
          parent_id: props.room.parent_id,
          position: props.room.position
        };
        setRoom(updatedRoom);
      
      showToast("Room updated successfully", "success");
    } catch (error) {
      console.error("Failed to update room:", error);
      showToast("Failed to update room", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePermissionOverride = async (
    type: "role" | "member",
    targetId: string,
    permission: string,
    value: PermissionOverride
  ) => {
    console.log(`[RoomEditModal] Setting ${type} ${targetId} permission ${permission} to ${value}`);
    
    try {
      // Call the new individual permission update API
      if (type === "role") {
        await api.rooms.permissions.updateRolePermission(props.room.id, targetId, permission, value);
      } else {
        await api.rooms.permissions.updateMemberPermission(props.room.id, targetId, permission, value);
      }
      
      // Update local state to reflect the change
      if (type === "role") {
        setRoleOverrides(prev => {
          const currentOverrides = prev[targetId] || {};
          
          // If setting to default, check if we should remove the entire entry
          if (value === "default") {
            const newOverrides = { ...currentOverrides, [permission]: value };
            
            // Check if all permissions are now default
            const allDefault = availablePermissions().every(p => 
              (newOverrides[p.id] || "default") === "default"
            );
            
            if (allDefault) {
              // Remove the entire role entry if all permissions are default
              const { [targetId]: removed, ...rest } = prev;
              return rest;
            }
          }
          
          return {
            ...prev,
            [targetId]: {
              ...currentOverrides,
              [permission]: value
            }
          };
        });
      } else {
        setMemberOverrides(prev => {
          const currentOverrides = prev[targetId] || {};
          
          // If setting to default, check if we should remove the entire entry
          if (value === "default") {
            const newOverrides = { ...currentOverrides, [permission]: value };
            
            // Check if all permissions are now default
            const allDefault = availablePermissions().every(p => 
              (newOverrides[p.id] || "default") === "default"
            );
            
            if (allDefault) {
              // Remove the entire member entry if all permissions are default
              const { [targetId]: removed, ...rest } = prev;
              return rest;
            }
          }
          
          return {
            ...prev,
            [targetId]: {
              ...currentOverrides,
              [permission]: value
            }
          };
        });
      }
      
      showToast(`Permission updated successfully`, "success");
    } catch (error) {
      console.error(`Failed to update ${type} permission:`, error);
      showToast(`Failed to update permission`, "error");
    }
  };

  const getPermissionOverride = (
    type: "role" | "member",
    targetId: string,
    permission: string
  ): PermissionOverride => {
    const overrides = type === "role" ? roleOverrides() : memberOverrides();
    
    // If the target doesn't exist in overrides, it means no explicit overrides are set
    if (!overrides[targetId]) {
      return "default";
    }
    
    // Return the specific permission override, defaulting to "default" if not set
    return overrides[targetId][permission] || "default";
  };

  // Check if there are any permission changes
  const hasPermissionChanges = () => {
    // Don't allow changes if permissions aren't loaded yet
    if (!permissionsLoaded()) return false;
    
    const currentRoles = roleOverrides();
    const currentMembers = memberOverrides();
    const originalRoles = originalRoleOverrides();
    const originalMembers = originalMemberOverrides();
    
    return JSON.stringify(currentRoles) !== JSON.stringify(originalRoles) ||
           JSON.stringify(currentMembers) !== JSON.stringify(originalMembers);
  };

  const PermissionOverrideButton: Component<{
    type: "role" | "member";
    targetId: string;
    permission: string;
    value: PermissionOverride;
    label: JSX.Element;
    color: string;
  }> = (buttonProps) => {
    const isActive = () => {
      // Only check active state if permissions are loaded
      if (!permissionsLoaded()) return false;
      return getPermissionOverride(buttonProps.type, buttonProps.targetId, buttonProps.permission) === buttonProps.value;
    };
    
    const states = {
      deny: "rounded-l-lg border-r border-border/50", 
      default: "border-r border-border/50", 
      grant: "rounded-r-lg"
    };

    return (
      <button
        onClick={() => handlePermissionOverride(buttonProps.type, buttonProps.targetId, buttonProps.permission, buttonProps.value)}
        disabled={!permissionsLoaded()}
        class={`px-3 py-2 text-sm transition-all duration-200 font-medium min-w-[60px] flex items-center justify-center ${
          !permissionsLoaded() 
            ? `text-text-secondary/50 bg-surface/50 cursor-not-allowed ${states[buttonProps.value]}`
            : isActive()
            ? `${buttonProps.color} text-white shadow-sm ${states[buttonProps.value]}`
            : `text-text-secondary hover:text-text-primary hover:bg-surface ${states[buttonProps.value]}`
        }`}
        title={!permissionsLoaded() ? "Loading..." : `${buttonProps.value === 'deny' ? 'Deny' : buttonProps.value === 'grant' ? 'Allow' : 'Default'} permission`}
      >
        {buttonProps.label}
      </button>
    );
  };

  const renderOverviewContent = () => (
    <div class="space-y-6">
      {/* Room Information */}
      <div class="bg-background1 rounded-lg p-6">
        <div class="flex items-center gap-4 mb-4">
          <div class="p-2 bg-primary/10 rounded-lg">
            <Settings />
          </div>
          <h3 class="text-lg font-semibold text-text-primary">Room Information</h3>
        </div>
        <div class="space-y-4">
          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium text-text-primary">Room Name</label>
            <input
              type="text"
              value={roomName()}
              onInput={(e) => setRoomName(e.currentTarget.value)}
              class="p-3 bg-background2 border border-border rounded-lg text-text-primary focus:border-primary focus:outline-none transition-colors"
              placeholder="Enter room name"
            />
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium text-text-primary">Room Topic</label>
            <textarea
              value={roomTopic()}
              onInput={(e) => setRoomTopic(e.currentTarget.value)}
              rows={3}
              class="p-3 bg-background2 border border-border rounded-lg text-text-primary resize-none focus:border-primary focus:outline-none transition-colors"
              placeholder="Describe what this room is about..."
            />
          </div>
        </div>
      </div>

      {/* Room Settings */}
       <div class="bg-background1 rounded-lg p-6">
          <div class="flex items-center gap-4 mb-4">
            <div class="p-2 bg-blue-500/10 rounded-lg">
              <Settings />
            </div>
            <h3 class="text-lg font-semibold text-text-primary">Room Settings</h3>
          </div>
        <div class="space-y-4">
          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium text-text-primary">Slowmode</label>
            <select
              value={slowmode()}
              onChange={(e) => setSlowmode(parseInt(e.currentTarget.value))}
              class="p-3 bg-background2 border border-border rounded-lg text-text-primary focus:border-primary focus:outline-none transition-colors"
            >
              <option value={0}>Off</option>
              <option value={5}>5 seconds</option>
              <option value={10}>10 seconds</option>
              <option value={15}>15 seconds</option>
              <option value={30}>30 seconds</option>
              <option value={60}>1 minute</option>
              <option value={120}>2 minutes</option>
              <option value={300}>5 minutes</option>
              <option value={600}>10 minutes</option>
            </select>
            <p class="text-xs text-text-secondary">Limit how frequently members can send messages</p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div class="flex justify-end">
        <button
          onClick={handleSaveOverview}
          disabled={isSaving()}
          class={`px-6 py-2 rounded-lg transition-colors font-medium ${
            isSaving() 
              ? 'bg-gray-400 text-gray-600 cursor-not-allowed' 
              : 'bg-green-500 text-white hover:bg-green-600 shadow-md hover:shadow-lg'
          }`}
        >
          {isSaving() ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );

  const renderPermissionsContent = () => (
    <div class="flex gap-6 h-full">
      {/* Left Sidebar - Roles and Members List */}
      <div class="w-1/3 bg-background1 rounded-lg p-4 flex flex-col">
        <div class="flex items-center gap-4 mb-4">
          <div class="p-2 bg-primary/10 rounded-lg">
            <Shield />
          </div>
          <h3 class="text-lg font-semibold text-text-primary">Roles & Members</h3>
        </div>
        
        <div class="flex-1 overflow-y-auto space-y-6">
          {/* Roles Section */}
          <div>
            <h4 class="text-sm font-medium text-text-secondary uppercase mb-3 tracking-wide flex items-center gap-2">
              <Crown class="w-4 h-4" />
              Roles
            </h4>
            <div class="space-y-1 max-h-48 overflow-y-auto">
              <For each={spaceRoles().sort((a, b) => (b.position || 0) - (a.position || 0))}>
                {(role) => (
                  <div
                    class={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                      selectedTarget()?.type === 'role' && selectedTarget()?.data.id === role.id
                        ? "bg-primary text-white shadow-md"
                        : "bg-background2 hover:bg-background2/80 border border-transparent hover:border-border"
                    }`}
                    onClick={() => {
                      setSelectedTarget({type: 'role', data: role});
                      // Ensure this role has initialized overrides
                      if (permissionsLoaded()) {
                        ensureTargetOverrides('role', role.id);
                      }
                    }}
                  >
                    <div class="flex items-center gap-3">
                      <div
                        class="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ "background-color": role.color || "#99aab5" }}
                      />
                      <div class="flex-1 min-w-0">
                        <div class="text-sm font-medium truncate">{role.name}</div>
                        <div class="text-xs opacity-75">{role.member_count || 0} members</div>
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
          
          {/* Members Section */}
          <div>
            <h4 class="text-sm font-medium text-text-secondary uppercase mb-3 tracking-wide flex items-center gap-2">
              <Users class="w-4 h-4" />
              Members
            </h4>
            <div class="space-y-1 max-h-48 overflow-y-auto">
              <For each={spaceMembers()}>
                {(member) => (
                  <div
                    class={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                      selectedTarget()?.type === 'member' && selectedTarget()?.data.id === member.id
                        ? "bg-primary text-white shadow-md"
                        : "bg-background2 hover:bg-background2/80 border border-transparent hover:border-border"
                    }`}
                    onClick={() => {
                      setSelectedTarget({type: 'member', data: member});
                      // Ensure this member has initialized overrides
                      if (permissionsLoaded()) {
                        ensureTargetOverrides('member', member.id);
                      }
                    }}
                  >
                    <div class="flex items-center gap-3">
                      <div class="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                        {(member.display_name || member.username || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="text-sm font-medium truncate">
                          {member.display_name || member.username}
                        </div>
                        <div class="text-xs opacity-75">@{member.username}</div>
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>
      </div>
      
      {/* Right Panel - Permission Overrides */}
      <div class="flex-1 bg-background1 rounded-lg p-6 flex flex-col">
        <Show
          when={permissionsLoaded()}
          fallback={
            <div class="flex items-center justify-center h-full text-center">
              <div class="space-y-3">
                <div class="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto animate-pulse">
                  <Shield />
                </div>
                <div class="text-text-secondary">
                  <div class="font-medium">Loading Permissions</div>
                  <div class="text-sm">Please wait while we fetch permission data...</div>
                </div>
              </div>
            </div>
          }
        >
          <Show
            when={selectedTarget()}
            fallback={
              <div class="flex items-center justify-center h-full text-center">
                <div class="space-y-3">
                  <div class="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto">
                    <Shield />
                  </div>
                  <div class="text-text-secondary">
                    <div class="font-medium">No Target Selected</div>
                    <div class="text-sm">Choose a role or member from the left to configure permission overrides.</div>
                  </div>
                </div>
              </div>
            }
          >
            <div class="h-full flex flex-col">
            {/* Header */}
            <div class="flex items-center justify-between mb-6">
              <div class="flex items-center gap-3">
                <div class="p-2 bg-primary/10 rounded-lg">
                  <Show when={selectedTarget()?.type === 'role'}>
                    <div
                      class="w-5 h-5 rounded-full"
                      style={{ "background-color": (selectedTarget()?.data as Role)?.color || "#99aab5" }}
                    />
                  </Show>
                  <Show when={selectedTarget()?.type === 'member'}>
                    <div class="w-5 h-5 bg-primary rounded-full flex items-center justify-center text-white text-xs font-medium">
                      {(selectedTarget()?.data as LocalSpaceMember)?.display_name?.charAt(0) || (selectedTarget()?.data as LocalSpaceMember)?.username.charAt(0)}
                    </div>
                  </Show>
                </div>
                <div>
                  <h3 class="text-lg font-semibold text-text-primary">
                    {selectedTarget()?.type === 'role' ? (selectedTarget()?.data as Role)?.name : (selectedTarget()?.data as LocalSpaceMember)?.display_name || (selectedTarget()?.data as LocalSpaceMember)?.username}
                  </h3>
                  <p class="text-sm text-text-secondary">
                    {selectedTarget()?.type === 'role' ? 'Role Permission Overrides' : 'Member Permission Overrides'}
                  </p>
                </div>
              </div>
              
              {/* Reset button */}
              <button
                onClick={() => {
                  const targetId = selectedTarget()!.data.id;
                  const type = selectedTarget()!.type;
                  const resetOverrides: { [key: string]: PermissionOverride } = {};
                  
                  // Set all permissions to default
                  availablePermissions().forEach(permission => {
                    resetOverrides[permission.id] = "default";
                  });
                  
                  if (type === 'role') {
                    setRoleOverrides(prev => ({
                      ...prev,
                      [targetId]: resetOverrides
                    }));
                  } else {
                    setMemberOverrides(prev => ({
                      ...prev,
                      [targetId]: resetOverrides
                    }));
                  }
                }}
                class="px-3 py-2 text-sm bg-surface hover:bg-background2 text-text-secondary hover:text-text-primary rounded-lg transition-colors border border-border"
              >
                Reset All
              </button>
            </div>
            
            <div class="text-text-secondary text-sm mb-4">
              Configure permission overrides for this room. These settings override space permissions.
            </div>
            
            {/* Permissions list with scrolling */}
            <div class="flex-1 overflow-y-auto space-y-3 pr-2">
              <For each={availablePermissions()}>
                {(permission) => (
                  <div class="p-4 bg-background2 rounded-lg border border-border hover:border-primary/30 transition-colors">
                    <div class="flex items-start justify-between gap-4">
                      <div class="flex-1 min-w-0">
                        <div class="font-medium text-text-primary mb-1">{permission.name}</div>
                        <div class="text-sm text-text-secondary leading-relaxed">{permission.description}</div>
                      </div>
                      <div class="flex border border-border rounded-lg overflow-hidden bg-background1">
                        <PermissionOverrideButton
                          type={selectedTarget()!.type}
                          targetId={selectedTarget()!.data.id}
                          permission={permission.id}
                          value="deny"
                          label={<Ban class="w-4 h-4" />}
                          color="bg-red-500 hover:bg-red-600"
                        />
                        <PermissionOverrideButton
                          type={selectedTarget()!.type}
                          targetId={selectedTarget()!.data.id}
                          permission={permission.id}
                          value="default"
                          label={<Minus class="w-4 h-4" />}
                          color="bg-gray-500 hover:bg-gray-600"
                        />
                        <PermissionOverrideButton
                          type={selectedTarget()!.type}
                          targetId={selectedTarget()!.data.id}
                          permission={permission.id}
                          value="grant"
                          label={<Check class="w-4 h-4" />}
                          color="bg-green-500 hover:bg-green-600"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </div>
            
            {/* Save button */}
            <div class="mt-6 pt-4 border-t border-border">
              <div class="flex justify-end gap-3">
                <button
                  onClick={() => {
                    const targetId = selectedTarget()!.data.id;
                    const type = selectedTarget()!.type;
                    const resetOverrides: { [key: string]: PermissionOverride } = {};
                    
                    // Set all permissions to default
                    availablePermissions().forEach(permission => {
                      resetOverrides[permission.id] = "default";
                    });
                    
                    if (type === 'role') {
                      setRoleOverrides(prev => ({
                        ...prev,
                        [targetId]: resetOverrides
                      }));
                    } else {
                      setMemberOverrides(prev => ({
                        ...prev,
                        [targetId]: resetOverrides
                      }));
                    }
                  }}
                  class="px-4 py-2 text-sm bg-surface hover:bg-background2 text-text-secondary hover:text-text-primary rounded-lg transition-colors border border-border"
                >
                  Reset
                </button>
                <div class="text-sm text-text-secondary bg-green-50 border border-green-200 rounded-lg p-3">
                  <div class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                    </svg>
                    <span class="text-green-800 font-medium">Auto-save enabled</span>
                  </div>
                  <p class="text-green-700 mt-1">Permission changes are saved automatically when you make them.</p>
                </div>
              </div>
            </div>
          </div>
        </Show>
      </Show>
    </div>
  </div>
);

  const renderContent = () => {
    switch (activeSection()) {
      case "overview":
        return renderOverviewContent();
      case "permissions":
        return renderPermissionsContent();
      default:
        return <div class="text-text-secondary">Section not found</div>;
    }
  };

  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose} type="full">
      <ToastProvider usePortal={false}>
        <div
          class={`h-screen w-full flex ${
            (!isMobile() && props.isOpen) || (isMobile() && isSidebarOpen())
              ? ""
              : "bg-background2"
          }`}
        >
          <Show
            when={
              (!isMobile() && props.isOpen) || (isMobile() && isSidebarOpen())
            }
          >
            <div class="w-1/2 bg-background1"></div>
            <div class="w-1/2 bg-background2"></div>
          </Show>
          <div class="absolute inset-0 flex justify-center">
            <div class="flex w-full max-w-[1320px] px-4 md:px-6">
              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen())}
                class="md:hidden fixed top-4 left-4 z-50 p-2 text-text-primary hover:bg-surface rounded-md"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class={`w-6 h-6 transition-transform duration-300 ${
                    isSidebarOpen() ? "rotate-180" : ""
                  }`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {/* Sidebar */}
              <Show
                when={
                  (!isMobile() && props.isOpen) ||
                  (isMobile() && isSidebarOpen())
                }
              >
                <div
                  class={`fixed md:relative w-[280px] md:w-[218px] bg-background1 h-full flex flex-col z-40 transition-transform ${
                    !isSidebarOpen() && isMobile()
                      ? "-translate-x-full"
                      : "translate-x-0"
                  }`}
                >
                  <div class="flex-1 py-[20px] px-[6px] overflow-y-auto">
                    {/* Room Header */}
                    <div class="px-2 mt-16 mb-4">
                      <div class="flex items-center gap-3 mb-4">
                        <div class="w-12 h-12 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-lg">
                          #
                        </div>
                        <div class="flex-1 min-w-0">
                          <h2 class="text-lg font-semibold text-text-primary truncate">
                            {props.room.name || "Unknown Room"}
                          </h2>
                          <p class="text-xs text-text-secondary">
                            Room Settings
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Separator Line */}
                    <div class="mx-2 mb-4 border-t border-border"></div>

                    {/* Room Settings Section */}
                    <div class="px-2 mb-2">
                      <h3 class="px-[10px] mb-1 text-xs font-semibold text-text-secondary uppercase">
                        Room Settings
                      </h3>
                      <div class="space-y-[2px]">
                        <button
                          onClick={() => {
                            setActiveSection("overview");
                            isMobile() && setIsSidebarOpen(false);
                          }}
                          class={`w-full px-[10px] py-[6px] rounded-[4px] text-left text-base hover:bg-surface ${
                            activeSection() === "overview"
                              ? "bg-surface"
                              : ""
                          } text-text-primary flex items-center gap-3`}
                        >
                          <Settings />
                          Overview
                        </button>
                        <button
                          onClick={() => {
                            setActiveSection("permissions");
                            isMobile() && setIsSidebarOpen(false);
                          }}
                          class={`w-full px-[10px] py-[6px] rounded-[4px] text-left text-base hover:bg-surface ${
                            activeSection() === "permissions"
                              ? "bg-surface"
                              : ""
                          } text-text-primary flex items-center gap-3`}
                        >
                          <Shield />
                          Permissions
                        </button>
                      </div>
                    </div>

                    {/* Separator Line */}
                    <Show when={canDeleteRoom()}>
                      <div class="mx-2 my-4 border-t border-border"></div>
                      
                      {/* Danger Zone Section */}
                      <div class="px-2 mb-2">
                        <h3 class="px-[10px] mb-1 text-xs font-semibold text-red-400 uppercase">
                          Danger Zone
                        </h3>
                        <div class="space-y-[2px]">
                          <button
                            onClick={handleDeleteRoom}
                            class="w-full px-[10px] py-[6px] rounded-[4px] text-left text-base hover:bg-red-500/10 text-red-400 hover:text-red-300 flex items-center gap-3 transition-colors"
                          >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete {getRoomTypeName()}
                          </button>
                        </div>
                      </div>
                    </Show>
                  </div>
                </div>
              </Show>

              {/* Main content area */}
              <div class="flex-1 bg-background2 h-full flex flex-col ml-0 relative">
                {/* Top bar with close button */}
                <div class="h-[60px] flex items-center justify-end px-5 bg-background2">
                  <div class="md:absolute md:right-[-35px] md:top-20 flex flex-col items-center fixed right-4 top-4 z-50">
                    <button
                      onClick={props.onClose}
                      class="w-[40px] h-[40px] flex items-center justify-center rounded-full hover:bg-background transition-colors duration-200 border cursor-pointer"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="text-text-secondary w-5 h-5"
                      >
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                    <span class="text-text-secondary text-xs mt-1 hidden md:block">
                      ESC
                    </span>
                  </div>
                </div>

                {/* Content */}
                <SwipeableView
                  class="flex-1 min-h-0 flex flex-col"
                  onSwipeLeft={handleSwipeLeft}
                  onSwipeRight={handleSwipeRight}
                >
                  <div class="py-[20px] px-4 md:px-10 h-full overflow-y-auto pr-[50px] md:pr-[60px] flex-1">
                    {renderContent()}
                  </div>
                </SwipeableView>
              </div>
            </div>
          </div>
        </div>
      </ToastProvider>
      
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm()}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDeleteRoom}
        title={`Delete ${getRoomTypeName()}`}
        description={`Are you sure you want to delete "${props.room.name}"? This will permanently delete the ${getRoomTypeName().toLowerCase()} and all its messages.`}
        confirmText={`Delete ${getRoomTypeName()}`}
        cancelText="Cancel"
        isLoading={isDeleting()}
        variant="danger"
        icon={
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        }
      />
    </Modal>
  );
};

export default RoomEditModal;