import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:60824',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 5'] } },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_SERVER ? undefined : {
    command: 'npm run start',
    // The page probe keeps the test server boot independent from database
    // readiness; individual API tests still verify authorization and errors.
    url: 'http://127.0.0.1:60824/',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
