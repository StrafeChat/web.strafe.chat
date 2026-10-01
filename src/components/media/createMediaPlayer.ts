import { createSignal, onCleanup } from 'solid-js';
import { claimPlayback, preferredVolume, releasePlayback, rememberVolume } from '../../stores/mediaPlayback';
import { PLAYBACK_RATES } from './format';

/**
 * Reactive wrapper around an HTMLMediaElement. The element is the source of truth; this
 * mirrors its state into signals (updated from its events, plus an animation-frame loop
 * for smooth time while playing) and exposes the handful of actions the players need.
 * Works for <video> and <audio> alike.
 */
export interface MediaPlayer {
  attach: (el: HTMLMediaElement) => void;
  playing: () => boolean;
  ended: () => boolean;
  /** True while the browser is stalled waiting for data (show a spinner). */
  waiting: () => boolean;
  /** True once metadata is known and the element is ready to play. */
  ready: () => boolean;
  failed: () => boolean;
  currentTime: () => number;
  duration: () => number;
  /** End of the buffered range containing the playhead, in seconds. */
  buffered: () => number;
  volume: () => number;
  muted: () => boolean;
  rate: () => number;
  play: () => Promise<void>;
  pause: () => void;
  toggle: () => void;
  seek: (seconds: number) => void;
  seekBy: (delta: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  setRate: (r: number) => void;
  cycleRate: () => void;
}

export function createMediaPlayer(): MediaPlayer {
  let el: HTMLMediaElement | undefined;
  const [playing, setPlaying] = createSignal(false);
  const [ended, setEnded] = createSignal(false);
  const [waiting, setWaiting] = createSignal(false);
  const [ready, setReady] = createSignal(false);
  const [failed, setFailed] = createSignal(false);
  const [currentTime, setCurrentTime] = createSignal(0);
  const [duration, setDuration] = createSignal(0);
  const [buffered, setBuffered] = createSignal(0);
  const [volume, setVolumeSignal] = createSignal(preferredVolume().volume);
  const [muted, setMutedSignal] = createSignal(preferredVolume().muted);
  const [rate, setRateSignal] = createSignal(1);

  let raf = 0;
  let detach: (() => void) | null = null;

  function readBuffered() {
    if (!el) return;
    const t = el.currentTime;
    const ranges = el.buffered;
    let end = 0;
    for (let i = 0; i < ranges.length; i++) {
      if (ranges.start(i) <= t && t <= ranges.end(i)) {
        end = ranges.end(i);
        break;
      }
      if (ranges.end(i) > end && ranges.start(i) <= t) end = ranges.end(i);
    }
    setBuffered(end);
  }

  // Chrome's MediaRecorder writes WebM with no duration header, so a recorded voice clip
  // reports duration = Infinity until the browser has scanned the file - which left the
  // player stuck on "0:00 / 0:00" with no progress for every clip recorded in Chrome.
  // Seeking to an absurd time forces that scan; the browser then fires durationchange with
  // the real value, and the seek is undone. Set while that probe is in flight.
  let probingDuration = false;

  function readDuration() {
    if (!el) return;
    const d = el.duration;
    if (!Number.isFinite(d)) {
      setDuration(0);
      return;
    }
    setDuration(d);
    if (probingDuration) {
      probingDuration = false;
      el.currentTime = 0;
    }
  }

  function tick() {
    if (!el) return;
    setCurrentTime(el.currentTime);
    if (!el.paused && !el.ended) raf = requestAnimationFrame(tick);
    else raf = 0;
  }

  function startTicking() {
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function stopTicking() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function attach(next: HTMLMediaElement) {
    detach?.();
    el = next;
    // Every clip opens at the level the user last set, muted state included.
    el.volume = volume();
    el.muted = muted();
    el.playbackRate = rate();
    setReady(el.readyState >= 1);
    readDuration();
    const on = <K extends keyof HTMLMediaElementEventMap>(type: K, fn: () => void) => {
      next.addEventListener(type, fn);
      return () => next.removeEventListener(type, fn);
    };
    const offs = [
      on('play', () => {
        setPlaying(true);
        setEnded(false);
        claimPlayback(next);
        startTicking();
      }),
      on('pause', () => {
        setPlaying(false);
        stopTicking();
        setCurrentTime(next.currentTime);
      }),
      on('ended', () => {
        setEnded(true);
        setPlaying(false);
        stopTicking();
        setCurrentTime(next.currentTime);
      }),
      on('timeupdate', () => {
        if (!raf) setCurrentTime(next.currentTime);
      }),
      // Ignore the duration probe's own jump to 1e101, or the time readout would flash a
      // nonsense number for the frame before durationchange undoes it.
      on('seeking', () => {
        if (!probingDuration) setCurrentTime(next.currentTime);
      }),
      on('durationchange', readDuration),
      on('loadedmetadata', () => {
        readDuration();
        if (!Number.isFinite(next.duration) && !probingDuration) {
          probingDuration = true;
          next.currentTime = 1e101;
        }
        setReady(true);
      }),
      on('canplay', () => {
        setReady(true);
        setWaiting(false);
      }),
      on('progress', readBuffered),
      on('waiting', () => setWaiting(true)),
      on('playing', () => setWaiting(false)),
      on('stalled', () => setWaiting(true)),
      on('volumechange', () => {
        setVolumeSignal(next.volume);
        setMutedSignal(next.muted);
      }),
      on('ratechange', () => setRateSignal(next.playbackRate)),
      on('error', () => {
        setFailed(true);
        setWaiting(false);
      }),
    ];
    detach = () => {
      for (const off of offs) off();
      stopTicking();
      releasePlayback(next);
      detach = null;
    };
  }

  onCleanup(() => detach?.());

  async function play() {
    if (!el) return;
    if (el.ended) el.currentTime = 0;
    try {
      await el.play();
    } catch {
      // Autoplay policy or an aborted load; the paused state is already reflected.
    }
  }

  function pause() {
    el?.pause();
  }

  function seek(seconds: number) {
    if (!el) return;
    const d = duration();
    const t = Math.max(0, d > 0 ? Math.min(seconds, d) : seconds);
    el.currentTime = t;
    setCurrentTime(t);
    if (ended() && t < d) setEnded(false);
  }

  function setVolume(v: number) {
    if (!el) return;
    const clamped = Math.min(1, Math.max(0, v));
    el.volume = clamped;
    if (clamped > 0 && el.muted) el.muted = false;
    rememberVolume(clamped, el.muted);
  }

  function toggleMute() {
    if (!el) return;
    el.muted = !el.muted;
    if (!el.muted && el.volume === 0) el.volume = 0.5;
    rememberVolume(el.volume, el.muted);
  }

  function setRate(r: number) {
    if (!el) return;
    el.playbackRate = r;
  }

  return {
    attach,
    playing,
    ended,
    waiting,
    ready,
    failed,
    currentTime,
    duration,
    buffered,
    volume,
    muted,
    rate,
    play,
    pause,
    toggle: () => {
      if (!el) return;
      if (el.paused || el.ended) void play();
      else pause();
    },
    seek,
    seekBy: (delta) => seek(currentTime() + delta),
    setVolume,
    toggleMute,
    setRate,
    cycleRate: () => {
      const idx = PLAYBACK_RATES.indexOf(rate() as (typeof PLAYBACK_RATES)[number]);
      setRate(PLAYBACK_RATES[(idx + 1) % PLAYBACK_RATES.length]!);
    },
  };
}
