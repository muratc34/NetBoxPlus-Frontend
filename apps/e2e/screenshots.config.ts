import { defineConfig } from '@playwright/test';
import { urls } from './support/environment';

/**
 * The README's screenshots and demo GIF (pnpm e2e:screenshots), taken from the running system: the
 * backend's `./deploy/dev.ps1 up -App` with a filled catalog, the admin panel on its port and the web
 * app's production build. Written to the repository's docs/screenshots; run again when the interface
 * changes. Kept apart from the flows: it needs no Stripe or Mailpit and changes nothing but its own
 * account's profiles and list.
 */
export default defineConfig({
  testDir: './screenshots',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 5 * 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  globalSetup: './support/screenshots-setup.ts',
  use: {
    baseURL: urls.web,
    channel: 'chrome',
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
    colorScheme: 'dark',
    // Trailers and card previews stay still, so a shot shows the page, not a frame of a test pattern.
    reducedMotion: 'reduce',
    viewport: { width: 1440, height: 900 },
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
