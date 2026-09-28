import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { Navigate } from '@solidjs/router';
import { auth } from '../stores/auth';

interface ProtectedRouteProps {
  children: import('solid-js').JSX.Element;
}

/**
 * `<Show>`, not an early return: a component body runs once, so `if (!auth.token) return
 * <Navigate />` decided the route at mount and never again. A session that expired or was
 * signed out afterwards stayed on the protected page, and a sign-in after mount never left
 * the redirect.
 */
export const ProtectedRoute: Component<ProtectedRouteProps> = (props) => (
  <Show when={auth.token} fallback={<Navigate href="/login" />}>
    {props.children}
  </Show>
);
