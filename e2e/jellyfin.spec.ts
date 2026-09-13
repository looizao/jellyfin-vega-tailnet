import {test, expect} from '@playwright/test';
import fs from 'node:fs';

test('Jellyfin TV login, library, remote navigation, and video through an embedded tailnet', async ({
  page,
}) => {
  const {webUrl} = JSON.parse(
    fs.readFileSync('.cache/browser-ready.json', 'utf8'),
  );
  const login = JSON.parse(
    fs.readFileSync('.cache/browser-login.json', 'utf8'),
  );
  const externalRequests: string[] = [];
  const blockedRequests = new Map<string, string>();
  page.on('request', request => {
    if (
      /^https?:/.test(request.url()) &&
      !request.url().startsWith('http://127.0.0.1:18765/')
    )
      externalRequests.push(request.url().split('?')[0]);
  });
  page.on('requestfailed', request => {
    blockedRequests.set(request.url(), request.failure()?.errorText ?? '');
  });
  await page.goto(webUrl);
  await expect(page.locator('html')).toHaveClass(/layout-tv/);
  const username = page.getByRole('textbox', {name: 'User', exact: true});
  await username.waitFor({state: 'visible'});
  await page.screenshot({path: 'test-results/jellyfin-login.png'});
  await username.fill(login.username);
  await page.getByLabel('Password', {exact: true}).fill(login.password);
  await page.getByRole('button', {name: 'Sign In', exact: true}).click();
  await expect(
    page.getByRole('button', {name: 'Test Movies', exact: true}),
  ).toBeVisible({timeout: 30000});
  await page.keyboard.press('ArrowDown');
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe(
    'BODY',
  );
  await page.screenshot({path: 'test-results/jellyfin-library.png'});
  await page.getByRole('button', {name: 'JellyVega Test', exact: true}).click();
  await page.locator('.btnPlay').filter({visible: true}).first().click();
  await expect
    .poll(
      async () =>
        page
          .locator('video')
          .evaluateAll(videos =>
            videos.some(v => (v as HTMLVideoElement).currentTime > 1),
          ),
      {timeout: 30000},
    )
    .toBe(true);
  await page.locator('video').evaluateAll(videos => {
    const video = videos.find(
      v => !(v as HTMLVideoElement).paused,
    ) as HTMLVideoElement;
    if (video) video.currentTime = 7;
  });
  await expect
    .poll(
      async () =>
        page
          .locator('video')
          .evaluateAll(videos =>
            videos.some(v => (v as HTMLVideoElement).currentTime > 7),
          ),
      {timeout: 15000},
    )
    .toBe(true);
  await page.screenshot({path: 'test-results/jellyfin-playback.png'});
  // Jellyfin attempts to load Chromecast's sender SDK. CSP must block it before
  // network access; Playwright still emits a request event for that attempt.
  for (const url of externalRequests) {
    expect(blockedRequests.get(url)).toMatch(/csp/i);
  }
});
