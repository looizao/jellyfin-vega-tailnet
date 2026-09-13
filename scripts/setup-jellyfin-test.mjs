import {randomBytes} from 'node:crypto';
import {writeFile} from 'node:fs/promises';

const base = 'http://127.0.0.1:18096';
const password = randomBytes(24).toString('hex');
const username = 'jellyvega-test';
const auth =
  'MediaBrowser Client="JellyVega tests", Device="Chromium", DeviceId="jellyvega-ci", Version="0.1.0"';
let token;
async function api(path, body, method = 'POST') {
  let r;
  for (let attempt = 0; attempt < 60; attempt++) {
    r = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Connection: 'close',
        Authorization: auth + (token ? `, Token="${token}"` : ''),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (r.status !== 503) break;
    await r.body.cancel();
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (!r.ok)
    throw new Error(`${method} ${path.split('?')[0]} returned ${r.status}`);
  const text = await r.text();
  return text ? JSON.parse(text) : undefined;
}
for (let n = 0; n < 90; n++) {
  try {
    const readiness = await fetch(base + '/Startup/Configuration', {
      headers: {Connection: 'close'},
      signal: AbortSignal.timeout(5000),
    });
    await readiness.body.cancel();
    if (readiness.ok) break;
  } catch {}
  if (n === 89) throw new Error('Jellyfin did not start');
  await new Promise(r => setTimeout(r, 1000));
}
await api('/Startup/Configuration', {
  UICulture: 'en-US',
  MetadataCountryCode: 'US',
  PreferredMetadataLanguage: 'en',
});
await api('/Startup/User', undefined, 'GET');
await api('/Startup/User', {Name: username, Password: password});
await api('/Startup/RemoteAccess', {
  EnableRemoteAccess: true,
  EnableAutomaticPortMapping: false,
});
await api('/Startup/Complete');
const login = await api('/Users/AuthenticateByName', {
  Username: username,
  Pw: password,
});
token = login.AccessToken;
const serverInfo = await api('/System/Info/Public', undefined, 'GET');
console.log(`Test server: ${serverInfo.ProductName} ${serverInfo.Version}`);
await api(
  '/Library/VirtualFolders?name=Test%20Movies&collectionType=movies&refreshLibrary=true',
  {
    LibraryOptions: {
      PathInfos: [{Path: '/media'}],
      EnableRealtimeMonitor: false,
      EnableInternetProviders: false,
      TypeOptions: [{Type: 'Movie', MetadataFetchers: [], ImageFetchers: []}],
    },
  },
);
for (let n = 0; n < 60; n++) {
  const items = await api(
    `/Items?Recursive=true&IncludeItemTypes=Movie&UserId=${login.User.Id}`,
    undefined,
    'GET',
  );
  if (items.Items.length) {
    await writeFile(
      '.cache/browser-login.json',
      JSON.stringify({username, password, itemId: items.Items[0].Id}),
      {mode: 0o600},
    );
    console.log(
      'Disposable Jellyfin server and synthetic H.264/AAC test movie are ready.',
    );
    break;
  }
  if (n === 59) throw new Error('Jellyfin did not index the test movie');
  await new Promise(r => setTimeout(r, 1000));
}
