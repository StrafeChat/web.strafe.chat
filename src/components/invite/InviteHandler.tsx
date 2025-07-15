import { Component, createSignal, onMount } from "solid-js";
import { useParams, useNavigate } from "@solidjs/router";
import { api } from "../../lib/api";
import { FS_URL } from "../../constants";

// Custom SVG Icons
export const Loader2 = (props: any) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 12a9 9 0 11-6.219-8.56"/>
  </svg>
);

const Users = (props: any) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M22 21v-2a4 4 0 00-3-3.87"/>
    <path d="M16 3.13a4 4 0 010 7.75"/>
  </svg>
);

const AlertCircle = (props: any) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const CheckCircle = (props: any) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
    <polyline points="22,4 12,14.01 9,11.01"/>
  </svg>
);

interface InviteInfo {
  space_id: number;
  space_name: string;
  space_icon?: string;
  space_banner?: string;
  space_name_acronym?: string;
  inviter_id: string;
  inviter_username: string;
  inviter_display_name?: string;
  inviter_avatar?: string;
  member_count: number;
  expires_at?: string;
  max_uses?: number;
  uses: number;
  code: string;
}

const InviteHandler: Component = () => {
  const params = useParams();
  
  const [loading, setLoading] = createSignal(false);
  const [inviteInfo, setInviteInfo] = createSignal<InviteInfo | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [joining, setJoining] = createSignal(false);
  const [joined, setJoined] = createSignal(false);

  const inviteCode = () => params.code;

  onMount(async () => {
    if (!inviteCode()) {
      setError("Invalid invite link");
      setLoading(false);
      return;
    }

    try {
      const response = await api.spaces.invites.getInfo(inviteCode()!);
      console.log(response)
      setInviteInfo(response as InviteInfo);
      setLoading(false);
    } catch (err: any) {
      console.error("Failed to load invite:", err);
      
      if (err.message?.includes('404')) {
        setError("This invite link is invalid or does not exist");
      } else if (err.message?.includes('410')) {
        setError("This invite link has expired or reached its usage limit");
      } else {
        setError("Failed to load invite information");
      }
      setLoading(false);
    }
  });

  const handleJoinSpace = async () => {
    if (!inviteCode()) return;

    setJoining(true);
    try {
      const response = await api.spaces.invites.use(inviteCode()!) as { space_id?: number };
      setJoined(true);
      
      // Redirect to the space after a short delay
      setTimeout(() => {
        if (response.space_id) {
          window.location.href = `/spaces/${response.space_id}`;
        }
      }, 2000);
    } catch (err: any) {
      console.error("Failed to join space:", err);
      
      if (err.message?.includes('409')) {
        setError("You are already a member of this space");
      } else if (err.message?.includes('404')) {
        setError("This invite link is invalid or does not exist");
      } else if (err.message?.includes('410')) {
        setError("This invite link has expired or reached its usage limit");
      } else {
        setError("Failed to join space. Please try again.");
      }
    } finally {
      setJoining(false);
    }
  };
  const navigate = useNavigate();

  if (loading()) {
    return (
      <div class="min-h-screen flex items-center justify-center relative overflow-hidden">
        {inviteInfo()?.space_banner ? (
          <div class="absolute inset-0 bg-cover bg-center" style={{ 'background-image': `url(${inviteInfo()?.space_banner})` }}></div>
        ) : (
          <>
            <div class="absolute inset-0 opacity-40">
              <img src="https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f422.png" alt="Turtle" class="absolute w-24 h-24 animate-swim-1" style={{ top: "20%", left: "10%" }} />
              <img src="https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f422.png" alt="Turtle" class="absolute w-16 h-16 animate-swim-2" style={{ top: "60%", right: "15%" }} />
              <img src="https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f422.png" alt="Turtle" class="absolute w-20 h-20 animate-swim-3" style={{ bottom: "15%", left: "30%" }} />
              <img src="https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f422.png" alt="Turtle" class="absolute w-16 h-16 animate-swim-1" style={{ top: "40%", right: "30%" }} />
              <img src="https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f422.png" alt="Turtle" class="absolute w-24 h-24 animate-swim-2" style={{ bottom: "30%", right: "40%" }} />
            </div>
            <div class="absolute inset-0 bg-gradient-to-br from-[#1a1b26]/80 via-[#1a1b26]/60 to-[#1a1b26]/90"></div>
          </>
        )}
        <button onClick={() => navigate("/")} class="absolute top-4 left-4 text-white bg-background1 px-4 py-2 rounded-md hover:bg-background2">Back to Home</button>
        <div class="text-center relative z-10">
          <Loader2 class="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p class="text-text-secondary">Loading invite...</p>
        </div>
      </div>
    );
  }

  if (joined()) {
    return (
      <div class="min-h-screen flex items-center justify-center relative overflow-hidden">
        {inviteInfo()?.space_banner ? (
          <div class="absolute inset-0 bg-cover bg-center" style={{ 'background-image': `url(${inviteInfo()?.space_banner})` }}></div>
        ) : (
          <>
            <div class="absolute inset-0 opacity-40">
              <img src="https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f422.png" alt="Turtle" class="absolute w-24 h-24 animate-swim-1" style={{ top: "20%", left: "10%" }} />
              <img src="https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f422.png" alt="Turtle" class="absolute w-16 h-16 animate-swim-2" style={{ top: "60%", right: "15%" }} />
              <img src="https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f422.png" alt="Turtle" class="absolute w-20 h-20 animate-swim-3" style={{ bottom: "15%", left: "30%" }} />
              <img src="https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f422.png" alt="Turtle" class="absolute w-16 h-16 animate-swim-1" style={{ top: "40%", right: "30%" }} />
              <img src="https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f422.png" alt="Turtle" class="absolute w-24 h-24 animate-swim-2" style={{ bottom: "30%", right: "40%" }} />
            </div>
            <div class="absolute inset-0 bg-gradient-to-br from-[#1a1b26]/80 via-[#1a1b26]/60 to-[#1a1b26]/90"></div>
          </>
        )}
        <button onClick={() => navigate("/")} class="absolute top-4 left-4 text-white bg-background1 px-4 py-2 rounded-md hover:bg-background2">Back to Home</button>
        <div class="bg-background1 rounded-lg p-8 max-w-md w-full mx-4 text-center relative z-10">
          <CheckCircle class="w-16 h-16 text-success mx-auto mb-4" />
          <h1 class="text-2xl font-bold text-text-primary mb-2">Welcome!</h1>
          <p class="text-text-secondary mb-4">
            You've successfully joined the space. Redirecting you now...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div class="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {inviteInfo()?.space_banner ? (
        <div class="absolute inset-0 bg-cover bg-center" style={{ 'background-image': `url(${inviteInfo()?.space_banner})` }}></div>
      ) : (
        <>
          <div class="absolute inset-0 opacity-40">
            <img src="https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f422.png" alt="Turtle" class="absolute w-24 h-24 animate-swim-1" style={{ top: "20%", left: "10%" }} />
            <img src="https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f422.png" alt="Turtle" class="absolute w-16 h-16 animate-swim-2" style={{ top: "60%", right: "15%" }} />
            <img src="https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f422.png" alt="Turtle" class="absolute w-20 h-20 animate-swim-3" style={{ bottom: "15%", left: "30%" }} />
            <img src="https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f422.png" alt="Turtle" class="absolute w-16 h-16 animate-swim-1" style={{ top: "40%", right: "30%" }} />
            <img src="https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f422.png" alt="Turtle" class="absolute w-24 h-24 animate-swim-2" style={{ bottom: "30%", right: "40%" }} />
          </div>
          <div class="absolute inset-0 bg-gradient-to-br from-[#1a1b26]/80 via-[#1a1b26]/60 to-[#1a1b26]/90"></div>
        </>
      )}
      <button onClick={() => navigate("/")} class="absolute top-4 left-4 text-white bg-background1 px-4 py-2 rounded-md hover:bg-background2">Back to Home</button>
      <div class="bg-background1 rounded-lg p-6 max-w-md w-full relative z-10">
        <div class="text-center mb-6">
          <div class="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Users class="w-8 h-8 text-primary" />
          </div>
          <h1 class="text-2xl font-bold text-text-primary mb-2">
            You've been invited to join a space!
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

        {inviteInfo() && (
          <div class="bg-background2 border border-border rounded-lg p-6 mb-6">
            <div class="flex items-center space-x-4 mb-6">
              <div class="relative">
                {inviteInfo()?.space_icon ? (
                  <img 
                    src={inviteInfo()!.space_icon} 
                    alt={inviteInfo()!.space_name}
                    class="w-16 h-16 rounded-lg object-cover"
                  />
                ) : (
                  <div class="w-16 h-16 bg-primary rounded-lg flex items-center justify-center">
                    <p class="text-3xl font-bold">{inviteInfo()!.space_name_acronym}</p>
                  </div>
                )}
              </div>
              <div class="flex-1">
                <h2 class="text-2xl font-bold text-text-primary mb-1">{inviteInfo()?.space_name}</h2>
                <p class="text-text-secondary flex items-center gap-2">
                  <Users class="w-4 h-4" />
                  {inviteInfo()?.member_count} members
                </p>
              </div>
            </div>
            
            <div class="bg-surface rounded-lg p-4 space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-text-secondary">Invited by</span>
                <div class="flex items-center gap-2">
                  {inviteInfo()?.inviter_avatar && (
                    <img 
                      src={`${FS_URL}/avatars/${inviteInfo()?.inviter_id}/${inviteInfo()?.inviter_avatar}`}
                      alt={inviteInfo()!.inviter_username}
                      class="w-6 h-6 rounded-full"
                    />
                  )}
                  <span class="text-text-primary font-medium">
                    {inviteInfo()?.inviter_display_name || inviteInfo()?.inviter_username}
                  </span>
                </div>
              </div>
              
              {inviteInfo()?.expires_at && (
                <div class="flex items-center justify-between">
                  <span class="text-text-secondary">Expires</span>
                  <span class="text-text-primary">
                    {new Date(inviteInfo()!.expires_at!).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <div class="space-y-4">
           {joined() ? (
             <div class="flex items-center justify-center space-x-3 text-success bg-success/10 border border-success/20 rounded-lg py-4 px-6">
               <CheckCircle class="w-6 h-6" />
               <span class="font-medium">Successfully joined the space!</span>
             </div>
           ) : (
             <button
               onClick={handleJoinSpace}
               disabled={joining() || !!error()}
               class="w-full bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-3"
             >
               {joining() ? (
                 <>
                   <Loader2 class="w-5 h-5 animate-spin" />
                   <span>Joining Space...</span>
                 </>
               ) : (
                 <>
                   <Users class="w-5 h-5" />
                   <span>Join Space</span>
                 </>
               )}
             </button>
           )}
         </div>
      </div>
    </div>
  );
};

export default InviteHandler;