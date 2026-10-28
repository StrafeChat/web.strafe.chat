import type { Component } from 'solid-js';
import { createMemo, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { activityOf } from '../stores/presence';
import { formatActivityDuration, type Activity } from '../lib/activity';
import { appSectionLabel } from '../theme/appChrome';
import { currentLanguage, t } from '../i18n';

/** Stands in for the name while the sentence is translated, then marks where to cut it. */
const NAME_SLOT = '\u0000';

/**
 * A translated sentence with someone else's text in it - a game's name - kept apart from the
 * words around it. The sentence is translated as a whole (`sentence` gets a placeholder to put
 * where the name goes) and cut there, so each language keeps its own word order; the name
 * goes in a <bdi>, as plain text, so a right-to-left name cannot reorder the words around it.
 * Never markdown, emoji, mentions or a link.
 */
export const SentenceWithName: Component<{
  sentence: (name: string) => string;
  name: string;
  class?: string;
  nameClass?: string;
}> = (props) => {
  const parts = createMemo(() => {
    const s = props.sentence(NAME_SLOT);
    const at = s.indexOf(NAME_SLOT);
    return at < 0 ? { before: `${s} `, after: '' } : { before: s.slice(0, at), after: s.slice(at + NAME_SLOT.length) };
  });
  return (
    <span class={props.class}>
      {parts().before}
      <bdi class={props.nameClass}>{props.name}</bdi>
      {parts().after}
    </span>
  );
};

/** "Playing <name>" in the reader's language, the name in bold - the one-line form. */
export const PlayingText: Component<{ activity: Activity; class?: string; nameClass?: string }> = (props) => (
  <SentenceWithName
    sentence={(name) => t('activity.playing', { name })}
    name={props.activity.name}
    class={props.class}
    nameClass={props.nameClass ?? 'font-semibold'}
  />
);

/**
 * One clock for every activity card on screen, re-read every 15 s so "for 12 min" moves on
 * within the minute. It runs only while at least one card is mounted.
 */
const [now, setNow] = createSignal(Date.now());
let live = 0;
let timer: ReturnType<typeof setInterval> | undefined;

function useActivityClock(): void {
  onMount(() => {
    live += 1;
    if (timer === undefined) timer = setInterval(() => setNow(Date.now()), 15_000);
    setNow(Date.now());
    onCleanup(() => {
      live -= 1;
      if (live <= 0 && timer !== undefined) {
        clearInterval(timer);
        timer = undefined;
      }
    });
  });
}

const ActivityCard: Component<{ activity: Activity }> = (props) => {
  useActivityClock();
  const duration = createMemo(() => {
    const at = props.activity.started_at;
    if (!at) return '';
    return formatActivityDuration(now() - at, currentLanguage());
  });
  return (
    <div>
      <p class={`mb-1.5 ${appSectionLabel}`}>{t('activity.playingGame')}</p>
      <div class="flex items-center gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5">
        <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <i class="fa-solid fa-gamepad text-base" aria-hidden="true" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-semibold text-foreground" dir="auto">
            {props.activity.name}
          </p>
          <Show when={duration()}>
            <p class="mt-0.5 truncate text-xs text-muted-foreground">{t('activity.elapsed', { duration: duration() })}</p>
          </Show>
        </div>
      </div>
    </div>
  );
};

/**
 * The activity block on a profile (popover and full modal): what the person is playing and for
 * how long. Read live from the presence store by user id - the profile subject is a snapshot
 * taken when the card opened and would freeze both the game and the timer. Renders nothing
 * when they are not playing, or are offline or invisible.
 */
export const ProfileActivity: Component<{ userId: string | undefined; class?: string }> = (props) => {
  const activity = () => activityOf(props.userId);
  return (
    <Show when={activity()}>
      {(a) => (
        <div class={props.class}>
          <ActivityCard activity={a()} />
        </div>
      )}
    </Show>
  );
};
