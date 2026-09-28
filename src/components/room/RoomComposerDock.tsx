import type { Component, JSX } from 'solid-js';
import { onCleanup, onMount } from 'solid-js';
import { appComposerDock, appComposerDockFade, appComposerDockSurface } from '../../theme/appChrome';

export interface RoomComposerDockProps {
  children: JSX.Element;
  /**
   * Measured height of the dock in px, reported whenever it changes. The page feeds this
   * back as the `--composer-height` custom property on the shared positioning parent, which
   * is what lets the message list pad itself out from under the bar.
   */
  onHeightChange: (px: number) => void;
}

/**
 * Floats the composer over the bottom of the message list, frosted, so messages scroll
 * underneath it instead of stopping at a hard edge.
 *
 * The height has to be measured rather than assumed: the box grows with the draft, the
 * attachment tray, the reply strip and the typing row, and the list's bottom padding has to
 * track all of that or the newest message ends up hidden behind the bar.
 */
export const RoomComposerDock: Component<RoomComposerDockProps> = (props) => {
  let el: HTMLDivElement | undefined;
  const report = () => props.onHeightChange(el?.offsetHeight ?? 0);

  onMount(() => {
    // Measure once directly: a ResizeObserver only delivers on a rendered frame, and a tab
    // opened in the background produces none - the list would sit under the bar until the
    // tab was first shown.
    report();
    // Then observe, because the height changes for reasons the page never sees: a wrapped
    // line, the attachment tray, the reply strip, an image thumbnail finishing layout.
    const ro = new ResizeObserver(report);
    if (el) ro.observe(el);
    document.addEventListener('visibilitychange', report);
    onCleanup(() => {
      ro.disconnect();
      document.removeEventListener('visibilitychange', report);
    });
  });

  return (
    <div class={appComposerDock} ref={(node) => (el = node)}>
      <div class={appComposerDockFade} aria-hidden="true" />
      <div class={appComposerDockSurface}>{props.children}</div>
    </div>
  );
};
