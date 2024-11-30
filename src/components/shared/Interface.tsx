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
      <div class="flex h-screen bg-background text-text-primary">
        <div class="w-[72px] h-screen flex-none">
          <SpacesList />
        </div>

        <div class="w-60 h-screen flex-none">
          {showRoomsList() ? <RoomsList /> : <PMList />}
        </div>

        <div class="flex-1 h-screen overflow-hidden">{props.children}</div>
      </div>
    </ProtectedRoute>
  );
};
