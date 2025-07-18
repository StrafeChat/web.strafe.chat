import { Component, createSignal, Show, For, onMount, JSX } from "solid-js";
import { Room, RoomWithRecipients } from "../../types/rooms";
import { useAuth } from "../../lib/providers/auth/AuthProvider";
import { useCache } from "../../lib/providers/cache/CacheProvider";
import { api } from "../../lib/api";
import Modal from "./Modal";
import SwipeableView from "../shared/SwipeableView";
import { ToastProvider, useToast } from "../common/Toast";

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
  const { isMobile, user } = useAuth();
  const { setRoom, getSpace, getCachedSpaceRoles, getCachedSpaceMembers, setCachedSpaceRoles, setCachedSpaceMembers } = useCache();
  const { showToast } = useToast();
  const [isSidebarOpen, setIsSidebarOpen] = createSignal(true);
  const [activeSection, setActiveSection] = createSignal("overview");
  const [isSaving, setIsSaving] = createSignal(false);
  
  // Room settings state
  const [roomName, setRoomName] = createSignal(props.room.name);
  const [roomTopic, setRoomTopic] = createSignal(props.room.topic || "");
  const [slowmode, setSlowmode] = createSignal(0);
  
  // Permission override state
  const [roleOverrides, setRoleOverrides] = createSignal<RolePermissionOverrides>({});
  const [memberOverrides, setMemberOverrides] = createSignal<MemberPermissionOverrides>({});
  
  // Selected target for permission editing
  const [selectedTarget, setSelectedTarget] = createSignal<{type: 'role' | 'member', data: Role | LocalSpaceMember} | null>(null);
  
  // Data from cache
  const [availablePermissions] = createSignal<Permission[]>([
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

  // Load data on mount
  onMount(() => {
    fetchRolesIfNeeded();
    fetchMembersIfNeeded();
  });

  const space = () => getSpace(props.room.space_id?.toString() || "");

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

  const handlePermissionOverride = (
    type: "role" | "member",
    targetId: string,
    permission: string,
    value: PermissionOverride
  ) => {
    if (type === "role") {
      setRoleOverrides(prev => ({
        ...prev,
        [targetId]: {
          ...prev[targetId],
          [permission]: value
        }
      }));
    } else {
      setMemberOverrides(prev => ({
        ...prev,
        [targetId]: {
          ...prev[targetId],
          [permission]: value
        }
      }));
    }
  };

  const getPermissionOverride = (
    type: "role" | "member",
    targetId: string,
    permission: string
  ): PermissionOverride => {
    const overrides = type === "role" ? roleOverrides() : memberOverrides();
    return overrides[targetId]?.[permission] || "default";
  };

  const PermissionOverrideButton: Component<{
    type: "role" | "member";
    targetId: string;
    permission: string;
    value: PermissionOverride;
    label: JSX.Element;
    color: string;
  }> = (buttonProps) => {
    const isActive = () => getPermissionOverride(buttonProps.type, buttonProps.targetId, buttonProps.permission) === buttonProps.value;
    const states = {deny: "rounded-l-md", default: "", grant: "rounded-r-md"}

    return (
      <button
        onClick={() => handlePermissionOverride(buttonProps.type, buttonProps.targetId, buttonProps.permission, buttonProps.value)}
        class={`px-2 py-1 text-xs transition-colors ${
          isActive()
            ? `${buttonProps.color} text-white ${states[buttonProps.value]}`
            : "text-text-secondary"
        }`}
      >
        {buttonProps.label}
      </button>
    );
  };

  const renderOverviewContent = () => (
    <div class="space-y-6">
      <div>
        <h2 class="text-xl font-semibold text-text-primary mb-4">Room Overview</h2>
        <p class="text-text-secondary mb-6">Manage basic room settings and configuration.</p>
      </div>

      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-text-primary mb-2">
            Room Name
          </label>
          <input
            type="text"
            value={roomName()}
            onInput={(e) => setRoomName(e.currentTarget.value)}
            class="w-full px-3 py-2 bg-surface border border-border rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Enter room name"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-text-primary mb-2">
            Room Topic
          </label>
          <textarea
            value={roomTopic()}
            onInput={(e) => setRoomTopic(e.currentTarget.value)}
            class="w-full px-3 py-2 bg-surface border border-border rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            rows="3"
            placeholder="Enter room topic (optional)"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-text-primary mb-2">
            Slowmode
          </label>
          <select
            value={slowmode()}
            onChange={(e) => setSlowmode(parseInt(e.currentTarget.value))}
            class="w-full px-3 py-2 bg-surface border border-border rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
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
          <p class="text-xs text-text-secondary mt-1">
            Members will have to wait this long between sending messages.
          </p>
        </div>
      </div>

      <div class="flex justify-end pt-4">
        <button
          onClick={handleSaveOverview}
          disabled={isSaving()}
          class={`px-4 py-2 rounded-md transition-colors ${
            isSaving()
              ? "bg-gray-400 text-gray-600 cursor-not-allowed"
              : "bg-primary text-white hover:bg-primary-hover"
          }`}
        >
          {isSaving() ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );

  const renderPermissionsContent = () => (
    <div class="flex gap-6 h-full">
      {/* Left Sidebar - Roles and Members List */}
      <div class="w-1/3 bg-background1 rounded-lg p-4">
        <h3 class="text-lg font-semibold text-text-primary mb-4">Roles & Members</h3>
        
        {/* Roles Section */}
        <div class="mb-6">
          <h4 class="text-sm font-medium text-text-secondary uppercase mb-2 flex items-center gap-2">
            <Crown class="w-4 h-4" />
            Roles
          </h4>
          <div class="space-y-2">
            <For each={spaceRoles().sort((a, b) => (b.position || 0) - (a.position || 0))}>
              {(role) => (
                <div
                  class={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedTarget()?.type === 'role' && selectedTarget()?.data.id === role.id
                      ? "bg-primary/20 border border-primary"
                      : "bg-background2 hover:bg-background2/80"
                  }`}
                  onClick={() => setSelectedTarget({type: 'role', data: role})}
                >
                  <div class="flex items-center gap-3">
                    <div
                      class="w-4 h-4 rounded-full"
                      style={{ "background-color": role.color || "#99aab5" }}
                    />
                    <div class="flex-1">
                      <div class="text-sm font-medium text-text-primary">{role.name}</div>
                      <div class="text-xs text-text-secondary">{role.member_count || 0} members</div>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
        
        {/* Members Section */}
        <div>
          <h4 class="text-sm font-medium text-text-secondary uppercase mb-2 flex items-center gap-2">
            <Users class="w-4 h-4" />
            Members
          </h4>
          <div class="space-y-2">
            <For each={spaceMembers()}>
              {(member) => (
                <div
                  class={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedTarget()?.type === 'member' && selectedTarget()?.data.id === member.id
                      ? "bg-primary/20 border border-primary"
                      : "bg-background2 hover:bg-background2/80"
                  }`}
                  onClick={() => setSelectedTarget({type: 'member', data: member})}
                >
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {(member.display_name || member.username || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div class="flex-1">
                      <div class="text-sm font-medium text-text-primary">
                        {member.display_name || member.username}
                      </div>
                      <div class="text-xs text-text-secondary">@{member.username}</div>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>
      
      {/* Right Panel - Permission Overrides */}
      <div class="flex-1 bg-background1 rounded-lg p-6">
        <Show
          when={selectedTarget()}
          fallback={
            <div class="text-center py-8">
              <Shield />
              <h3 class="text-lg font-medium text-text-primary mb-2">Select a Role or Member</h3>
              <p class="text-text-secondary">Choose a role or member from the left to configure permission overrides.</p>
            </div>
          }
        >
          <div>
            <div class="flex items-center gap-3 mb-6">
              <Show when={selectedTarget()?.type === 'role'}>
                <div
                  class="w-6 h-6 rounded-full"
                  style={{ "background-color": (selectedTarget()?.data as Role)?.color || "#99aab5" }}
                />
                <Crown class="w-5 h-5 text-text-secondary" />
              </Show>
              <Show when={selectedTarget()?.type === 'member'}>
                <div class="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {(selectedTarget()?.data as LocalSpaceMember)?.display_name?.charAt(0) || (selectedTarget()?.data as LocalSpaceMember)?.username.charAt(0)}
                </div>
                <Users class="w-5 h-5 text-text-secondary" />
              </Show>
              <div>
                <h3 class="text-lg font-semibold text-text-primary">
                  {selectedTarget()?.type === 'role' ? (selectedTarget()?.data as Role)?.name : (selectedTarget()?.data as LocalSpaceMember)?.display_name || (selectedTarget()?.data as LocalSpaceMember)?.username}
                </h3>
                <p class="text-sm text-text-secondary">
                  {selectedTarget()?.type === 'role' ? 'Role Permission Overrides' : 'Member Permission Overrides'}
                </p>
              </div>
            </div>
            
            <div class="space-y-4">
              <p class="text-text-secondary text-sm mb-4">
                Configure permission overrides for this room. These settings override space permissions.
              </p>
              
              <For each={availablePermissions()}>
                {(permission) => (
                  <div class="flex items-center justify-between p-3 bg-background2 rounded-lg">
                    <div>
                      <div class="text-sm font-medium text-text-primary">{permission.name}</div>
                      <div class="text-xs text-text-secondary">{permission.description}</div>
                    </div>
                    <div class="flex rounded-md bg-surface">
                      <PermissionOverrideButton
                        type={selectedTarget()!.type}
                        targetId={selectedTarget()!.data.id}
                        permission={permission.id}
                        value="deny"
                        label={<Ban class="w-4 h-4" />}
                        color="bg-red-500"
                      />
                      <PermissionOverrideButton
                        type={selectedTarget()!.type}
                        targetId={selectedTarget()!.data.id}
                        permission={permission.id}
                        value="default"
                        label={<Minus class="w-4 h-4" />}
                        color="bg-gray-500"
                      />
                      <PermissionOverrideButton
                        type={selectedTarget()!.type}
                        targetId={selectedTarget()!.data.id}
                        permission={permission.id}
                        value="grant"
                        label={<Check class="w-4 h-4" />}
                        color="bg-green-500"
                      />
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
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
    </Modal>
  );
};

export default RoomEditModal;