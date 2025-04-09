import { JSX, createSignal, onMount } from "solid-js";
import SpacesList from "../spaces/SpacesList";
import RoomsList from "../spaces/rooms/RoomsList";
import { ProtectedRoute } from "../auth/ProtectedRoute";
import { useLocation, A } from "@solidjs/router";
import { PMList } from "../home/pms/PMList";
import { useAuth } from "../../lib/providers/auth/AuthProvider";
import UserSettings from "../settings/UserSettings";
import { Portal } from "solid-js/web";

export const Interface = (props: { children: JSX.Element }) => {
  const location = useLocation();
  const { isMobile } = useAuth();
  const [showSettings, setShowSettings] = createSignal(false)
  const [isSidebarVisible, setIsSidebarVisible] = createSignal(true);

  const showRoomsList = () => location.pathname.startsWith("/spaces");

  const handleScroll = () => {
    const container = document.querySelector(".snap-x");
    if (container) {
      setIsSidebarVisible(container.scrollLeft === 0);
    }
  };

  // Show bottom nav on mobile when sidebar is visible
  const showBottomNav = () => {
    if (!isMobile()) return false;
    if (location.pathname.startsWith("/rooms")) {
      return isSidebarVisible();
    }
    return true;
  };

  onMount(() => {
    const container = document.querySelector(".snap-x");
    if (container) {
      container.addEventListener('scroll', handleScroll);
    }
    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
    };
  });

  return (
    <ProtectedRoute>
      <div class="flex h-screen bg-background text-text-primary overflow-hidden">
        <div class={`flex md:flex-1 w-screen overflow-x-auto snap-x snap-mandatory scroll-smooth hide-scrollbar ${showBottomNav() ? 'pb-14' : ''} md:pb-0`}>
          {/* First snap point - Lists */}
          <div class="flex w-[calc(92px+15rem)] md:w-auto flex-none snap-start">
            <div class="w-[72px] h-screen flex-none">
              <SpacesList />
            </div>
            <div class="w-[260px] h-screen flex-none">
              {showRoomsList() ? <RoomsList /> : <PMList />}
            </div>
          </div>

          {/* Second snap point - Content */}
          <div class="w-screen md:flex-1 flex-none snap-start">
            <div class="w-full h-full flex">
              <div class="flex-1 h-full w-full">{props.children}</div>
              {/* Members List (desktop only) */}
              {location.pathname.startsWith("/spaces") && (
                <div class="w-64 h-screen flex-none hidden md:block">
                  {/* Add your MembersList component here */}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Bottom Navigation */}
        <div class="fixed bottom-0 left-0 right-0 h-14 bg-background2 border-t border-border md:hidden transition-all duration-300 transform" style={{ transform: showBottomNav() ? 'translateY(0)' : 'translateY(100%)', opacity: showBottomNav() ? '1' : '0' }}>
            <div class="flex items-center justify-around h-full px-4">
              <A href="/" class="p-2 text-text-secondary hover:text-text-primary transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </A>
              <A href="/friends" class="p-2 text-text-secondary hover:text-text-primary transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </A>
              <A href="/discover" class="p-2 text-text-secondary hover:text-text-primary transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10" />
                  <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                </svg>
              </A>
              <button class="p-2 text-text-secondary hover:text-text-primary transition-colors" onClick={() => setShowSettings(true)}>
                <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </div>
          </div>
          <Portal>
      <UserSettings
        isOpen={showSettings()}
        onClose={() => setShowSettings(false)}
      />
      </Portal>
      </div>
    </ProtectedRoute>
  );
};
