import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const e2eDb = path.resolve(__dirname, 'test-e2e.sqlite');
// Allows restricted environments to point Playwright at a compatible browser
// installed from a package/cache when the Playwright CDN is unreachable.
const chromiumLaunchOptions = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  ? {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: process.env.PLAYWRIGHT_CHROMIUM_ARGS
        ? JSON.parse(process.env.PLAYWRIGHT_CHROMIUM_ARGS)
        : ['--no-sandbox'],
    }
  : undefined;

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
    launchOptions: chromiumLaunchOptions,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: process.env.PLAYWRIGHT_DISABLE_VIDEO === '1' ? 'off' : 'retain-on-failure',
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
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')),
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
