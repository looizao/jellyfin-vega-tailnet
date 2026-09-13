import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  timeout: 90000,
  reporter: [['list'], ['html', {open: 'never'}]],
  use: {
    viewport: {width: 1280, height: 720},
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
