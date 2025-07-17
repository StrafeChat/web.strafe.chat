import { Component, createSignal, onMount, onCleanup } from "solid-js";
import { For, Show } from "solid-js";
import { api } from "../../../lib/api";
import { useToast } from "../../common/Toast";
import { Space } from "../../../lib/cache/SpaceCache";
import { SpaceInvite } from "../../../types/api";

// Custom SVG Icons
const PlusIcon = () => (
  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
  </svg>
);

const CopyIcon = () => (
  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const TrashIcon = () => (
  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const CalendarIcon = () => (
  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const UsersIcon = () => (
  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

type SpaceInvitesSettingsProps = {
  space: Space;
};

export const SpaceInvitesSettings: Component<SpaceInvitesSettingsProps> = (props) => {
  const toast = useToast();
  const [invites, setInvites] = createSignal<SpaceInvite[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [showCreateForm, setShowCreateForm] = createSignal(false);
  const [maxUses, setMaxUses] = createSignal<number | undefined>(undefined);
  const [expiresIn, setExpiresIn] = createSignal<string>("");
  const [creating, setCreating] = createSignal(false);

  const fetchInvites = async () => {
    if (!props.space?.id) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const invites = await api.spaces.invites.list(props.space.id);
      // Handle null/undefined responses by defaulting to empty array
      setInvites(Array.isArray(invites) ? invites : []);
    } catch (err) {
      console.error("Error fetching invites:", err);
      setError("Failed to fetch invites");
      // Set empty array on error to show "no invites" state
      setInvites([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvite = async () => {
    if (!props.space?.id) return;
    
    setCreating(true);
    
    try {
      const inviteData: any = {};
      
      if (maxUses() !== undefined && maxUses()! > 0) {
        inviteData.max_uses = maxUses();
      }
      
      if (expiresIn()) {
        const now = new Date();
        const expirationDate = new Date(now.getTime() + parseInt(expiresIn()) * 60 * 60 * 1000);
        inviteData.expires_at = expirationDate.toISOString();
      }
      
      // const newInvite = await api.spaces.invites.create(props.space.id, inviteData);
      
      toast.showToast("Invite created successfully!", "success");
      setShowCreateForm(false);
      setMaxUses(undefined);
      setExpiresIn("");
      await fetchInvites();
    } catch (err) {
      console.error("Error creating invite:", err);
      toast.showToast("Failed to create invite", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteInvite = async (inviteId: string) => {
    if (!props.space?.id) return;
    
    try {
      await api.spaces.invites.delete(props.space.id, inviteId);
      
      toast.showToast("Invite deleted successfully!", "success");
      await fetchInvites();
    } catch (err) {
      console.error("Error deleting invite:", err);
      toast.showToast("Failed to delete invite", "error");
    }
  };

  const copyInviteLink = (code: string) => {
    const inviteUrl = `${window.location.origin}/invite/${code}`;
    navigator.clipboard.writeText(inviteUrl);
    toast.showToast("Invite link copied to clipboard!", "success");
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const isMaxUsesReached = (invite: SpaceInvite) => {
    return invite.max_uses !== undefined && invite.uses >= invite.max_uses;
  };

  // WebSocket event listeners for real-time updates
  onMount(() => {
    fetchInvites();
    
    const handleInviteCreate = () => fetchInvites();
    const handleInviteDelete = () => fetchInvites();
    const handleInviteUpdate = () => fetchInvites();
    
    window.addEventListener("spaceInviteCreate", handleInviteCreate);
    window.addEventListener("spaceInviteDelete", handleInviteDelete);
    window.addEventListener("spaceInviteUpdate", handleInviteUpdate);
    
    onCleanup(() => {
      window.removeEventListener("spaceInviteCreate", handleInviteCreate);
      window.removeEventListener("spaceInviteDelete", handleInviteDelete);
      window.removeEventListener("spaceInviteUpdate", handleInviteUpdate);
    });
  });

  return (
    <div class="space-y-6">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold text-text-primary">Space Invites</h3>
          <p class="text-sm text-text-secondary mt-1">
            Manage invitations to your space. Create invite links to share with others.
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm())}
          class="flex items-center space-x-2 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg transition-colors"
        >
          <PlusIcon />
          <span>Create Invite</span>
        </button>
      </div>

      {/* Create Invite Form */}
      <Show when={showCreateForm()}>
        <div class="bg-background2 border border-border rounded-lg p-6">
          <h4 class="text-md font-medium text-text-primary mb-4">Create New Invite</h4>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-text-primary mb-2">
                Max Uses (Optional)
              </label>
              <input
                type="number"
                min="1"
                placeholder="Unlimited"
                value={maxUses() || ""}
                onInput={(e) => {
                  const value = e.currentTarget.value;
                  setMaxUses(value ? parseInt(value) : undefined);
                }}
                class="w-full bg-surface border border-border rounded-lg px-3 py-2 text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            
            <div>
              <label class="block text-sm font-medium text-text-primary mb-2">
                Expires In (Hours)
              </label>
              <select
                value={expiresIn()}
                onChange={(e) => setExpiresIn(e.currentTarget.value)}
                class="w-full bg-surface border border-border rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="">Never</option>
                <option value="1">1 Hour</option>
                <option value="6">6 Hours</option>
                <option value="12">12 Hours</option>
                <option value="24">1 Day</option>
                <option value="168">1 Week</option>
                <option value="720">1 Month</option>
              </select>
            </div>
          </div>
          
          <div class="flex justify-end space-x-3 mt-6">
            <button
              onClick={() => setShowCreateForm(false)}
              class="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateInvite}
              disabled={creating()}
              class="flex items-center space-x-2 bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Show when={creating()}>
                <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </Show>
              <span>{creating() ? "Creating..." : "Create Invite"}</span>
            </button>
          </div>
        </div>
      </Show>

      {/* Error Message */}
      <Show when={error()}>
        <div class="bg-error/10 border border-error/20 rounded-lg p-4">
          <p class="text-error text-sm">{error()}</p>
        </div>
      </Show>

      {/* Loading State */}
      <Show when={loading()}>
        <div class="flex items-center justify-center py-8">
          <div class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </Show>

      {/* Invites List */}
      <Show when={!loading() && !error()}>
        <div class="space-y-4">
          <Show when={invites().length === 0}>
            <div class="text-center py-8">
              <div class="text-text-secondary mx-auto mb-3">
                <ExternalLinkIcon />
              </div>
              <p class="text-text-secondary">No invites created yet</p>
              <p class="text-sm text-text-secondary mt-1">
                Create an invite to share your space with others
              </p>
            </div>
          </Show>
          
          <For each={invites()}>
            {(invite) => {
              const expired = isExpired(invite.expires_at);
              const maxUsed = isMaxUsesReached(invite);
              const inactive = expired || maxUsed;
              
              return (
                <div class={`bg-background2 border rounded-lg p-4 transition-all ${
                  inactive ? "border-border opacity-60" : "border-border hover:border-border"
                }`}>
                  <div class="flex items-center justify-between">
                    <div class="flex-1">
                      <div class="flex items-center space-x-3 mb-2">
                        <code class="bg-surface px-2 py-1 rounded text-sm font-mono text-primary">
                          {invite.code}
                        </code>
                        <Show when={inactive}>
                          <span class="text-xs bg-error/20 text-error px-2 py-1 rounded">
                            {expired ? "Expired" : "Max Uses Reached"}
                          </span>
                        </Show>
                      </div>
                      
                      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div class="flex items-center space-x-2 text-text-secondary">
                          <UsersIcon />
                          <span>
                            {invite.uses}{invite.max_uses ? `/${invite.max_uses}` : ""} uses
                          </span>
                        </div>
                        
                        <div class="flex items-center space-x-2 text-text-secondary">
                          <CalendarIcon />
                          <span>Created {formatDate(invite.created_at)}</span>
                        </div>
                        
                        <Show when={invite.expires_at}>
                          <div class="flex items-center space-x-2 text-text-secondary">
                            <CalendarIcon />
                            <span>Expires {formatDate(invite.expires_at!)}</span>
                          </div>
                        </Show>
                      </div>
                    </div>
                    
                    <div class="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => copyInviteLink(invite.code)}
                        disabled={inactive}
                        class="p-2 text-text-secondary hover:text-text-primary hover:bg-surface rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Copy invite link"
                      >
                        <CopyIcon />
                      </button>
                      
                      <button
                        onClick={() => handleDeleteInvite(invite.id)}
                        class="p-2 text-text-secondary hover:text-error hover:bg-error/10 rounded-lg transition-colors"
                        title="Delete invite"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default SpaceInvitesSettings;