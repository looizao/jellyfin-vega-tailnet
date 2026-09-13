import fs from 'fs';
import path from 'path';
import vm from 'vm';

function storage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k),
    setItem: (k: string, v: string) => data.set(k, v),
    clear: () => data.clear(),
  };
}

test('sets TV layout, preserves sign-in on relaunch, and clears it when servers change', () => {
  const localStorage = storage();
  const sessionStorage = storage();
  const addEventListener = jest.fn();
  const postMessage = jest.fn();
  const context = {
    localStorage,
    sessionStorage,
    document: {addEventListener},
    window: {ReactNativeWebView: {postMessage}},
  };
  const script = fs.readFileSync(
    path.join(__dirname, '../../native/gateway/adapter.js'),
    'utf8',
  );
  function run(server: string) {
    vm.runInNewContext(
      script.replace('__SERVER_URL__', JSON.stringify(server)),
      context,
    );
  }
  run('http://nas:8096');
  expect(localStorage.getItem('layout')).toBe('tv');
  localStorage.setItem('jellyfin_credentials', 'private');
  run('http://nas:8096');
  expect(localStorage.getItem('jellyfin_credentials')).toBe('private');
  run('http://different:8096');
  expect(localStorage.getItem('jellyfin_credentials')).toBeUndefined();
  const event = {
    keyCode: 82,
    preventDefault: jest.fn(),
    stopImmediatePropagation: jest.fn(),
  };
  addEventListener.mock.calls[0][1](event);
  expect(postMessage).toHaveBeenCalledWith('jellyvega.settings');
  expect(event.preventDefault).toHaveBeenCalled();
  postMessage.mockClear();
  const letter = {...event, key: 'r', target: {tagName: 'INPUT'}};
  addEventListener.mock.calls[0][1](letter);
  expect(postMessage).not.toHaveBeenCalled();
  addEventListener.mock.calls[0][1]({
    ...letter,
    key: 'ContextMenu',
    keyCode: 93,
  });
  expect(postMessage).toHaveBeenCalledWith('jellyvega.settings');
});
