import {parseNativeStatus} from '../tailscaleClient';

describe('parseNativeStatus', () => {
  it('maps a running libtailscale status and proxy details', () => {
    const snapshot = parseNativeStatus(
      JSON.stringify({
        status: {
          BackendState: 'Running',
          Self: {
            HostName: 'fire-tv-hd',
            DNSName: 'fire-tv-hd.example.ts.net.',
            TailscaleIPs: ['100.70.1.2', 'fd7a:115c:a1e0::1'],
          },
          CurrentTailnet: {Name: 'example.com'},
          Peer: {one: {Online: true}, two: {Online: false}},
        },
        proxy: {
          address: '127.0.0.1:4444',
          username: 'tsnet',
          password: 'secret',
        },
      }),
    );

    expect(snapshot).toMatchObject({
      phase: 'connected',
      backendState: 'Running',
      hostname: 'fire-tv-hd',
      dnsName: 'fire-tv-hd.example.ts.net',
      tailnet: 'example.com',
      ips: ['100.70.1.2', 'fd7a:115c:a1e0::1'],
      onlinePeers: 1,
      proxy: {address: '127.0.0.1:4444'},
    });
  });

  it('handles a stopped bare status document', () => {
    expect(
      parseNativeStatus('{"BackendState":"Stopped","TailscaleIPs":[]}'),
    ).toMatchObject({phase: 'idle', backendState: 'Stopped', ips: []});
  });
});
