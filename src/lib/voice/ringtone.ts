/**
 * Synthesised ringtone for incoming calls - two soft tones, twice a second, repeating.
 * Web Audio so nothing has to be downloaded; the AudioContext may stay suspended until
 * the page has had a gesture, in which case the visual prompt still shows.
 */

import { notificationPrefs } from '../../stores/notificationPrefs';

let ctx: AudioContext | null = null;
let timer = 0;
let master: GainNode | null = null;

function ring(at: number) {
  if (!ctx || !master) return;
  const note = (freq: number, start: number, dur: number) => {
    const osc = ctx!.createOscillator();
    const g = ctx!.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(1, start + 0.02);
    g.gain.setValueAtTime(1, start + dur - 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(g);
    g.connect(master!);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  };
  note(523.25, at, 0.35);
  note(659.25, at + 0.4, 0.35);
}

export function playRingtone(): void {
  stopRingtone();
  const volume = notificationPrefs.sounds ? notificationPrefs.volume : 0;
  if (volume <= 0 || typeof window === 'undefined') return;
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  try {
    ctx ??= new Ctx();
    if (ctx.state === 'suspended') void ctx.resume();
    master = ctx.createGain();
    master.gain.value = 0.15 * volume;
    master.connect(ctx.destination);
    const tick = () => ring(ctx!.currentTime + 0.05);
    tick();
    timer = window.setInterval(tick, 2000);
  } catch {
    /* ignore */
  }
}

export function stopRingtone(): void {
  window.clearInterval(timer);
  timer = 0;
  if (master) {
    try {
      master.disconnect();
    } catch {
      /* ignore */
    }
    master = null;
  }
}
