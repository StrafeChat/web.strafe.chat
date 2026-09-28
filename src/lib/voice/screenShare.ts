/**
 * Screen share quality: what the picker offers and what those choices mean on the wire.
 *
 * The browser's own "choose what to share" dialog has no quality controls, so the choice
 * is made before it opens (see components/voice/ScreenShareDialog) and applied as capture
 * constraints plus a publish encoding - the constraint decides what is captured, the
 * encoding decides what LiveKit is allowed to spend sending it.
 */

import type { ScreenShareFps, ScreenShareResolution } from '../../stores/voiceSettings';
import type { ScreenShareCaptureOptions, VideoEncoding } from 'livekit-client';

/** Capture size for a named resolution. `source` caps nothing and takes what it is given. */
const HEIGHTS: Record<Exclude<ScreenShareResolution, 'source'>, { width: number; height: number }> = {
  '720': { width: 1280, height: 720 },
  '1080': { width: 1920, height: 1080 },
  '1440': { width: 2560, height: 1440 },
};

/**
 * Bitrate ceiling in bits per second, by resolution and frame rate. Roughly what Discord
 * spends at the same settings: enough that text stays legible while moving, low enough
 * that a normal uplink keeps up. `source` is unbounded in size, so it is budgeted as 1440.
 */
const BITRATES: Record<Exclude<ScreenShareResolution, 'source'>, Record<ScreenShareFps, number>> = {
  '720': { 15: 1_500_000, 30: 2_500_000, 60: 3_500_000 },
  '1080': { 15: 3_000_000, 30: 4_500_000, 60: 6_000_000 },
  '1440': { 15: 5_000_000, 30: 7_000_000, 60: 9_000_000 },
};

/** getDisplayMedia constraints for a chosen quality. */
export function screenShareCaptureOptions(
  resolution: ScreenShareResolution,
  fps: ScreenShareFps
): ScreenShareCaptureOptions {
  const size = resolution === 'source' ? undefined : HEIGHTS[resolution];
  return {
    audio: true,
    systemAudio: 'include',
    selfBrowserSurface: 'exclude',
    surfaceSwitching: 'include',
    // 'motion' keeps frames flowing for video and games; 'detail' holds text sharp at the
    // cost of frame rate, which is the right trade only when the user asked for 15fps.
    contentHint: fps <= 15 ? 'detail' : 'motion',
    ...(size ? { resolution: { ...size, frameRate: fps } } : { resolution: { width: 3840, height: 2160, frameRate: fps } }),
  };
}

/** Publish encoding for a chosen quality. */
export function screenShareEncoding(resolution: ScreenShareResolution, fps: ScreenShareFps): VideoEncoding {
  const key = resolution === 'source' ? '1440' : resolution;
  return { maxBitrate: BITRATES[key][fps], maxFramerate: fps };
}

/** Short label for the current quality, e.g. "1080p 60fps". */
export function screenShareQualityLabel(resolution: ScreenShareResolution, fps: ScreenShareFps): string {
  return `${resolution === 'source' ? 'Source' : `${resolution}p`} ${fps}fps`;
}
