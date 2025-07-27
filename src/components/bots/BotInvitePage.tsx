import { Component, createSignal, onMount, For, Show } from "solid-js";
import { useParams, useNavigate } from "@solidjs/router";
import { apiRequest } from "../../lib/api";
import { BASE_URL, FS_URL } from "../../constants";
// import { useToast } from "../common/Toast";

// Custom SVG Icons
// const ArrowLeft = (props: any) => (
//   <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
//     <path d="M19 12H5"/>
//     <path d="M12 19l-7-7 7-7"/>
//   </svg>
// );

const Check = (props: any) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="20,6 9,17 4,12"/>
  </svg>
);

const Bot = (props: any) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2" ry="2"/>
    <circle cx="12" cy="5" r="2"/>
    <path d="M12 7v4"/>
    <line x1="8" y1="16" x2="8" y2="16"/>
    <line x1="16" y1="16" x2="16" y2="16"/>
  </svg>
);

const AlertCircle = (props: any) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

interface BotDetails {
  user_id: string;
  username: string;
  display_name?: string;
  avatar?: string;
  description?: string;
  public: boolean;
}

interface Space {
  id: string;
  name: string;
  icon?: string;
}

const BotInvitePage: Component = () => {
  const params = useParams();
  const navigate = useNavigate();
  const [bot, setBot] = createSignal<BotDetails | null>(null);
  const [spaces, setSpaces] = createSignal<Space[]>([]);
  const [selectedSpace, setSelectedSpace] = createSignal<string>("");
  const [loading, setLoading] = createSignal(true);
  const [inviting, setInviting] = createSignal(false);
  // const { showToast } = useToast()
  const [success, setSuccess] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const botId = () => params.botId;

  onMount(async () => {
    await Promise.all([fetchBot(), fetchSpaces()]);
  });

  // Fetch bot details
  const fetchBot = async () => {
    try {
      const response = await apiRequest<BotDetails>(`${BASE_URL}/bots/${botId()}`, {
        method: "GET"
      });
      setBot(response);
    } catch (error) {
      console.error("Failed to fetch bot:", error);
      setError("Failed to load bot details");
    }
  };

  // Fetch user's spaces
  const fetchSpaces = async () => {
    try {
      const response = await apiRequest<Space[]>(`${BASE_URL}/spaces`, {
        method: "GET"
      });
      setSpaces(response);
    } catch (error) {
      console.error("Failed to fetch spaces:", error);
      setError("Failed to fetch spaces");
    } finally {
      setLoading(false);
    }
  };

  // Invite bot to selected space
  const inviteBotToSpace = async () => {
    if (!selectedSpace() || !bot()) return;

    const spaceId = selectedSpace();
    const botId = bot()!.user_id;
    
    console.log("[DEBUG] BotInvitePage - Adding bot to space:", {
      botId,
      spaceId,
      availableSpaces: spaces().map(s => ({ id: s.id, name: s.name })),
      selectedSpaceName: spaces().find(s => s.id === spaceId)?.name,
      botUsername: bot()?.username
    });

    setInviting(true);
    try {
      await apiRequest(`${BASE_URL}/spaces/${spaceId}/bots`, {
        method: "POST",
        body: {
          bot_id: botId
        }
      });
      
      setSuccess(true);
      
      // Redirect after a delay
      setTimeout(() => {
        navigate(`/spaces/${spaceId}`);
      }, 2000);
    } catch (error: any) {
      console.error("Failed to invite bot:", error);
      console.error("[DEBUG] BotInvitePage - Error details:", {
        spaceId,
        botId,
        errorMessage: error.message,
        errorResponse: error.response,
        availableSpaces: spaces().map(s => ({ id: s.id, name: s.name }))
      });
      setError("Failed to invite bot to space");
    } finally {
      setInviting(false);
    }
  };

  // if (loading()) {
  //   return (
  //     <div class="min-h-screen flex items-center justify-center relative overflow-hidden">
  //       <div class="absolute inset-0 opacity-40">
  //         <img src="https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f422.png" alt="Turtle" class="absolute w-24 h-24 animate-swim-1" style={{ top: "20%", left: "10%" }} />
  //         <img src="https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f422.png" alt="Turtle" class="absolute w-16 h-16 animate-swim-2" style={{ top: "60%", right: "15%" }} />
  //         <img src="https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f422.png" alt="Turtle" class="absolute w-20 h-20 animate-swim-3" style={{ bottom: "15%", left: "30%" }} />
  //       </div>
  //       <div class="absolute inset-0 bg-gradient-to-br from-[#1a1b26]/80 via-[#1a1b26]/60 to-[#1a1b26]/90"></div>
  //       <button onClick={() => navigate("/")} class="absolute top-4 left-4 text-white bg-background1 px-4 py-2 rounded-md hover:bg-background2">Back to Home</button>
  //       <div class="text-center relative z-10">
  //                  <p class="text-text-secondary">Loading bot invite...</p>
  //       </div>
  //     </div>
  //   );
  // }

  if (success()) {
    return (
      <div class="min-h-screen flex items-center justify-center relative overflow-hidden">
        <div class="absolute inset-0 opacity-40">
          <img src="https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f422.png" alt="Turtle" class="absolute w-24 h-24 animate-swim-1" style={{ top: "20%", left: "10%" }} />
          <img src="https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f422.png" alt="Turtle" class="absolute w-16 h-16 animate-swim-2" style={{ top: "60%", right: "15%" }} />
          <img src="https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f422.png" alt="Turtle" class="absolute w-20 h-20 animate-swim-3" style={{ bottom: "15%", left: "30%" }} />
        </div>
        <div class="absolute inset-0 bg-gradient-to-br from-[#1a1b26]/80 via-[#1a1b26]/60 to-[#1a1b26]/90"></div>
        <button onClick={() => navigate("/")} class="absolute top-4 left-4 text-white bg-background1 px-4 py-2 rounded-md hover:bg-background2">Back to Home</button>
        <div class="bg-background1 rounded-lg p-8 max-w-md w-full mx-4 text-center relative z-10">
          <Check class="w-16 h-16 text-success mx-auto mb-4" />
          <h1 class="text-2xl font-bold text-text-primary mb-2">Bot Added!</h1>
          <p class="text-text-secondary mb-4">
            {bot()?.username} has been successfully added to the space. Redirecting you now...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div class="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div class="absolute inset-0 opacity-40">
        <img src="https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f422.png" alt="Turtle" class="absolute w-24 h-24 animate-swim-1" style={{ top: "20%", left: "10%" }} />
        <img src="https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f422.png" alt="Turtle" class="absolute w-16 h-16 animate-swim-2" style={{ top: "60%", right: "15%" }} />
        <img src="https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f422.png" alt="Turtle" class="absolute w-20 h-20 animate-swim-3" style={{ bottom: "15%", left: "30%" }} />
      </div>
      <div class="absolute inset-0 bg-gradient-to-br from-[#1a1b26]/80 via-[#1a1b26]/60 to-[#1a1b26]/90"></div>
      <button onClick={() => navigate("/")} class="absolute top-4 left-4 text-white bg-background1 px-4 py-2 rounded-md hover:bg-background2">Back to Home</button>
      
      <div class="bg-background1 rounded-lg p-6 max-w-md w-full relative z-10">
        <div class="text-center mb-6">
          <div class="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Bot class="w-8 h-8 text-primary" />
          </div>
          <h1 class="text-2xl font-bold text-text-primary mb-2">
            Invite Bot to Space
          </h1>
        </div>

        {error() && (
          <div class="bg-error/10 border border-error/20 rounded-lg p-4 mb-6">
            <div class="flex items-center gap-2">
              <AlertCircle class="w-5 h-5 text-error" />
              <span class="text-error font-medium">Error</span>
            </div>
            <p class="text-error mt-1">{error()}</p>
          </div>
        )}

        {bot() && (
          <div class="bg-background2 border border-border rounded-lg p-6 mb-6">
            <div class="flex items-center space-x-4 mb-4">
              <div class="relative">
                {bot()?.avatar ? (
                  <img 
                    src={`${FS_URL}/avatars/${bot()!.user_id}/${bot()!.avatar}`} 
                    alt={bot()!.username}
                    class="w-16 h-16 rounded-lg object-cover"
                  />
                ) : (
                  <div class="w-16 h-16 bg-primary rounded-lg flex items-center justify-center">
                    <Bot class="w-8 h-8 text-white" />
                  </div>
                )}
              </div>
              <div class="flex-1">
                <h2 class="text-xl font-bold text-text-primary mb-1">{bot()?.display_name || bot()?.username}</h2>
                <p class="text-text-secondary text-sm">@{bot()?.username}</p>
                <Show when={bot()?.description}>
                  <p class="text-text-secondary text-sm mt-2">{bot()?.description}</p>
                </Show>
              </div>
            </div>
          </div>
        )}

        <div class="mb-6">
          <h3 class="text-lg font-semibold text-text-primary mb-4">Select a Space</h3>
          
          <Show when={spaces().length === 0 && !loading()}>
            <p class="text-text-secondary text-center py-4">You don't have any spaces yet.</p>
          </Show>
          
          <Show when={spaces().length > 0}>
            <div class="space-y-3 mb-4">
              <For each={spaces()}>
                {(space) => (
                  <button
                    onClick={() => setSelectedSpace(space.id)}
                    class={`w-full p-4 rounded-lg border-2 transition-colors text-left ${
                      selectedSpace() === space.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div class="flex items-center gap-3">
                      {space.icon ? (
                        <img 
                          src={`${FS_URL}/space_icons/${space.id}/${space.icon}`}
                          alt={space.name}
                          class="w-10 h-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div class="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                          <span class="text-white font-bold text-sm">
                            {space.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <span class="font-medium text-text-primary">{space.name}</span>
                    </div>
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>

        <div class="space-y-4">
          <Show when={spaces().length > 0}>
            <button
              onClick={inviteBotToSpace}
              disabled={!selectedSpace() || inviting() || !!error()}
              class="w-full bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-3"
            >
              {inviting() ? (
                <>
                 <span>Adding Bot...</span>
                </>
              ) : (
                <>
                  <Bot class="w-5 h-5" />
                  <span>Add Bot to Space</span>
                </>
              )}
            </button>
          </Show>
        </div>
      </div>
    </div>
  );
};

export default BotInvitePage;