import { Component, createSignal, createEffect } from "solid-js";
import { useAuth } from "../../lib/providers/auth/AuthProvider";
import { useTransContext } from "@mbarzda/solid-i18next";
import { StatusIndicator, UserStatus } from "../common/StatusIndicator";
import { Avatar } from "../common/Avatar";
import { Tooltip } from "../common/Tooltip";
import Settings from "./icons/Settings";
import UserSettings from "../settings/UserSettings";
import ClientUserPopup from "../common/ClientUserPopup";
import { capitalizeStatus } from "../../lib/utils/status";
import { Portal } from "solid-js/web";
import { Show } from "solid-js";
import { useVoice, VoiceState } from "../../lib/providers/voice/VoiceProvider";
import { useCache } from "../../lib/providers/cache/CacheProvider";
import { RoomType } from "../../types/roomTypes";

export const ClientUserArea: Component = () => {
  const { user } = useAuth();
  const { getUser, rooms } = useCache();
  const { state, room: voiceRoomId, disconnect, enableCamera, enableMicrophone, enableScreenShare, setDeafened, enabledMedia } = useVoice();
  const [t] = useTransContext();
  const [showSettings, setShowSettings] = createSignal(false);
  const [showUserPopup, setShowUserPopup] = createSignal(false);
  const [userProfileTrigger, setUserProfileTrigger] = createSignal<HTMLDivElement>();
  const [customStatus, setCustomStatus] = createSignal("");
  const [customEmoji, setCustomEmoji] = createSignal("");
  
  // Track media states for real-time updates
  const [isMicEnabled, setIsMicEnabled] = createSignal(false);
  const [isCameraEnabled, setIsCameraEnabled] = createSignal(false);
  const [isScreenShareEnabled, setIsScreenShareEnabled] = createSignal(false);
  const [isDeafened, setIsDeafened] = createSignal(false);
  
  // Update media states in real-time
  createEffect(() => {
    const media = enabledMedia();
    setIsMicEnabled(media.audio);
    setIsCameraEnabled(media.video);
    setIsScreenShareEnabled(media.screenShare);
    setIsDeafened(media.deafened);
  });

  // Get current voice room info
  const currentVoiceRoom = () => {
    const allRooms = rooms();
    if (!allRooms || !voiceRoomId() || state() !== VoiceState.CONNECTED) return null;
    return allRooms.find(room => room.id === voiceRoomId());
  };

  // Get the other user in PM call
  const getCallPartner = () => {
    const room = currentVoiceRoom();
    if (!room || room.type !== RoomType.PM) return null;
    
    const currentUserId = user()?.id;
    const otherUserId = room.recipients?.find(id => id !== currentUserId);
    return otherUserId ? getUser(otherUserId) : null;
  };

  const handleDisconnectCall = async () => {
    await disconnect();
  };

  const handleToggleMicrophone = async () => {
    const media = enabledMedia();
    await enableMicrophone(!media.audio);
  };

  const handleToggleCamera = async () => {
    const media = enabledMedia();
    await enableCamera(!media.video);
  };

  const handleToggleScreenShare = async () => {
    const media = enabledMedia();
    await enableScreenShare(!media.screenShare);
  };

  const handleToggleDeafen = () => {
    const media = enabledMedia();
    setDeafened(!media.deafened);
  };

  return (
    <>
      <Show when={window.innerWidth > 768}>
        {/* Voice Status Section - only show when connected or connecting */}
        <Show when={state() === VoiceState.CONNECTED || state() === VoiceState.CONNECTING}>
          <div class="border-t border-border px-3 py-2 bg-background1">
            <div class="flex items-center justify-between">
              <div class="flex flex-col gap-1 min-w-0">
                {/* Status indicator */}
                <div class="flex items-center gap-2">
                  <div class={`w-2 h-2 rounded-full ${
                    state() === VoiceState.CONNECTED ? 'bg-green-500' :
                    state() === VoiceState.CONNECTING ? 'bg-yellow-500 animate-pulse' :
                    'bg-red-500'
                  }`}></div>
                  <span class={`text-xs font-medium ${
                    state() === VoiceState.CONNECTED ? 'text-green-500' :
                    state() === VoiceState.CONNECTING ? 'text-yellow-500' :
                    'text-red-500'
                  }`}>
                    {state() === VoiceState.CONNECTED ? 'Voice Connected' :
                     state() === VoiceState.CONNECTING ? 'Connecting' :
                     'Disconnected'}
                  </span>
                </div>
                {/* Location/Room info */}
                <div class="text-xs text-text-secondary truncate">
                  <Show when={currentVoiceRoom()?.type === RoomType.PM} fallback={currentVoiceRoom()?.name || "Voice Call"}>
                    {getCallPartner()?.display_name || getCallPartner()?.username || "Voice Call"}
                  </Show>
                </div>
              </div>
              {/* Disconnect button */}
              <Tooltip content="Leave call" position="top">
                <button
                  onClick={handleDisconnectCall}
                  class="p-1.5 rounded bg-red-500 hover:bg-red-600 text-white transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                  </svg>
                </button>
              </Tooltip>
            </div>
          </div>
        </Show>
        
        {/* Camera/Screen Share Section */}
        <Show when={state() === VoiceState.CONNECTED}>
          <div class="border-t border-border px-3 py-2 bg-background1">
            <div class="flex gap-2">
              {/* Camera Toggle */}
              <Tooltip content={isCameraEnabled() ? "Turn off camera" : "Turn on camera"} position="top">
                <button
                  onClick={handleToggleCamera}
                  class={`flex-1 p-2 rounded transition-colors text-sm font-medium ${
                    isCameraEnabled() 
                      ? "bg-surface text-text-primary" 
                      : "bg-background2 text-text-secondary hover:bg-surface hover:text-text-primary"
                  }`}
                >
                  <div class="flex items-center justify-center gap-2">
                    <Show when={isCameraEnabled()} fallback={
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </svg>
                    }>
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="23,7 16,12 23,17 23,7"></polygon>
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                      </svg>
                    </Show>
                    Camera
                  </div>
                </button>
              </Tooltip>
              
              {/* Screen Share Toggle */}
              <Tooltip content={isScreenShareEnabled() ? "Stop sharing screen" : "Share screen"} position="top">
                <button
                  onClick={handleToggleScreenShare}
                  class={`flex-1 p-2 rounded transition-colors text-sm font-medium ${
                    isScreenShareEnabled() 
                      ? "bg-surface text-text-primary" 
                      : "bg-background2 text-text-secondary hover:bg-surface hover:text-text-primary"
                  }`}
                >
                  <div class="flex items-center justify-center gap-2">
                    <Show when={isScreenShareEnabled()} fallback={
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                        <line x1="8" y1="21" x2="16" y2="21"></line>
                        <line x1="12" y1="17" x2="12" y2="21"></line>
                      </svg>
                    }>
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                        <line x1="8" y1="21" x2="16" y2="21"></line>
                        <line x1="12" y1="17" x2="12" y2="21"></line>
                        <circle cx="12" cy="10" r="3" fill="currentColor"></circle>
                      </svg>
                    </Show>
                    Screen
                  </div>
                </button>
              </Tooltip>
            </div>
          </div>
        </Show>
        
        <div class="border-t border-border mt-auto">
          <div class="flex items-center bg-background1 pl-1.5 pr-2 py-1 w-full">
            <div class="flex-1 min-w-0 flex items-center overflow-hidden">
              <div
                class="group inline-flex items-center gap-2 hover:bg-surface hover:bg-opacity-10 transition-colors hover:cursor-pointer rounded-md pl-1 pr-2 py-1 overflow-hidden"
                onClick={() => setShowUserPopup(true)}
                ref={setUserProfileTrigger}
              >
                <div class="relative flex items-center flex-shrink-0">
                  <div class="relative w-8 h-8">
                    <Avatar
                      userId={user()?.id!}
                      size="sm"
                      avatar={user()?.avatar}
                      alt="Avatar"
                    />
                  </div>
                  <StatusIndicator
                    status={(user()?.presence?.status || "offline") as UserStatus}
                    class="border-background1 group-hover:border-surface group-hover:border-opacity-10 transition-colors"
                  />
                </div>
                <div class="min-w-0 overflow-hidden">
                  <div class="text-sm font-medium truncate select-none">
                    {user()?.display_name}
                  </div>
                  <div class="text-xs text-text-secondary truncate select-none">
                    {user()?.presence?.custom_status ||
                      capitalizeStatus(user()?.presence?.status || "offline")}
                  </div>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-1 flex-shrink-0 ml-2">
              {/* Client User Popup */}
              <ClientUserPopup
                isOpen={showUserPopup()}
                onClose={() => setShowUserPopup(false)}
                triggerRef={userProfileTrigger()}
                customStatus={customStatus()}
                setCustomStatus={setCustomStatus}
                customEmoji={customEmoji()}
                setCustomEmoji={setCustomEmoji}
              />
              
              {/* Voice Controls - always show mute and deafen buttons */}
              {/* Microphone Toggle */}
              <Tooltip content={state() === VoiceState.CONNECTED ? (isMicEnabled() ? "Mute" : "Unmute") : "Microphone (Not in call)"} position="top">
                <button
                  onClick={handleToggleMicrophone}
                  class={`p-2 transition-colors rounded-md ${
                    state() === VoiceState.CONNECTED
                      ? (isMicEnabled() 
                          ? "text-text-primary hover:bg-surface hover:bg-opacity-10" 
                          : "text-red-500 bg-red-500 bg-opacity-10 hover:bg-opacity-20")
                      : "text-text-secondary hover:bg-surface hover:bg-opacity-10"
                  }`}
                >
                  <Show when={state() === VoiceState.CONNECTED && isMicEnabled()} fallback={
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12l1.27-1.27A3 3 0 0 0 15 11V5a3 3 0 0 0-3-3 3 3 0 0 0-3 3v.17L9 5.17"></path>
                      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
                      <line x1="12" y1="19" x2="12" y2="23"></line>
                      <line x1="8" y1="23" x2="16" y2="23"></line>
                    </svg>
                  }>
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                      <line x1="12" y1="19" x2="12" y2="23"></line>
                      <line x1="8" y1="23" x2="16" y2="23"></line>
                    </svg>
                  </Show>
                </button>
              </Tooltip>
              
              {/* Deafen Toggle */}
              <Tooltip content={state() === VoiceState.CONNECTED ? (isDeafened() ? "Undeafen" : "Deafen") : "Deafen (Not in call)"} position="top">
                <button
                  onClick={handleToggleDeafen}
                  class={`p-2 transition-colors rounded-md ${
                    state() === VoiceState.CONNECTED
                      ? (isDeafened() 
                          ? "text-red-500 bg-red-500 bg-opacity-10 hover:bg-opacity-20" 
                          : "text-text-primary hover:bg-surface hover:bg-opacity-10")
                      : "text-text-secondary hover:bg-surface hover:bg-opacity-10"
                  }`}
                >
                  <Show when={state() === VoiceState.CONNECTED && isDeafened()} fallback={
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
                      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
                    </svg>
                  }>
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
                      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  </Show>
                </button>
              </Tooltip>
              
              {/* User Settings Modal */}
              <Tooltip content={t("settings.sections.user")} position="top">
                <button
                  class="p-2 text-text-secondary hover:text-text-primary transition-colors rounded-md hover:bg-surface hover:bg-opacity-10"
                  onClick={() => setShowSettings(true)}
                >
                  <Settings />
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      </Show>
      <Portal>
        <UserSettings
          isOpen={showSettings()}
          onClose={() => setShowSettings(false)}
        />
      </Portal>
    </>
  );
};