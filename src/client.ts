import NativeTailscale from './native/NativeTailscale';

export interface Snapshot {
  state: string;
  serverUrl: string;
  hostname: string;
  webUrl?: string;
  authUrl?: string;
  ips: string[];
  health?: string[];
}

export const stopped: Snapshot = {
  state: 'Stopped',
  serverUrl: '',
  hostname: 'jellyvega-fire-tv',
  ips: [],
};

export function parseResult<T>(raw: string): T {
  const data = JSON.parse(raw);
  if (data.error) {
    throw new Error(data.error);
  }
  return data as T;
}

export function isGatewayURL(url: string): boolean {
  return /^http:\/\/127\.0\.0\.1:18765\//.test(url);
}

export function safeError(error: unknown): string {
  // Enrollment keys must not survive in user-visible error text or test logs.
  const message =
    error instanceof Error ? error.message : 'Could not complete the request.';
  return message.replace(/tskey-[A-Za-z0-9_-]+/g, '[redacted]');
}

export const client = {
  async start(serverUrl = '', hostname = '', authKey = ''): Promise<Snapshot> {
    return parseResult(
      await NativeTailscale.start(
        JSON.stringify({
          serverUrl: serverUrl.trim(),
          hostname: hostname.trim(),
          authKey: authKey.trim(),
        }),
      ),
    );
  },
  async status(): Promise<Snapshot> {
    return parseResult(await NativeTailscale.status());
  },
  async stop(): Promise<void> {
    await NativeTailscale.stop();
  },
  async checkServer(): Promise<string> {
    return parseResult<{server: string}>(await NativeTailscale.checkServer())
      .server;
  },
};
