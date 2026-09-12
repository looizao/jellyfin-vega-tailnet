export type ConnectionPhase =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'stopping'
  | 'error';

export interface ProxyDetails {
  address: string;
  username: string;
  password: string;
}

export interface TailVegaSnapshot {
  phase: ConnectionPhase;
  backendState: string;
  hostname: string;
  dnsName: string;
  tailnet: string;
  ips: string[];
  onlinePeers: number;
  proxy: ProxyDetails | null;
  error: string | null;
}

export interface ProbeResult {
  ok: boolean;
  address: string;
  latencyMs: number;
}
