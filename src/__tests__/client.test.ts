// The script URL below is an explicit navigation rejection test.
/* eslint-disable no-script-url */
import {client, isGatewayURL, parseResult, safeError} from '../client';
import NativeTailscale from '../native/NativeTailscale';

test('passes normalized setup to native and surfaces native errors', async () => {
  const start = NativeTailscale.start as jest.Mock;
  start.mockResolvedValue('{"state":"NeedsLogin","ips":[]}');
  await expect(
    client.start(' http://nas:8096 ', ' tv ', ' secret '),
  ).resolves.toMatchObject({state: 'NeedsLogin'});
  expect(JSON.parse(start.mock.calls[0][0])).toEqual({
    serverUrl: 'http://nas:8096',
    hostname: 'tv',
    authKey: 'secret',
  });
  start.mockResolvedValue('{"error":"server is unreachable"}');
  await expect(client.start()).rejects.toThrow('server is unreachable');
});

test.each([
  'http://127.0.0.1:18765/web/index.html',
  'http://127.0.0.1:18765/_jellyvega/open?token=test',
])('allows gateway navigation: %s', url => {
  expect(isGatewayURL(url)).toBe(true);
});

test.each([
  'http://127.0.0.1:18765.evil.test/',
  'http://127.0.0.1:18765@evil.test/',
  'https://example.com/',
  'javascript:alert(1)',
  'file:///pkg/config',
  'http://127.0.0.1:18766/',
])('blocks navigation outside the gateway: %s', url => {
  expect(isGatewayURL(url)).toBe(false);
});

test('does not put auth keys in errors', () => {
  expect(safeError(new Error('Failed tskey-auth-abc123-def456'))).toBe(
    'Failed [redacted]',
  );
  expect(() => parseResult('{')).toThrow();
});
