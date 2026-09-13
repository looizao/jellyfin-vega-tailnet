import React from 'react';
import {act, create, ReactTestRenderer} from 'react-test-renderer';
import App from '../App';
import NativeTailscale from '../native/NativeTailscale';
import {stopped} from '../client';

jest.mock('../components/JellyfinView', () => ({JellyfinView: 'JellyfinView'}));

test('enrolls, clears the auth key, polls for approval, and probes before opening Jellyfin', async () => {
  jest.useFakeTimers();
  jest.resetAllMocks();
  const start = NativeTailscale.start as jest.Mock;
  const status = NativeTailscale.status as jest.Mock;
  const check = NativeTailscale.checkServer as jest.Mock;
  start.mockResolvedValueOnce(JSON.stringify(stopped));
  let app: ReactTestRenderer;
  await act(async () => {
    app = create(<App />);
  });
  const input = (label: string) =>
    app.root.findAllByProps({accessibilityLabel: label})[0];
  await act(async () => {
    input('Jellyfin server URL').props.onChangeText('http://nas:8096');
    input('Optional Tailscale auth key').props.onChangeText(
      'one-time-test-key',
    );
  });
  start.mockResolvedValueOnce(
    JSON.stringify({
      ...stopped,
      state: 'NeedsLogin',
      serverUrl: 'http://nas:8096',
      authUrl: 'https://login.tailscale.com/a/test',
    }),
  );
  await act(async () => {
    input('Connect to tailnet').props.onPress();
  });
  expect(JSON.parse(start.mock.calls[1][0]).authKey).toBe('one-time-test-key');
  expect(JSON.stringify(app!.toJSON())).not.toContain('one-time-test-key');
  expect(JSON.stringify(app!.toJSON())).toContain('Approve this TV');
  status.mockResolvedValue(
    JSON.stringify({
      ...stopped,
      state: 'Running',
      serverUrl: 'http://nas:8096',
      webUrl: 'http://127.0.0.1:18765/_jellyvega/open?token=test',
    }),
  );
  await act(async () => {
    jest.advanceTimersByTime(2000);
  });
  check.mockResolvedValue('{"error":"Jellyfin is unreachable"}');
  await act(async () => {
    input('Open Jellyfin').props.onPress();
  });
  expect(JSON.stringify(app!.toJSON())).toContain('Jellyfin is unreachable');
  check.mockResolvedValue('{"server":"Test Jellyfin"}');
  await act(async () => {
    input('Open Jellyfin').props.onPress();
  });
  expect(JSON.stringify(app!.toJSON())).toContain('JellyfinView');
  await act(async () => {
    app!.unmount();
  });
  jest.useRealTimers();
});
