import { defineConfig } from '@playwright/test';
import { urls } from './support/environment';

/**
 * End-to-end runs against the whole system on this machine: the backend's `./deploy/dev.ps1 up -App` and
 * `seed`, and the web app's production build, which this config starts on its port unless one is already
 * there. Not part of CI (it needs the system); see the project's CLAUDE.md.
 */
export default defineConfig({
  testDir: './tests',
  // The flows build on each other within a file and share one gateway's rate limits.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 5 * 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './support/global-setup.ts',
  use: {
    baseURL: urls.web,
    // Installed Chrome, not Playwright's Chromium: the player needs H.264, which only branded builds decode.
    channel: 'chrome',
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'corepack pnpm --filter @netboxplus/web build && corepack pnpm --filter @netboxplus/web start',
    cwd: '../..',
    url: `${urls.web}/tr`,
    reuseExistingServer: true,
    timeout: 5 * 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
