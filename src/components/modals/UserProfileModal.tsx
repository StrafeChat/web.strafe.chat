import {
  Component,
  Show,
  createSignal,
  onCleanup,
  onMount,
  createEffect,
  createMemo,
  For,
} from "solid-js";
import { FS_URL } from "../../constants";
import { StatusIndicator } from "../common/StatusIndicator";
import { Avatar } from "../common/Avatar";
import { Portal } from "solid-js/web";
import { useCache } from "../../lib/providers/cache/CacheProvider";
import { useAuth } from "../../lib/providers/auth/AuthProvider";
import { parseMarkdown } from "../../lib/utils/markdownUtils";
import { apiRequest } from "../../lib/api";
import { UserStatus } from "../common/StatusIndicator";
import { BASE_URL } from "../../constants";
import { useNavigate } from "@solidjs/router";

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  spaceId?: string;
}

interface MutualFriend {
  id: string;
  username: string;
  display_name?: string;
  discriminator: number;
  avatar?: string;
  presence?: {
    status: string;
    custom_status?: string;
  };
}

interface MutualSpace {
  space_id: string;
  name: string;
  icon?: string;
  description?: string;
  owner_id: string;
  joined_at: string;
}

const UserProfileModal: Component<UserProfileModalProps> = (props) => {
  const cache = useCache();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [user, setUser] = createSignal<any>(null);
  const [activeTab, setActiveTab] = createSignal<'overview' | 'mutual-friends' | 'mutual-spaces'>('overview');
  const [mutualFriends, setMutualFriends] = createSignal<MutualFriend[]>([]);
  const [mutualSpaces, setMutualSpaces] = createSignal<MutualSpace[]>([]);
  const [loadingMutualFriends, setLoadingMutualFriends] = createSignal(false);
  const [loadingMutualSpaces, setLoadingMutualSpaces] = createSignal(false);
  let modalRef: HTMLDivElement | undefined;

  // Fetch user info from cache whenever props.userId changes
  createEffect(() => {
    setUser(cache.getUser(props.userId));
  });

  // Fetch mutual friends
  const fetchMutualFriends = async () => {
    if (!props.userId || props.userId === currentUser()?.id) return;
    
    setLoadingMutualFriends(true);
    try {
      const data = await apiRequest(`${BASE_URL}/users/${props.userId}/mutual-friends`) as MutualFriend[] | { mutual_friends: MutualFriend[] };
      // Handle both direct array response and wrapped response
      setMutualFriends(Array.isArray(data) ? data : (data.mutual_friends || []));
    } catch (error) {
      console.error('Failed to fetch mutual friends:', error);
      setMutualFriends([]);
    } finally {
      setLoadingMutualFriends(false);
    }
  };

  // Fetch mutual spaces
  const fetchMutualSpaces = async () => {
    if (!props.userId || props.userId === currentUser()?.id) return;
    
    setLoadingMutualSpaces(true);
    try {
      const data = await apiRequest(`${BASE_URL}/users/${props.userId}/mutual-spaces`) as MutualSpace[] | { mutual_spaces: MutualSpace[] };
      // Handle both direct array response and wrapped response
      setMutualSpaces(Array.isArray(data) ? data : (data.mutual_spaces || []));
    } catch (error) {
      console.error('Failed to fetch mutual spaces:', error);
      setMutualSpaces([]);
    } finally {
      setLoadingMutualSpaces(false);
    }
  };

  // Load mutual data when modal opens or user changes
  createEffect(() => {
    if (props.isOpen && props.userId && props.userId !== currentUser()?.id) {
      fetchMutualFriends();
      fetchMutualSpaces();
    }
  });

  // Reset data when modal closes
  createEffect(() => {
    if (!props.isOpen) {
      setMutualFriends([]);
      setMutualSpaces([]);
      setActiveTab('overview');
    }
  });

  // Get current space data if in space context
  const currentSpace = createMemo(() => {
    if (!props.spaceId) return null;
    return cache.getSpace(props.spaceId);
  });

  // Get user's space member data if in space context
  const spaceMember = createMemo(() => {
    if (!props.spaceId) return null;
    const members = cache.getSpaceMembers(props.spaceId);
    return members.find(member => member.user_id === props.userId);
  });

  // Get user's roles in the space
  const userRoles = createMemo(() => {
    if (!props.spaceId || !spaceMember()) return [];
    const roles = cache.getSpaceRoles(props.spaceId);
    const memberRoles = spaceMember()?.roles || [];
    return roles.filter(role => memberRoles.includes(role.role_id))
      .sort((a, b) => (b.position || 0) - (a.position || 0));
  });

  // Get the highest role color
  const roleColor = createMemo(() => {
    const roles = userRoles();
    const coloredRole = roles.find(role => role.color && role.color !== '#000000');
    return coloredRole?.color || null;
  });

  // Format join date
  const formatJoinDate = (dateString?: string) => {
    if (!dateString) return "Unknown";
    
    // Ensure dateString is actually a string
    const dateStr = String(dateString);
    
    const date = new Date(dateStr);
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Handle space navigation
  const handleSpaceClick = (spaceId: string) => {
    props.onClose(); // Close the modal first
    navigate(`/spaces/${spaceId}`);
  };

  // Handle clicking outside to close
  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as Node;
    if (modalRef && !modalRef.contains(target)) {
      props.onClose();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      props.onClose();
    }
  };

  onMount(() => {
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    // Prevent body scroll when modal is open
    document.body.style.overflow = "hidden";
  });

  onCleanup(() => {
    document.removeEventListener("mousedown", handleClickOutside);
    window.removeEventListener("keydown", handleKeyDown);
    // Restore body scroll
    document.body.style.overflow = "";
  });

  // Get user badges based on flags
  const getUserBadges = () => {
    const flags = user()?.flags || 0;
    const badges = [];

    // Platform badges
    if (flags & 1) badges.push({ name: "Founder", color: "#7289da", icon: "👑" });
    if (flags & 2) badges.push({ name: "Platform Admin", color: "#f04747", icon: "🛡️" });
    if (flags & 4) badges.push({ name: "Platform Moderator", color: "#43b581", icon: "🔨" });

    // Bot badge
    if (user()?.bot) badges.push({ name: "Bot", color: "#5865f2", icon: "🤖" });
    
    // System badge
    if (user()?.system) badges.push({ name: "System", color: "#faa61a", icon: "⚙️" });

    return badges;
  };

  return (
    <Show when={props.isOpen && user()}>
      <Portal>
        {/* Backdrop */}
        <div class="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-2 sm:p-4">
          {/* Modal */}
          <div
            ref={modalRef}
            class="bg-background1 rounded-lg shadow-2xl w-full max-w-[480px] h-[85vh] sm:h-[80vh] md:h-[550px] max-h-[550px] overflow-hidden animate-fade-in flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Banner */}
            <div class="relative">
              {/* Banner */}
              <div class="h-[140px] sm:h-[140px] md:h-[140px] relative overflow-hidden">
                <Show
                  when={user()?.banner}
                  fallback={
                    <div 
                      class="h-full w-full" 
                      style={{ 
                        background: roleColor() || "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" 
                      }} 
                    />
                  }
                >
                  <img
                    src={`${FS_URL}/banners/${user()?.id}/${user()?.banner}`}
                    alt="User banner"
                    class="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        parent.style.background = roleColor() || "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
                      }
                    }}
                  />
                </Show>
                
                {/* Close button */}
                <button
                  onClick={props.onClose}
                  class="absolute top-4 right-4 w-8 h-8 rounded-full bg-black bg-opacity-60 hover:bg-opacity-80 transition-all flex items-center justify-center text-white"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Avatar */}
              <div class="absolute -bottom-6 sm:-bottom-7 md:-bottom-8 left-2 sm:left-2">
                <div class="relative w-[100px] h-[100px] sm:w-[100px] sm:h-[100px] md:w-[100px] md:h-[100px]">
                  <div 
                    class="w-full h-full rounded-full overflow-hidden border-4 sm:border-5 md:border-6 border-background1" 
                    style={{ "aspect-ratio": "1/1" }}
                  >
                    <Avatar
                      userId={user()?.id || ''}
                      avatar={user()?.avatar}
                      bot={user()?.bot}
                      alt="User avatar"
                      class="!w-full !h-full !rounded-full object-cover"
                    />
                  </div>
                  <div class="absolute bottom-0 right-0 sm:bottom-1 sm:right-1">
                    <StatusIndicator
                      status={user()?.presence?.status || "offline"}
                      class="w-3 h-3 sm:w-4 sm:h-4 md:w-8 md:h-8 border-2 sm:border-[4px] md:border-5 border-background1 rounded-full"
                    />
                  </div>
                </div>
              </div>

              {/* Badges */}
              <Show when={getUserBadges().length > 0}>
                <div class="absolute top-2 left-2 sm:top-4 sm:left-4 flex gap-1 sm:gap-2 flex-wrap">
                  {getUserBadges().map((badge) => (
                    <div 
                      class="px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md text-xs font-medium text-white flex items-center gap-1"
                      style={{ "background-color": badge.color }}
                      title={badge.name}
                    >
                      <span class="text-xs">{badge.icon}</span>
                      <span class="hidden sm:inline">{badge.name}</span>
                    </div>
                  ))}
                </div>
              </Show>
            </div>

            {/* User Info Header */}
            <div class="p-3 sm:p-4 mt-2 sm:pt-8 md:pt-9 pb-0">
              {/* User Info */}
              <div class="mb-1">
                <div class="flex items-center gap-2">
                  <h1 
                    class="text-2xl font-bold"
                  >
                    {user()?.display_name || user()?.username}
                  </h1>
                  <Show when={user()?.bot}>
                    <span class="text-xs bg-primary text-white px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                      BOT
                    </span>
                  </Show>
                </div>
                <div class="text-text-secondary">
                  {user()?.username}#{String(user()?.discriminator).padStart(4, "0")}
                </div>
                
                {/* Custom Status */}
                <Show when={user()?.presence?.custom_status}>
                  <div class="mt-2 text-sm text-text-secondary">
                    {user()?.presence?.custom_status}
                  </div>
                </Show>
              </div>


            </div>

            {/* Tabs */}
            <Show when={props.userId !== currentUser()?.id}>
              <div class="border-b border-surface px-3 sm:px-4">
                <div class="flex gap-4 sm:gap-6 overflow-x-auto scrollbar-none">
                  <button
                    class={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                      activeTab() === 'overview'
                        ? 'text-primary border-primary'
                        : 'text-text-secondary border-transparent hover:text-text-primary'
                    }`}
                    onClick={() => setActiveTab('overview')}
                  >
                    Overview
                  </button>
                  <button
                    class={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                      activeTab() === 'mutual-friends'
                        ? 'text-primary border-primary'
                        : 'text-text-secondary border-transparent hover:text-text-primary'
                    }`}
                    onClick={() => setActiveTab('mutual-friends')}
                  >
                    Mutual Friends
                  </button>
                  <button
                    class={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                      activeTab() === 'mutual-spaces'
                        ? 'text-primary border-primary'
                        : 'text-text-secondary border-transparent hover:text-text-primary'
                    }`}
                    onClick={() => setActiveTab('mutual-spaces')}
                  >
                    Mutual Spaces
                  </button>
                </div>
              </div>
            </Show>

            {/* Tab Content */}
            <div class="flex-1 overflow-hidden">
              <div class="h-full overflow-y-auto p-3 sm:p-4 scrollbar-thin scrollbar-thumb-surface scrollbar-track-transparent hover:scrollbar-thumb-surface-hover">
              {/* Overview Tab */}
              <Show when={activeTab() === 'overview'}>
                <div>
                  {/* Member Since */}
                  <div class="mb-6">
                    <h3 class="text-xs font-bold text-text-secondary uppercase mb-3 tracking-wide">
                      Member Since
                    </h3>
                    <div class="bg-background2 rounded-lg p-3 space-y-2">
                      <Show when={props.spaceId && spaceMember()?.joined_at}>
                        <div class="flex items-center gap-3">
                          <div class="flex-shrink-0 w-6 h-6 rounded-md bg-surface flex items-center justify-center text-xs font-bold">
                            <Show when={currentSpace()?.icon} fallback={currentSpace()?.name_acronym || "S"}>
                              <img 
                                src={`${FS_URL}/space_icons/${currentSpace()?.id}/${currentSpace()?.icon}`} 
                                alt="Space icon" 
                                class="w-full h-full rounded-md object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  const parent = e.currentTarget.parentElement;
                                  if (parent) {
                                    parent.textContent = currentSpace()?.name_acronym || "S";
                                  }
                                }}
                              />
                            </Show>
                          </div>
                          <div class="flex-1 min-w-0">
                            <div class="text-sm text-text-primary font-medium truncate">
                              <span class="inline-flex items-center gap-1.5">
                                <svg class="w-3.5 h-3.5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                {formatJoinDate(spaceMember()?.joined_at)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Show>
                      <div class="flex items-center gap-3">
                        <div class="flex-shrink-0 w-6 h-6 rounded-md bg-primary flex items-center justify-center">
                          <img 
                            src="/logo192.png" 
                            alt="Strafe logo" 
                            class="rounded-sm object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const parent = e.currentTarget.parentElement;
                              if (parent) {
                                parent.innerHTML = '<span class="text-xs font-bold text-white">S</span>';
                              }
                            }}
                          />
                        </div>
                        <div class="flex-1 min-w-0">
                          <div class="text-sm text-text-primary font-medium truncate">
                            <span class="inline-flex items-center gap-1.5">
                              <svg class="w-3.5 h-3.5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              Joined {user()?.created_at || user()?.CreatedAt ? formatJoinDate(user()?.created_at || user()?.CreatedAt) : "Unknown"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bio */}
                  <Show when={user()?.bio && user()?.bio?.trim().length > 0}>
                    <div class="mb-6">
                      <h3 class="text-xs font-bold text-text-secondary uppercase mb-3 tracking-wide">
                        Bio
                      </h3>
                      <div class="bg-background2 rounded-lg p-4">
                        <div 
                          class="text-sm text-text-primary leading-relaxed markdown-content break-words overflow-wrap-anywhere word-break max-w-full overflow-hidden"
                          style="word-break: break-word; overflow-wrap: break-word; hyphens: auto;"
                          innerHTML={parseMarkdown(user()?.bio || '')}
                        />
                      </div>
                    </div>
                  </Show>


                </div>
              </Show>

              {/* Mutual Friends Tab */}
              <Show when={activeTab() === 'mutual-friends'}>
                <Show when={loadingMutualFriends()}>
                  <div class="text-center py-12">
                    <div class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p class="text-text-secondary">Loading mutual friends...</p>
                  </div>
                </Show>
                <Show when={!loadingMutualFriends() && mutualFriends().length === 0}>
                  <div class="text-center py-5">
                    <div class="text-text-secondary mb-4">
                      <svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <h3 class="text-lg font-medium text-text-primary mb-2">No Mutual Friends</h3>
                      <p class="text-sm">You don't have any mutual friends with this user yet.</p>
                    </div>
                  </div>
                </Show>
                <Show when={!loadingMutualFriends() && mutualFriends().length > 0}>
                  <div>
                    <div class="space-y-2">
                      <For each={mutualFriends()}>
                        {(friend) => (
                          <div class="bg-background2 rounded-lg p-3 flex items-center gap-3 hover:bg-surface transition-colors">
                            <div class="relative flex-shrink-0">
                              <Avatar
                                userId={friend.id}
                                avatar={friend.avatar}
                                alt={friend.display_name || friend.username}
                                class="w-10 h-10 rounded-full"
                              />
                              <div class="absolute bottom-0 right-0">
                                <StatusIndicator
                                 status={(friend.presence?.status as UserStatus) || "offline"}
                                 class="w-3 h-3 border-2 border-background2 rounded-full"
                               />
                              </div>
                            </div>
                            <div class="flex-1 min-w-0">
                              <div class="font-medium text-text-primary truncate">
                                {friend.display_name || friend.username}
                              </div>
                              <div class="text-sm text-text-secondary truncate">
                                {friend.username}#{String(friend.discriminator).padStart(4, "0")}
                              </div>
                              <Show when={friend.presence?.custom_status}>
                                <div class="text-xs text-text-secondary truncate mt-1">
                                  {friend.presence?.custom_status}
                                </div>
                              </Show>
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>
              </Show>

              {/* Mutual Spaces Tab */}
              <Show when={activeTab() === 'mutual-spaces'}>
                <Show when={loadingMutualSpaces()}>
                  <div class="text-center py-5">
                    <div class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p class="text-text-secondary">Loading mutual spaces...</p>
                  </div>
                </Show>
                <Show when={!loadingMutualSpaces() && mutualSpaces().length === 0}>
                  <div class="text-center py-5">
                    <div class="text-text-secondary mb-4">
                      <svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <h3 class="text-lg font-medium text-text-primary mb-2">No Mutual Spaces</h3>
                      <p class="text-sm">You don't share any spaces with this user yet.</p>
                    </div>
                  </div>
                </Show>
                <Show when={!loadingMutualSpaces() && mutualSpaces().length > 0}>
                  <div>
                    <div class="space-y-2">
                      <For each={mutualSpaces()}>
                        {(space) => (
                          <div 
                            class="bg-background2 rounded-lg p-3 flex items-center gap-3 hover:bg-surface transition-colors cursor-pointer"
                            onClick={() => handleSpaceClick(space.space_id)}
                          >
                            <div class="flex-shrink-0 w-12 h-12 rounded-lg bg-surface flex items-center justify-center text-sm font-bold overflow-hidden">
                              <Show when={space.icon} fallback={currentSpace()?.name_acronym}>
                                <img 
                                  src={`${FS_URL}/space_icons/${space.space_id}/${space.icon}`} 
                                  alt={space.name} 
                                  class="w-full h-full object-cover rounded-lg"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    const parent = e.currentTarget.parentElement;
                                    if (parent) {
                                      parent.textContent = space.name.charAt(0).toUpperCase();
                                    }
                                  }}
                                />
                              </Show>
                            </div>
                            <div class="flex-1 min-w-0">
                              <div class="font-medium text-text-primary truncate">
                                {space.name}
                              </div>
                              <div class="text-sm text-text-secondary truncate mt-1">
                                <span class="inline-flex items-center gap-1.5">
                                  <svg class="w-3.5 h-3.5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  Joined {formatJoinDate(space.joined_at)}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>
              </Show>
              </div>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  );
};

export default UserProfileModal;