import type { Component } from 'solid-js';
import { createEffect } from 'solid-js';
import { useLocation } from '@solidjs/router';
import { SpaceBar } from './SpaceBar';
import { RoomsBar } from './RoomsBar';
import { ContextMenu } from '../ContextMenu';
import { lastVisited } from '../../stores/lastVisited';

interface AppShellProps {
  children?: import('solid-js').JSX.Element;
}

export const AppShell: Component<AppShellProps> = (props) => {
  const location = useLocation();
  createEffect(() => {
    lastVisited.set(location.pathname);
  });
  return (
    <div class="h-screen flex bg-[hsl(0_0%_6%)] text-foreground overflow-hidden">
      <SpaceBar />
      <RoomsBar />
      <main class="flex-1 flex flex-col min-w-0 overflow-hidden bg-[hsl(0_0%_6%)]">
        {props.children}
      </main>
      <ContextMenu />
    </div>
  );
};
