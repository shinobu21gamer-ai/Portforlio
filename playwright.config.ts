import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const e2eDb = path.resolve(__dirname, 'test-e2e.sqlite');

export default defineConfig({
  testDir: './tests/e2e/specs',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run start:test',
    url: 'http://127.0.0.1:5000/health',
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
    env: {
      NODE_ENV: 'test',
      AUTO_SETUP: 'true',
      JWT_SECRET: 'test-jwt-secret-for-ci-only-32chars!!',
      JWT_REFRESH_SECRET: 'test-refresh-secret-for-ci-only-32chars',
      DB_DIALECT: 'sqlite',
      DB_STORAGE: e2eDb,
      EMAIL_DISABLED: 'true',
      PORT: '5000',
    },
  },
});
