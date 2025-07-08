import { Component, Show } from "solid-js";
import { useAuth } from "../../lib/providers/auth/AuthProvider";

interface ProtectedRouteProps {
  children: any;
}

const ProtectedRoute: Component<ProtectedRouteProps> = (props) => {
  const { isAuthenticated, loading } = useAuth();

  return (
    <Show
      when={!loading()}
      fallback={null}
    >
      <Show
        when={isAuthenticated()}
        fallback={
          <div class="flex items-center justify-center min-h-screen">
            <div class="text-center">
              <h1 class="text-2xl font-bold mb-4">Access Denied</h1>
              <p class="text-gray-600">Please log in to access this page.</p>
            </div>
          </div>
        }
      >
        {props.children}
      </Show>
    </Show>
  );
};

export default ProtectedRoute;
