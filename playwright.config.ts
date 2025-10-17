// playwright.config.ts
// Purpose: Playwright configuration for running end-to-end tests against the Next.js app.

import { defineConfig } from 'playwright/test';

export default defineConfig({
  testDir: './tests/playwright',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100',
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_TELEMETRY_DISABLED: '1',
      NODE_ENV: 'test'
    }
  }
});
