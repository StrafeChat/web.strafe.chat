/**
 * What this device reports the user is playing (desktop app, main window only).
 *
 * The shell recognises the game and says what to share - after the person's hides and renames,
 * and only while sharing is on for the account signed in now (it is off until they turn it on in
 * Settings > Activity). This module forwards that to the gateway as `op 9`, on this socket only:
 * the instance keeps it in its short-lived cache and drops it when the socket goes.
 *
 * It sends nothing while:
 * - the instance does not take activities (`features.activities` on GET /),
 * - our own status is invisible (a clear goes out on the switch, and the game again on the
 *   way back; the status menu applies either only once the server has it, so the gateway
 *   never fans this out with the old status). Only invisible: an unknown or "offline" own
 *   status is this client not knowing yet, and the server strips the activity from what
 *   others see while we look offline anyway,
 * - this page is not the desktop account the shell has signed in - the accounts file's
 *   active account and the one the shell's state is for must both be this page's own, and
 *   an account switch stops it at once (around a switch the shell already shares for the
 *   next account, and passing that on here would link the two),
 * - sharing is off for this account.
 *
 * Started once, from installAppWideIndicators() in desktop/boot.ts - never from a popup, which
 * runs the whole client with its own socket, and never on mobile (that boot is overridden).
 * Nothing else imports it. There is no logout hook: signing out closes the socket, and the
 * server forgets the report with it.
 */

import { createEffect, createMemo, createRoot, createSignal, on, untrack } from 'solid-js';
import { stargate } from './stargate';
import { instance } from './instance';
import { auth } from './auth';
import { selfStatus } from './presence';
import { sendActivity } from '../services/stargate/client';
import { activeDesktopAccountId, desktopAccountsSaved, desktopAccountSwitching, pageDesktopAccountId } from '../desktop/accounts';
import { gamesAvailable, gamesGetState, onActivityChanged, type GameActivity } from '../desktop/native';
import { cleanActivityName } from '../lib/activity';

let started = false;

function sameGame(a: GameActivity | null | undefined, b: GameActivity | null | undefined): boolean {
  if (!a || !b) return !a && !b;
  return a.name === b.name && a.started_at === b.started_at;
}

/** The shell's value, made safe to send (the server cleans it again). */
function cleanGame(v: GameActivity | null): GameActivity | null {
  if (!v) return null;
  const name = cleanActivityName(v.name);
  return name ? { name, started_at: v.started_at } : null;
}

export function startActivityReporting(): void {
  if (started) return;
  started = true;
  void gamesAvailable()
    .then((ok) => {
      if (ok) install();
    })
    .catch(() => undefined);
}

function install(): void {
  createRoot(() => {
    // What the shell says to share now, and whether sharing is on for the account signed in.
    // Events are not buffered, so the state is pulled at start and after every READY too.
    const [detected, setDetected] = createSignal<GameActivity | null>(null, { equals: sameGame });
    const [share, setShare] = createSignal(false);
    // The account the shell's `share` and game are for (its own idea of who is signed in).
    const [shellAccount, setShellAccount] = createSignal<string | null>(null);
    // Bumped by every event, so a pull that an event overtook does not undo it; and only the
    // newest pull's answer counts.
    let eventSeq = 0;
    let pullSeq = 0;

    const pull = () => {
      const events = eventSeq;
      const mine = ++pullSeq;
      void gamesGetState()
        .then((s) => {
          if (mine !== pullSeq) return;
          setShare(s.share);
          setShellAccount(s.account);
          if (events !== eventSeq) return;
          setDetected(s.share && s.current ? cleanGame({ name: s.current.name, started_at: s.current.started_at }) : null);
        })
        .catch(() => undefined);
    };

    void onActivityChanged((a) => {
      eventSeq += 1;
      setDetected(cleanGame(a));
      // A game while we believe sharing is off, or is for another account: it was just
      // turned on (in Settings, or for this account), or the shell has moved to another
      // account - ask the shell rather than assume, so nothing goes out for an account that
      // is not listed or is not this page's.
      if (a && (!untrack(share) || untrack(shellAccount) !== untrack(pageDesktopAccountId))) pull();
    }).catch((e) => console.warn('[activity] could not follow the shell', e));

    pull();

    // The active account changed (signed in, or the file caught up with this page): the shell
    // hears of it from the save, so ask again once that is written.
    createEffect(
      on(
        activeDesktopAccountId,
        () => {
          queueMicrotask(() => void desktopAccountsSaved().then(pull));
        },
        { defer: true },
      ),
    );

    const wanted = createMemo<GameActivity | null>(
      () => {
        if (!instance.activitiesEnabled) return null;
        if (!auth.user || desktopAccountSwitching()) return null;
        const me = pageDesktopAccountId();
        if (!me || activeDesktopAccountId() !== me || shellAccount() !== me) return null;
        if (!share()) return null;
        if (selfStatus() === 'invisible') return null;
        return detected();
      },
      null,
      { equals: sameGame },
    );

    // What this socket has been told: undefined = nothing yet (a new socket holds no report).
    let sent: GameActivity | null | undefined;

    createEffect(
      on(
        () => stargate.ready,
        (ready) => {
          if (!ready) {
            sent = undefined;
            return;
          }
          pull();
        },
      ),
    );

    // READY flips `ready` before its payload is applied (our own status among it), so the
    // decision waits for the end of the task that changed something: it then sees the
    // status READY brought, not the one from before the reconnect.
    let queued = false;
    const flush = () => {
      queued = false;
      if (!stargate.ready) return;
      const want = wanted();
      if (sent === undefined && want === null) {
        sent = null;
        return;
      }
      if (sent !== undefined && sameGame(sent, want)) return;
      const ok = sendActivity(want ? [{ type: 'playing', name: want.name, ...(want.started_at ? { started_at: want.started_at } : {}) }] : null);
      if (ok) sent = want;
    };
    createEffect(() => {
      void stargate.ready;
      void wanted();
      if (queued) return;
      queued = true;
      queueMicrotask(() => untrack(flush));
    });
  });
}
