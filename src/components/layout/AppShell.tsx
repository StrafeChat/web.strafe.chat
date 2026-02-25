import type { Component } from 'solid-js';
import { useLocation } from '@solidjs/router';
import { Show } from 'solid-js';
import { SpaceBar } from './SpaceBar';
import { RoomsBar } from './RoomsBar';
import { ActivityBar } from './ActivityBar';

interface AppShellProps {
  children?: import('solid-js').JSX.Element;
}

export const AppShell: Component<AppShellProps> = (props) => {
  const location = useLocation();
  const isFriends = () => location.pathname === '/friends';

  return (
    <div class="h-screen flex bg-[hsl(0_0%_6%)] text-foreground overflow-hidden">
      <SpaceBar />
      <RoomsBar />
      <main class="flex-1 flex flex-col min-w-0 overflow-hidden bg-[hsl(0_0%_6%)]">
        {props.children}
      </main>
      <Show when={isFriends()}>
        <ActivityBar />
      </Show>
    </div>
  );
};
