import { Component, Show, createEffect } from "solid-js";
import { useAuth } from "../../lib/providers/auth/AuthProvider";
import { useNavigate } from "@solidjs/router";
import LoadingScreen from "../shared/LoadingScreen";

interface ProtectedRouteProps {
  children: any;
}

const ProtectedRoute: Component<ProtectedRouteProps> = (props) => {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  createEffect(() => {
    // Only redirect if not loading and not authenticated
    if (!loading() && !isAuthenticated()) {
      navigate("/login", { replace: true });
    }
  });

  return (
    <Show when={!loading()} fallback={<LoadingScreen />}>
      <Show when={isAuthenticated()} fallback={<LoadingScreen />}>
        {props.children}
      </Show>
    </Show>
  );
};

export default ProtectedRoute;
