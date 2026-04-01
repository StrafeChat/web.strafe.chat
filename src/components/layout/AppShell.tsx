import type { Component } from 'solid-js';
import { createEffect, Show, onCleanup, onMount } from 'solid-js';
import { useLocation } from '@solidjs/router';
import { SpaceBar } from './SpaceBar';
import { RoomsBar } from './RoomsBar';
import { SpaceRoomsBar } from './SpaceRoomsBar';
import { ContextMenu } from '../ContextMenu';
import { lastVisited } from '../../stores/lastVisited';
import {
  isMdViewport,
  mobileNavFocus,
  setIsMdViewport,
  setMobileNavFocus,
} from '../../stores/mobileShellLayout';
import { appShellCanvas } from '../../theme/appChrome';

interface AppShellProps {
  children?: import('solid-js').JSX.Element;
}

export const AppShell: Component<AppShellProps> = (props) => {
  const location = useLocation();
  createEffect(() => {
    lastVisited.set(location.pathname);
  });

  onMount(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const apply = () => setIsMdViewport(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    onCleanup(() => mq.removeEventListener('change', apply));
  });

  /** Mobile: auto-switch focus from high-level routes vs active room/channel */
  createEffect(() => {
    if (isMdViewport()) return;
    const p = location.pathname;
    const inDmOrGroupRoom = /^\/rooms\/[^/]+/.test(p);
    const inSpaceChannel = /^\/spaces\/[^/]+\/rooms\/[^/]+/.test(p);
    if (inDmOrGroupRoom || inSpaceChannel) {
      setMobileNavFocus('content');
    } else if (
      p === '/' ||
      p === '/friends' ||
      p === '/notes' ||
      /^\/spaces\/[^/]+$/.test(p)
    ) {
      setMobileNavFocus('rails');
    }
  });

  const isSpaceRoute = () => /^\/spaces\/[^/]+/.test(location.pathname);
  return (
    <div class={`flex h-screen overflow-hidden ${appShellCanvas}`}>
      <SpaceBar />
      <Show when={isSpaceRoute()} fallback={<RoomsBar />}>
        <SpaceRoomsBar />
      </Show>
      <main
        class={`relative flex min-h-0 flex-col overflow-hidden ${appShellCanvas} ${
          isMdViewport()
            ? 'min-w-0 flex-1'
            : mobileNavFocus() === 'rails'
              ? 'w-12 shrink-0 grow-0 border-l border-border/80'
              : 'min-w-0 flex-1'
        }`}
      >
        <div
          class={`flex min-h-0 flex-1 flex-col overflow-hidden ${
            !isMdViewport() && mobileNavFocus() === 'rails'
              ? 'w-screen max-w-none'
              : 'min-w-0'
          }`}
        >
          {props.children}
        </div>
        <Show when={!isMdViewport() && mobileNavFocus() === 'rails'}>
          <button
            type="button"
            class="absolute inset-y-0 left-0 z-20 w-full cursor-e-resize border-0 bg-transparent p-0 md:hidden"
            aria-label="Open conversation"
            onClick={() => setMobileNavFocus('content')}
          />
        </Show>
      </main>
      <ContextMenu />
    </div>
  );
};
