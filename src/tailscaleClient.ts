import NativeTailscale from './native/NativeTailscale';
import type {ProbeResult, ProxyDetails, TailVegaSnapshot} from './types';

interface NativePeer {
  Online?: boolean;
}

interface NativeStatus {
  BackendState?: string;
  TailscaleIPs?: string[];
  Self?: {
    HostName?: string;
    DNSName?: string;
    TailscaleIPs?: string[];
  };
  CurrentTailnet?: {
    Name?: string;
    MagicDNSSuffix?: string;
  };
  Peer?: Record<string, NativePeer>;
}

interface NativePayload {
  status?: NativeStatus;
  proxy?: ProxyDetails;
}

const stoppedSnapshot: TailVegaSnapshot = {
  phase: 'idle',
  backendState: 'Stopped',
  hostname: '',
  dnsName: '',
  tailnet: '',
  ips: [],
  onlinePeers: 0,
  proxy: null,
  error: null,
};

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

export function parseNativeStatus(payload: string): TailVegaSnapshot {
  const parsed = JSON.parse(payload) as NativePayload & NativeStatus;
  const status = parsed.status ?? parsed;
  const backendState = status.BackendState ?? 'Unknown';
  const ips = stringArray(status.Self?.TailscaleIPs ?? status.TailscaleIPs);
  const peers = Object.values(status.Peer ?? {});

  return {
    ...stoppedSnapshot,
    phase: backendState === 'Running' ? 'connected' : 'idle',
    backendState,
    hostname: status.Self?.HostName ?? '',
    dnsName: (status.Self?.DNSName ?? '').replace(/\.$/, ''),
    tailnet:
      status.CurrentTailnet?.Name ??
      status.CurrentTailnet?.MagicDNSSuffix ??
      '',
    ips,
    onlinePeers: peers.filter(peer => peer.Online === true).length,
    proxy: parsed.proxy?.address && parsed.proxy.password ? parsed.proxy : null,
  };
}

function safeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === 'string' ? error : 'Unexpected Tailscale error';
}

export const tailscaleClient = {
  engineVersion(): string {
    return NativeTailscale.engineVersion();
  },

  async resume(hostname: string): Promise<TailVegaSnapshot> {
    try {
      return parseNativeStatus(await NativeTailscale.connect('', hostname));
    } catch {
      return stoppedSnapshot;
    }
  },

  async connect(authKey: string, hostname: string): Promise<TailVegaSnapshot> {
    try {
      return parseNativeStatus(
        await NativeTailscale.connect(authKey, hostname),
      );
    } catch (error) {
      return {...stoppedSnapshot, phase: 'error', error: safeError(error)};
    }
  },

  async refresh(): Promise<TailVegaSnapshot> {
    try {
      return parseNativeStatus(await NativeTailscale.status());
    } catch (error) {
      return {...stoppedSnapshot, phase: 'error', error: safeError(error)};
    }
  },

  async disconnect(): Promise<TailVegaSnapshot> {
    try {
      await NativeTailscale.disconnect();
      return stoppedSnapshot;
    } catch (error) {
      return {...stoppedSnapshot, phase: 'error', error: safeError(error)};
    }
  },

  async probe(address: string): Promise<ProbeResult> {
    return JSON.parse(await NativeTailscale.probe(address)) as ProbeResult;
  },
};
