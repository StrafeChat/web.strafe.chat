/**
 * Call transport statistics, read straight from WebRTC's getStats() on the tracks
 * LiveKit gave us: what the "voice statistics" popover shows, and the first thing to
 * look at when audio breaks up. Loss and concealment separate a network problem (packets
 * missing, the decoder filling gaps) from an acoustic one (everything arrives, it just
 * sounds bad - echo between two devices in one room, a suppressor eating speech).
 */

import { Track, type LocalTrackPublication, type RemoteTrackPublication, type Room } from 'livekit-client';

export interface AudioStreamStats {
  /** Packets lost, percent of those expected over the interval. */
  lossPct: number;
  jitterMs: number;
  /** Samples the decoder had to make up, percent of those played over the interval. */
  concealedPct: number;
  kbps: number;
}

export interface VideoStreamStats {
  width: number;
  height: number;
  fps: number;
  lossPct: number;
  kbps: number;
}

export interface ParticipantStats {
  identity: string;
  microphone?: AudioStreamStats;
  camera?: VideoStreamStats;
  screen?: VideoStreamStats;
}

export interface VoiceStatsSnapshot {
  at: number;
  /** How our media travels: udp / tcp, and whether through a relay (TURN). */
  transport?: { protocol: string; relay: boolean };
  rttMs?: number;
  /** What we send. */
  outbound?: { kbps: number; lossPct: number };
  participants: ParticipantStats[];
}

/** Raw counters kept between readings, keyed by track sid. */
export interface VoiceStatsSample {
  at: number;
  counters: Record<string, Counters>;
}

interface Counters {
  packetsReceived?: number;
  packetsLost?: number;
  concealedSamples?: number;
  totalSamplesReceived?: number;
  framesDecoded?: number;
  bytes?: number;
  packetsSent?: number;
}

type StatsRecord = Record<string, unknown>;

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function pct(part: number | undefined, whole: number | undefined): number {
  if (!part || !whole || whole <= 0) return 0;
  return Math.max(0, Math.min(100, (part / whole) * 100));
}

function delta(now: Counters, prev: Counters | undefined, key: keyof Counters): number | undefined {
  const a = now[key];
  if (a === undefined) return undefined;
  const b = prev?.[key];
  return b === undefined ? undefined : Math.max(0, a - b);
}

function inboundOf(report: RTCStatsReport, kind: 'audio' | 'video'): StatsRecord | undefined {
  for (const s of report.values()) {
    const r = s as StatsRecord;
    if (r.type === 'inbound-rtp' && r.kind === kind) return r;
  }
  return undefined;
}

/** The nominated candidate pair of a report, when the browser includes transport stats. */
function selectedPair(report: RTCStatsReport): { pair: StatsRecord; local?: StatsRecord } | undefined {
  let pair: StatsRecord | undefined;
  for (const s of report.values()) {
    const r = s as StatsRecord;
    if (r.type === 'transport' && typeof r.selectedCandidatePairId === 'string') {
      pair = report.get(r.selectedCandidatePairId) as StatsRecord | undefined;
      if (pair) break;
    }
  }
  if (!pair) {
    for (const s of report.values()) {
      const r = s as StatsRecord;
      if (r.type === 'candidate-pair' && r.nominated === true && r.state === 'succeeded') {
        pair = r;
        break;
      }
    }
  }
  if (!pair) return undefined;
  const local = typeof pair.localCandidateId === 'string' ? (report.get(pair.localCandidateId) as StatsRecord | undefined) : undefined;
  return { pair, local };
}

async function readInbound(
  pub: RemoteTrackPublication,
  prev: VoiceStatsSample | null,
  seconds: number,
  counters: Record<string, Counters>
): Promise<{ audio?: AudioStreamStats; video?: VideoStreamStats } | undefined> {
  const receiver = pub.track?.receiver;
  if (!receiver) return undefined;
  const report = await receiver.getStats();
  const kind = pub.kind === Track.Kind.Audio ? 'audio' : 'video';
  const r = inboundOf(report, kind);
  if (!r) return undefined;
  const now: Counters = {
    packetsReceived: num(r.packetsReceived),
    packetsLost: num(r.packetsLost),
    concealedSamples: num(r.concealedSamples),
    totalSamplesReceived: num(r.totalSamplesReceived),
    framesDecoded: num(r.framesDecoded),
    bytes: num(r.bytesReceived),
  };
  counters[pub.trackSid] = now;
  const before = prev?.counters[pub.trackSid];
  const lost = delta(now, before, 'packetsLost');
  const received = delta(now, before, 'packetsReceived');
  const kbps = seconds > 0 ? ((delta(now, before, 'bytes') ?? 0) * 8) / 1000 / seconds : 0;
  const lossPct = pct(lost, (lost ?? 0) + (received ?? 0));
  if (kind === 'audio') {
    return {
      audio: {
        lossPct,
        jitterMs: Math.round((num(r.jitter) ?? 0) * 1000),
        concealedPct: pct(delta(now, before, 'concealedSamples'), delta(now, before, 'totalSamplesReceived')),
        kbps: Math.round(kbps),
      },
    };
  }
  return {
    video: {
      width: num(r.frameWidth) ?? 0,
      height: num(r.frameHeight) ?? 0,
      fps: seconds > 0 ? Math.round((delta(now, before, 'framesDecoded') ?? 0) / seconds) : 0,
      lossPct,
      kbps: Math.round(kbps),
    },
  };
}

type LocalStats = Pick<VoiceStatsSnapshot, 'outbound' | 'rttMs' | 'transport'>;

async function readOutbound(
  pub: LocalTrackPublication | undefined,
  prev: VoiceStatsSample | null,
  seconds: number,
  counters: Record<string, Counters>
): Promise<LocalStats> {
  const sender = pub?.track?.sender;
  if (!sender || !pub) return {};
  const report = await sender.getStats();
  let outbound: StatsRecord | undefined;
  let remote: StatsRecord | undefined;
  for (const s of report.values()) {
    const r = s as StatsRecord;
    if (r.type === 'outbound-rtp') outbound = r;
    else if (r.type === 'remote-inbound-rtp') remote = r;
  }
  const out: LocalStats = {};
  if (outbound) {
    const now: Counters = { bytes: num(outbound.bytesSent), packetsSent: num(outbound.packetsSent), packetsLost: num(remote?.packetsLost) };
    counters[pub.trackSid] = now;
    const before = prev?.counters[pub.trackSid];
    const sent = delta(now, before, 'packetsSent');
    const lost = delta(now, before, 'packetsLost');
    out.outbound = {
      kbps: seconds > 0 ? Math.round(((delta(now, before, 'bytes') ?? 0) * 8) / 1000 / seconds) : 0,
      lossPct: pct(lost, sent),
    };
  }
  const rtt = num(remote?.roundTripTime);
  const pair = selectedPair(report);
  const pairRtt = num(pair?.pair.currentRoundTripTime);
  const bestRtt = rtt ?? pairRtt;
  if (bestRtt !== undefined) out.rttMs = Math.round(bestRtt * 1000);
  if (pair) {
    const protocol = typeof pair.local?.protocol === 'string' ? pair.local.protocol : '';
    out.transport = { protocol, relay: pair.local?.candidateType === 'relay' };
  }
  return out;
}

/** Read every track's stats once. `prev` is the previous reading, for rates. */
export async function sampleVoiceStats(
  room: Room,
  prev: VoiceStatsSample | null
): Promise<{ snapshot: VoiceStatsSnapshot; sample: VoiceStatsSample }> {
  const at = Date.now();
  const seconds = prev ? (at - prev.at) / 1000 : 0;
  const counters: Record<string, Counters> = {};
  const participants: ParticipantStats[] = [];
  for (const p of room.remoteParticipants.values()) {
    const entry: ParticipantStats = { identity: p.identity };
    for (const pub of p.trackPublications.values()) {
      const read = await readInbound(pub, prev, seconds, counters).catch(() => undefined);
      if (!read) continue;
      if (read.audio && pub.source === Track.Source.Microphone) entry.microphone = read.audio;
      else if (read.video && pub.source === Track.Source.ScreenShare) entry.screen = read.video;
      else if (read.video) entry.camera = read.video;
    }
    participants.push(entry);
  }
  const mic = room.localParticipant.getTrackPublication(Track.Source.Microphone);
  const local = await readOutbound(mic, prev, seconds, counters).catch(() => ({}));
  return {
    snapshot: { at, participants, ...local },
    sample: { at, counters },
  };
}
