import { useAuth } from "../../lib/providers/auth/AuthProvider";
import { Navigate } from "@solidjs/router";
import type { JSX } from "solid-js";
import { Show, createMemo } from "solid-js";
import { LoadingScreen } from "../shared/LoadingScreen";
import { useAssetLoading } from "../../lib/hooks/useAssetLoading";

export const ProtectedRoute = (props: { children: JSX.Element }) => {
  const {
    user,
    relationships,
    relationshipRequests,
    isAuthenticated,
    loading,
  } = useAuth();
  const assetsLoaded = useAssetLoading();

  const authLoadingDone = createMemo(() => !loading() && assetsLoaded());
  const allDataLoaded = createMemo(
    () =>
      isAuthenticated() && user() && relationships() && relationshipRequests(),
  );

  const shouldRedirect = createMemo(
    () => authLoadingDone() && !isAuthenticated(),
  );

  return (
    <Show when={authLoadingDone()} fallback={<LoadingScreen />}>
      <Show
        when={!shouldRedirect() && allDataLoaded()}
        fallback={<Navigate href="/login" />}
      >
        {props.children}
      </Show>
    </Show>
  );
};
