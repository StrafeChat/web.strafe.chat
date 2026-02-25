import type { Component } from 'solid-js';
import { Navigate } from '@solidjs/router';
import { auth } from '../stores/auth';

interface ProtectedRouteProps {
  children: import('solid-js').JSX.Element;
}

export const ProtectedRoute: Component<ProtectedRouteProps> = (props) => {
  if (!auth.token) {
    return <Navigate href="/login" />;
  }
  return <>{props.children}</>;
};
