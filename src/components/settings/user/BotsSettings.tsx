import { Component, createSignal, createEffect, For, Show } from "solid-js";
import { useTransContext } from "@mbarzda/solid-i18next";
import { apiRequest } from "../../../lib/api";
import { BASE_URL } from "../../../constants";
import { useToast } from "../../common/Toast";
import { useNavigate } from "@solidjs/router";
import Robot from "../../shared/icons/Robot";
import Plus from "../../shared/icons/Plus";
import Edit from "../../shared/icons/Edit";
import Trash from "../../shared/icons/Trash";
import Eye from "../../shared/icons/Eye";
import EyeOff from "../../shared/icons/EyeOff";
import Copy from "../../shared/icons/Copy";
import Refresh from "../../shared/icons/Refresh";
import UserPlus from "../../shared/icons/UserPlus";
import BotModal from "../../modals/BotModal";

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
  created_at?: string;
  token?: string;
}

const BotsSettings: Component = () => {
  const [t] = useTransContext();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [bots, setBots] = createSignal<Bot[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [showBotModal, setShowBotModal] = createSignal(false);
  const [modalMode, setModalMode] = createSignal<"create" | "edit">("create");
  const [selectedBot, setSelectedBot] = createSignal<Bot | undefined>(undefined);
  const [showToken, setShowToken] = createSignal<Record<string, boolean>>({});
  


  // Fetch bots on component mount
  createEffect(() => {
    fetchBots();
  });

  const fetchBots = async () => {
    try {
      setLoading(true);
      const response = await apiRequest<Bot[]>(`${BASE_URL}/bots`, {
        method: "GET"
      });
      setBots(response || []);
    } catch (error) {
      console.error("Failed to fetch bots:", error);
      showToast("Failed to fetch bots", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleBotCreated = (bot: Bot & { token: string }) => {
    setBots(prev => [...prev, bot]);
  };

  const handleBotUpdated = (updatedBot: Bot) => {
    setBots(prev => prev.map(b => b.user_id === updatedBot.user_id ? { ...b, ...updatedBot } : b));
  };

  const deleteBot = async (bot: Bot) => {
    if (!confirm(`Are you sure you want to delete ${bot.username}? This action cannot be undone.`)) {
      return;
    }

    try {
      setLoading(true);
      await apiRequest(`${BASE_URL}/bots/${bot.user_id}`, {
        method: "DELETE"
      });
      
      setBots(prev => prev.filter(b => b.user_id !== bot.user_id));
      showToast("Bot deleted successfully!", "success");
    } catch (error: any) {
      console.error("Failed to delete bot:", error);
      showToast(error.message || "Failed to delete bot", "error");
    } finally {
      setLoading(false);
    }
  };

  const regenerateToken = async (bot: Bot) => {
    if (!confirm(`Are you sure you want to regenerate the token for ${bot.username}? The old token will stop working immediately.`)) {
      return;
    }

    try {
      setLoading(true);
      const response = await apiRequest<{ token: string }>(`${BASE_URL}/bots/${bot.user_id}/token`, {
        method: "POST"
      });
      
      setBots(prev => prev.map(b => b.user_id === bot.user_id ? { ...b, token: response.token } : b));
      showToast("Token regenerated successfully!", "success");
    } catch (error: any) {
      console.error("Failed to regenerate token:", error);
      showToast(error.message || "Failed to regenerate token", "error");
    } finally {
      setLoading(false);
    }
  };

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    showToast("Token copied to clipboard!", "success");
  };

  const toggleTokenVisibility = (botId: string) => {
    setShowToken(prev => ({
      ...prev,
      [botId]: !prev[botId]
    }));
  };

  const openCreateModal = () => {
    setModalMode("create");
    setSelectedBot(undefined);
    setShowBotModal(true);
  };

  const openEditModal = (bot: Bot) => {
    setModalMode("edit");
    setSelectedBot(bot);
    setShowBotModal(true);
  };

  const inviteBotToSpace = (botId: string) => {
    navigate(`/bot/${botId}`);
  };

  return (
    <div class="mb-8">
      <div class="flex items-center gap-3 mb-6">
        <div class="p-3 bg-primary/10 rounded-lg">
          <Robot />
        </div>
        <div>
          <h2 class="text-xl font-semibold text-text-primary mb-1">
            {t("settings.developers.bots.title")}
          </h2>
          <p class="text-text-secondary text-xs">
            {t("settings.developers.bots.description")}
          </p>
        </div>
      </div>

      {/* Content Sections */}
      <div class="space-y-6">
        {/* Create New Bot Section */}
        <div class="bg-background1 rounded-lg p-6">
          <div class="flex items-center gap-3 mb-4">
            <div class="p-2 bg-primary/10 rounded-lg">
              <Plus />
            </div>
            <h3 class="text-lg font-semibold text-text-primary">
              {t("settings.developers.bots.createNew")}
            </h3>
          </div>
          <p class="text-text-secondary text-sm mb-4">
            Create a new bot to automate tasks and enhance your server experience.
          </p>
          <button 
            onClick={openCreateModal}
            class="bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary-dark transition-all duration-200 font-medium flex items-center gap-2"
          >
            <Plus />
            {t("settings.developers.bots.createButton")}
          </button>
        </div>

        {/* Existing Bots Section */}
        <div class="bg-background1 rounded-lg p-6">
          <h3 class="text-lg font-semibold text-text-primary mb-4">
            {t("settings.developers.bots.existing")}
          </h3>
          
          <Show when={loading()}>
            <div class="text-center py-8">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p class="text-text-secondary text-sm mt-2">Loading bots...</p>
            </div>
          </Show>
          
          <Show when={!loading() && bots().length === 0}>
            <div class="text-center py-8">
              <div class="p-4 bg-background2 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Robot />
              </div>
              <p class="text-text-secondary text-sm mb-2">
                {t("settings.developers.bots.noBots")}
              </p>
              <p class="text-text-tertiary text-xs">
                Your created bots will appear here once you create them.
              </p>
            </div>
          </Show>
          
          <Show when={!loading() && bots().length > 0}>
            <div class="space-y-4">
              <For each={bots()}>
                {(bot) => (
                  <div class="bg-background2 rounded-lg p-4 border border-border">
                    <div class="flex items-start justify-between mb-3">
                      <div class="flex items-center gap-3">
                        <div class="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                          <Robot />
                        </div>
                        <div>
                          <h4 class="text-text-primary font-semibold">
                            {bot.username}#{bot.discriminator}
                          </h4>
                          <Show when={bot.description}>
                            <p class="text-text-secondary text-sm">{bot.description}</p>
                          </Show>
                          <div class="flex items-center gap-2 mt-1">
                            <span class={`text-xs px-2 py-1 rounded ${
                              bot.public ? "bg-success/20 text-success" : "bg-warning/20 text-warning"
                            }`}>
                              {bot.public ? "Public" : "Private"}
                            </span>
                            <Show when={bot.discoverable}>
                              <span class="text-xs px-2 py-1 rounded bg-primary/20 text-primary">
                                Discoverable
                              </span>
                            </Show>
                          </div>
                        </div>
                      </div>
                      <div class="flex items-center gap-2">
                        <button
                          onClick={() => inviteBotToSpace(bot.user_id)}
                          class="p-2 text-text-secondary hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                          title="Invite to space"
                        >
                          <UserPlus />
                        </button>
                        <button
                          onClick={() => openEditModal(bot)}
                          class="p-2 text-text-secondary hover:text-text-primary hover:bg-surface rounded-lg transition-all"
                          title="Edit bot"
                        >
                          <Edit />
                        </button>
                        <button
                          onClick={() => deleteBot(bot)}
                          class="p-2 text-text-secondary hover:text-error hover:bg-error/10 rounded-lg transition-all"
                          title="Delete bot"
                        >
                          <Trash />
                        </button>
                      </div>
                    </div>
                    
                    <Show when={bot.token}>
                      <div class="bg-background1 rounded-lg p-3 mt-3">
                        <div class="flex items-center justify-between mb-2">
                          <span class="text-text-secondary text-sm font-medium">Bot Token</span>
                          <div class="flex items-center gap-2">
                            <button
                              onClick={() => toggleTokenVisibility(bot.user_id)}
                              class="p-1 text-text-secondary hover:text-text-primary transition-all"
                              title={showToken()[bot.user_id] ? "Hide token" : "Show token"}
                            >
                              {showToken()[bot.user_id] ? <EyeOff /> : <Eye />}
                            </button>
                            <button
                              onClick={() => copyToken(bot.token!)}
                              class="p-1 text-text-secondary hover:text-text-primary transition-all"
                              title="Copy token"
                            >
                              <Copy />
                            </button>
                            <button
                              onClick={() => regenerateToken(bot)}
                              class="p-1 text-text-secondary hover:text-warning transition-all"
                              title="Regenerate token"
                            >
                              <Refresh />
                            </button>
                          </div>
                        </div>
                        <div class="font-mono text-sm bg-background2 p-2 rounded border">
                          {showToken()[bot.user_id] ? bot.token : "•".repeat(32)}
                        </div>
                        <p class="text-text-tertiary text-xs mt-1">
                          Keep this token secret! It gives full access to your bot.
                        </p>
                      </div>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>
      
      {/* Bot Modal */}
      <BotModal
        isOpen={showBotModal()}
        onClose={() => setShowBotModal(false)}
        mode={modalMode()}
        bot={selectedBot()}
        onBotCreated={handleBotCreated}
        onBotUpdated={handleBotUpdated}
      />
    </div>
  );
};

export default BotsSettings;