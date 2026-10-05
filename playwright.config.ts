import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5000';

export default defineConfig({
  testDir: './tests/e2e/specs',
  // All projects share the one sqlite :memory: app started below. Keep the
  // transaction flows serial: each test explicitly restores its demo stock and
  // can then make an exact 48 -> 47 assertion instead of racing another browser.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/e2e-results.json' }],
    ['junit', { outputFile: 'test-results/e2e-results.xml' }],
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'npm run start:test',
    url: `${baseURL}/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NODE_ENV: 'test',
      AUTO_SETUP: 'true',
      EMAIL_DISABLED: 'true',
      ALLOW_PUBLIC_REGISTRATION: 'false',
      APP_TIMEZONE: 'Asia/Manila',
      JWT_SECRET: 'test-jwt-secret-for-ci-only-32chars!!',
      JWT_REFRESH_SECRET: 'test-refresh-secret-for-ci-only-32chars',
      DB_DIALECT: 'sqlite',
      DB_STORAGE: ':memory:',
    },
  },
});
