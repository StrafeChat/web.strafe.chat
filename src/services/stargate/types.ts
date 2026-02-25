/**
 * Stargate service types
 * SharedWorker vs main-thread fallback handled by service
 */

export type StargateTransport = 'shared-worker' | 'main-thread';

export interface StargateConfig {
  url: string;
  token: string;
  onReady: (data: unknown) => void;
  onEvent: (event: { t: string; d: unknown }) => void;
  onStatus: (status: string) => void;
}
