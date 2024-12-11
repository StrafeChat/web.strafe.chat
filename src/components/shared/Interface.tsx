import { JSX } from "solid-js";
import SpacesList from "../spaces/SpacesList";
import RoomsList from "../spaces/rooms/RoomsList";
import { ProtectedRoute } from "../auth/ProtectedRoute";
import { useLocation } from "@solidjs/router";
import { PMList } from "../home/pms/PMList";

export const Interface = (props: { children: JSX.Element }) => {
  const location = useLocation();
  const showRoomsList = () => location.pathname.startsWith("/spaces");

  return (
    <ProtectedRoute>
      <div class="flex h-screen bg-background text-text-primary overflow-hidden">
        <div class="flex md:flex-1 w-screen overflow-x-auto snap-x snap-mandatory scroll-smooth hide-scrollbar">
          {/* First snap point - Lists */}
          <div class="flex w-[calc(72px+15rem)] md:w-auto flex-none snap-start">
            <div class="w-[72px] h-screen flex-none">
              <SpacesList />
            </div>
            <div class="w-60 h-screen flex-none">
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
      </div>
    </ProtectedRoute>
  );
};
