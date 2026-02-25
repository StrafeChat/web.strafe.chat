import type { Component } from 'solid-js';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { AppShell } from '../components/layout/AppShell';

const Main: Component<{ children?: import('solid-js').JSX.Element }> = (props) => (
  <ProtectedRoute>
    <AppShell>
      {props.children}
    </AppShell>
  </ProtectedRoute>
);

export default Main;
