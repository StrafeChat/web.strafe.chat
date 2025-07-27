import { Component, createSignal, createEffect, For, Show } from "solid-js";
import { apiRequest } from "../../lib/api";
import { BASE_URL } from "../../constants";
import { useToast } from "../common/Toast";
import { useParams, useNavigate } from "@solidjs/router";
import Robot from "../shared/icons/Robot";
import Plus from "../shared/icons/Plus";
import Search from "../shared/icons/Search";
import LoadingSpinner from "../shared/LoadingSpinner";

interface Bot {
  user_id: string;
  username: string;
  discriminator: number;
  description?: string;
  avatar?: string;
  public: boolean;
  discoverable: boolean;
  terms_of_service_url?: string;
  privacy_policy_url?: string;
  created_at: string;
}

interface Space {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

const BotsPage: Component = () => {
  const { showToast } = useToast();
  const params = useParams();
  const navigate = useNavigate();
  
  const [bots, setBots] = createSignal<Bot[]>([]);
  const [spaces, setSpaces] = createSignal<Space[]>([]);
  const [selectedSpace, setSelectedSpace] = createSignal<string>("");
  const [searchQuery, setSearchQuery] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [addingBot, setAddingBot] = createSignal<string | null>(null);

  // Fetch discoverable bots
  const fetchBots = async () => {
    try {
      setLoading(true);
      const response = await apiRequest<Bot[]>(`${BASE_URL}/bots/discoverable`, {
        method: "GET"
      });
      setBots(response);
    } catch (error) {
      console.error("Failed to fetch bots:", error);
      showToast("Failed to fetch bots", "error");
    } finally {
      setLoading(false);
    }
  };

  // Fetch user's spaces
  const fetchSpaces = async () => {
    try {
      const response = await apiRequest<Space[]>(`${BASE_URL}/users/@me/spaces`, {
        method: "GET"
      });
      setSpaces(response);
      
      // Note: BotsPage route doesn't have spaceId parameter
      // Users must manually select a space from the dropdown
      console.log("Available spaces:", response.map(s => ({ id: s.id, name: s.name })));
    } catch (error) {
      console.error("Failed to fetch spaces:", error);
      showToast("Failed to fetch spaces", "error");
    }
  };

  // Add bot to space
  const addBotToSpace = async (botId: string) => {
    if (!selectedSpace()) {
      showToast("Please select a space first", "error");
      return;
    }

    const spaceId = selectedSpace();
    console.log("[DEBUG] Adding bot to space:", {
      botId,
      spaceId,
      availableSpaces: spaces().map(s => ({ id: s.id, name: s.name })),
      selectedSpaceName: spaces().find(s => s.id === spaceId)?.name
    });

    try {
      setAddingBot(botId);
      await apiRequest(`${BASE_URL}/spaces/${spaceId}/bots`, {
        method: "POST",
        body: { bot_id: botId }
      });
      showToast("Bot added to space successfully!", "success");
    } catch (error: any) {
      console.error("Failed to add bot to space:", error);
      console.error("[DEBUG] Error details:", {
        spaceId,
        botId,
        errorMessage: error.message,
        errorResponse: error.response
      });
      showToast(error.message || "Failed to add bot to space", "error");
    } finally {
      setAddingBot(null);
    }
  };

  // Filter bots based on search query
  const filteredBots = () => {
    const query = searchQuery().toLowerCase();
    if (!query) return bots();
    
    return bots().filter(bot => 
      bot.username.toLowerCase().includes(query) ||
      bot.description?.toLowerCase().includes(query)
    );
  };

  createEffect(() => {
    fetchBots();
    fetchSpaces();
  });

  return (
    <div class="flex flex-col h-full bg-background1">
      {/* Header */}
      <div class="flex-shrink-0 p-6 border-b border-border">
        <div class="flex items-center gap-3 mb-4">
          <div class="p-3 bg-primary/10 rounded-lg">
            <Robot />
          </div>
          <div>
            <h1 class="text-2xl font-bold text-text-primary">Bot Directory</h1>
            <p class="text-text-secondary">Add bots to your spaces</p>
          </div>
        </div>

        {/* Space selector */}
        <div class="flex flex-col sm:flex-row gap-4">
          <div class="flex-1">
            <label class="block text-text-primary text-sm font-medium mb-2">
              Select Space
            </label>
            <select
              value={selectedSpace()}
              onChange={(e) => setSelectedSpace(e.target.value)}
              class="w-full px-3 py-2 bg-background2 border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Choose a space...</option>
              <For each={spaces()}>
                {(space) => (
                  <option value={space.id}>{space.name}</option>
                )}
              </For>
            </select>
          </div>

          {/* Search */}
          <div class="flex-1">
            <label class="block text-text-primary text-sm font-medium mb-2">
              Search Bots
            </label>
            <div class="relative">
              <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-tertiary w-4 h-4" />
              <input
                type="text"
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or description..."
                class="w-full pl-10 pr-3 py-2 bg-background2 border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-auto p-6">
        <Show when={loading()}>
          <div class="flex items-center justify-center h-64">
            <LoadingSpinner />
          </div>
        </Show>

        <Show when={!loading() && filteredBots().length === 0}>
          <div class="flex flex-col items-center justify-center h-64 text-center">
            <Robot />
            <h3 class="text-lg font-medium text-text-primary mb-2">No bots found</h3>
            <p class="text-text-secondary">
              {searchQuery() ? "Try adjusting your search terms" : "No discoverable bots available"}
            </p>
          </div>
        </Show>

        <Show when={!loading() && filteredBots().length > 0}>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <For each={filteredBots()}>
              {(bot) => (
                <div class="bg-background2 border border-border rounded-lg p-6 hover:border-primary/50 transition-colors">
                  <div class="flex items-start gap-4">
                    <div class="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      {bot.avatar ? (
                        <img src={bot.avatar} alt={bot.username} class="w-full h-full rounded-full" />
                      ) : (
                        <Robot />
                      )}
                    </div>
                    
                    <div class="flex-1 min-w-0">
                      <h3 class="font-semibold text-text-primary truncate">
                        {bot.username}#{bot.discriminator}
                      </h3>
                      
                      <div class="flex items-center gap-2 mt-1">

                        <Show when={bot.public}>
                          <span class="text-xs px-2 py-1 rounded bg-success/20 text-success">
                            Public
                          </span>
                        </Show>
                      </div>
                      
                      <Show when={bot.description}>
                        <p class="text-text-secondary text-sm mt-2 line-clamp-2">
                          {bot.description}
                        </p>
                      </Show>
                    </div>
                  </div>
                  
                  <div class="mt-4 pt-4 border-t border-border">
                    <div class="flex gap-2">
                      <button
                        onClick={() => navigate(`/invite/bot/${bot.user_id}`)}
                        class="flex-1 px-4 py-2 bg-secondary text-text-primary rounded-lg hover:bg-surface transition-colors"
                      >
                        Invite
                      </button>
                      <button
                        onClick={() => addBotToSpace(bot.user_id)}
                        disabled={!selectedSpace() || addingBot() === bot.user_id}
                        class="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <Show when={addingBot() === bot.user_id}>
                          <LoadingSpinner/>
                        </Show>
                        <Show when={addingBot() !== bot.user_id}>
                          <Plus />
                        </Show>
                        {addingBot() === bot.user_id ? "Adding..." : "Add to Space"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default BotsPage;