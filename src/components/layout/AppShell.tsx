import type { Component } from 'solid-js';
import { createEffect, createMemo, createSignal, Show, onCleanup, onMount } from 'solid-js';
import { useLocation, useNavigate } from '@solidjs/router';
import { SpaceBar } from './SpaceBar';
import { RoomsBar } from './RoomsBar';
import { SpaceRoomsBar } from './SpaceRoomsBar';
import { MobileTabBar } from './MobileTabBar';
import { MobileNotificationsPanel } from './MobileNotificationsPanel';
import { MobileYouPanel } from './MobileYouPanel';
import { ContextMenu } from '../ContextMenu';
import { UserProfilePopover } from '../UserProfilePopover';
import { ReportDialog } from '../ReportDialog';
import { UserProfileFullModal } from '../UserProfileFullModal';
import { IncomingCallModal, ScreenShareDialog, VoiceDock, VoiceStatsPopover, VoiceUserMenu } from '../voice';
import { leaveVoiceRoom, toggleDeafen, toggleMute } from '../../stores/voice';
import { lastVisited } from '../../stores/lastVisited';
import { settings, setMembersPanelOpen, setMessageCompact } from '../../stores/settings';
import { openUserSettings } from '../../stores/userSettingsModal';
import { initKeybinds } from '../../stores/keybinds';
import { spaces } from '../../stores/spaces';
import { rooms, sortRoomsByLastMessage } from '../../stores/rooms';
import { ackAllSpaceRooms } from '../../api/spaces';
import { onNavigateRequest } from '../../lib/notifications';
import { attachSwipeNavigation } from '../../lib/mobileSwipe';
import {
  isMdViewport,
  mobileMembersAvailable,
  mobileMembersOpen,
  mobilePanel,
  mobileTab,
  setIsMdViewport,
  setMobileMembersOpen,
  setMobilePanel,
  setSwipeOffset,
  setSwiping,
  swipeOffset,
  swiping,
} from '../../stores/mobileShellLayout';
import { appShellCanvas } from '../../theme/appChrome';

interface AppShellProps {
  children?: import('solid-js').JSX.Element;
}

const ROOM_TYPE_TEXT = 3;
/** Only the first shell mount of a page load may restore the last visited route. */
let restoreChecked = false;

export const AppShell: Component<AppShellProps> = (props) => {
  const location = useLocation();
  const navigate = useNavigate();
  // Read before the tracking effect below overwrites it with the current path.
  const initialLastVisited = lastVisited.path();
  createEffect(() => {
    lastVisited.set(location.pathname);
  });

  /** Alt+Up / Alt+Down: previous / next channel in the current space, or PM in the list. */
  function stepRoom(dir: 1 | -1) {
    const p = location.pathname;
    const inSpace = p.match(/^\/spaces\/(\d+)(?:\/rooms\/(\d+))?/);
    if (inSpace) {
      const list = (spaces.spaceRoomsBySpaceId[inSpace[1]!] ?? [])
        .filter((r) => r.type === ROOM_TYPE_TEXT)
        .sort((a, b) => a.position - b.position);
      if (!list.length) return;
      const idx = list.findIndex((r) => r.id === inSpace[2]);
      const next = list[idx < 0 ? 0 : (idx + dir + list.length) % list.length]!;
      navigate(`/spaces/${inSpace[1]}/rooms/${next.id}`);
      return;
    }
    const list = sortRoomsByLastMessage(rooms.rooms);
    if (!list.length) return;
    const cur = p.match(/^\/rooms\/(\d+)/)?.[1];
    const idx = cur ? list.findIndex((r) => r.id === cur) : -1;
    const next = list[idx < 0 ? 0 : (idx + dir + list.length) % list.length]!;
    navigate(`/rooms/${next.id}`);
  }

  onMount(() => {
    if (!restoreChecked) {
      restoreChecked = true;
      if (settings.restoreLastVisited && location.pathname === '/' && initialLastVisited !== '/') {
        navigate(initialLastVisited, { replace: true });
      }
    }
    onCleanup(onNavigateRequest((path) => navigate(path)));
    onCleanup(
      initKeybinds({
        openSettings: () => openUserSettings(),
        toggleMembers: () => setMembersPanelOpen(!settings.membersPanelOpen),
        toggleCompact: () => setMessageCompact(!settings.messageCompact),
        focusSearch: () => document.getElementById('room-search-input')?.focus(),
        markSpaceRead: () => {
          const sid = location.pathname.match(/^\/spaces\/(\d+)/)?.[1];
          if (sid) void ackAllSpaceRooms(sid).catch(() => undefined);
        },
        prevRoom: () => stepRoom(-1),
        nextRoom: () => stepRoom(1),
        toggleMute,
        toggleDeafen,
        disconnectVoice: () => void leaveVoiceRoom(),
      })
    );
  });

  const [viewportWidth, setViewportWidth] = createSignal(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  onMount(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const apply = () => setIsMdViewport(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    const onResize = () => setViewportWidth(window.innerWidth);
    onResize();
    window.addEventListener('resize', onResize);
    onCleanup(() => {
      mq.removeEventListener('change', apply);
      window.removeEventListener('resize', onResize);
    });
  });

  /**
   * Mobile: entering a room shows the conversation, leaving one shows the list. Friends and
   * Notes are pages too - they render into the content panel, so they must bring it on
   * screen the way a room does; forcing the list for them left both pages one viewport
   * to the right with nothing to swipe to them. Home (the list) and a space's root stay
   * on the nav side. This tracks *path changes*; a tap on a row whose path is already
   * current is handled by the row itself.
   */
  let prevPath: string | undefined;
  createEffect(() => {
    if (isMdViewport()) return;
    const p = location.pathname;
    const prev = prevPath;
    prevPath = p;
    const isRoom = (x: string | undefined) =>
      !!x && (/^\/rooms\/[^/]+/.test(x) || /^\/spaces\/[^/]+\/rooms\/[^/]+/.test(x));
    if (isRoom(p) || p === '/friends' || p === '/notes') {
      setMobileMembersOpen(false);
      setMobilePanel('content');
    } else if (/^\/spaces\/[^/]+$/.test(p)) {
      setMobilePanel('nav');
    } else if (p === '/' && (prev === undefined || isRoom(prev) || /^\/spaces\//.test(prev))) {
      // Home means the list when you arrive from a room or a space - leaving a group,
      // the rail's home icon. Coming from Friends or Notes it is a tap on the Home row,
      // and that tap already asked for the content side: leave it alone so the page shows.
      setMobilePanel('nav');
    }
  });

  const mobile = () => !isMdViewport();

  /** How far the track is pushed left, in px: 0 = nav panel, one viewport = conversation.
   * `swipeOffset` is the live finger delta, so a drag moves this 1:1. */
  const shift = createMemo(() => {
    if (!mobile()) return 0;
    const w = viewportWidth();
    const base = mobilePanel() === 'nav' ? 0 : w;
    return Math.max(0, Math.min(w, base - swipeOffset()));
  });
  /** 0 while the nav panel fills the screen, 1 once it is fully swiped away. */
  const progress = () => (mobile() ? shift() / Math.max(1, viewportWidth()) : 1);

  let trackEl: HTMLDivElement | undefined;
  let clipEl: HTMLDivElement | undefined;

  onMount(() => {
    if (!clipEl) return;
    // The track is wider than the viewport, so `overflow-hidden` makes this a scroll
    // container even though no scrollbar shows - and anything inside the conversation
    // calling focus()/scrollIntoView() then scrolls the whole shell sideways and leaves
    // the panel permanently misaligned. Snap it back; the transform is the only thing
    // allowed to move the track.
    const el = clipEl;
    const snapBack = () => {
      if (el.scrollLeft !== 0) el.scrollLeft = 0;
      if (el.scrollTop !== 0) el.scrollTop = 0;
    };
    el.addEventListener('scroll', snapBack, { passive: true });
    onCleanup(() => el.removeEventListener('scroll', snapBack));
  });

  onMount(() => {
    if (!trackEl) return;
    onCleanup(
      attachSwipeNavigation(trackEl, {
        enabled: mobile,
        width: viewportWidth,
        panel: mobilePanel,
        setPanel: setMobilePanel,
        membersAvailable: mobileMembersAvailable,
        membersOpen: mobileMembersOpen,
        setMembersOpen: setMobileMembersOpen,
        setOffset: setSwipeOffset,
        setActive: setSwiping,
      })
    );
  });

  // A swipe that was half-finished when the viewport grew (rotation, desktop) must not
  // leave the track translated.
  createEffect(() => {
    if (isMdViewport()) {
      setSwipeOffset(0);
      setSwiping(false);
    }
  });

  const isSpaceRoute = () => /^\/spaces\/[^/]+/.test(location.pathname);
  return (
    <div
      ref={(el) => {
        clipEl = el;
      }}
      class={`relative h-dvh w-full overflow-hidden ${appShellCanvas}`}
    >
      <div
        ref={(el) => {
          trackEl = el;
        }}
        class={`flex h-full ${mobile() ? 'w-[200vw] will-change-transform' : 'w-full'} ${
          mobile() && !swiping() ? 'transition-transform duration-[280ms] ease-out' : ''
        }`}
        style={mobile() ? { transform: `translate3d(${-shift()}px, 0, 0)` } : undefined}
      >
        {/* Nav panel: one viewport wide on mobile, the usual two rails on desktop. The
            Notifications / You tabs take over the whole panel, as they do on Discord. */}
        <Show
          when={mobile() && mobileTab() !== 'home'}
          fallback={
            <>
              <SpaceBar />
              <Show when={isSpaceRoute()} fallback={<RoomsBar />}>
                <SpaceRoomsBar />
              </Show>
            </>
          }
        >
          <Show when={mobileTab() === 'notifications'} fallback={<MobileYouPanel />}>
            <MobileNotificationsPanel />
          </Show>
        </Show>

        <main
          class={`relative flex min-h-0 flex-col overflow-hidden ${appShellCanvas} ${
            mobile() ? 'w-screen shrink-0' : 'min-w-0 flex-1'
          }`}
        >
          <div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{props.children}</div>
          {/* Below md there is no sidebar dock, so the voice panel floats over the page. */}
          <VoiceDock variant="mobile" />
        </main>
      </div>

      <MobileTabBar progress={progress()} dragging={swiping()} />
      <ContextMenu />
      <VoiceUserMenu />
      <VoiceStatsPopover />
      <ScreenShareDialog />
      <UserProfilePopover />
      <UserProfileFullModal />
      <IncomingCallModal />
      <ReportDialog />
    </div>
  );
};
