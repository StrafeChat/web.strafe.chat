import { useAuth } from "../../lib/providers/auth/AuthProvider";
import { Navigate } from "@solidjs/router";
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';
import { LoadingScreen } from "../shared/LoadingScreen";

export const ProtectedRoute = (props: { children: JSX.Element }) => {
  const { isAuthenticated, loading } = useAuth();

  return (
    <Show
      when={!loading()}
      fallback={<LoadingScreen />}
    >
      <Show
        when={isAuthenticated()}
        fallback={<Navigate href="/login" />}
      >
        {props.children}
      </Show>
    </Show>
  );
};