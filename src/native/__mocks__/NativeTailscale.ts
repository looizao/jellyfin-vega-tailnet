const NativeTailscale = {
  connect: jest.fn(async () =>
    JSON.stringify({backendState: 'Running', tailscaleIPs: ['100.64.0.2']}),
  ),
  status: jest.fn(async () =>
    JSON.stringify({backendState: 'Stopped', tailscaleIPs: []}),
  ),
  disconnect: jest.fn(async () => true),
  probe: jest.fn(async (address: string) =>
    JSON.stringify({ok: true, address, latencyMs: 12}),
  ),
  engineVersion: jest.fn(() => 'test'),
};

export default NativeTailscale;
