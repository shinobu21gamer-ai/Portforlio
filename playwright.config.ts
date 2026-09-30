import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e/specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never', outputFolder: 'tests/e2e/test-results/html-report' }],
    ['json', { outputFile: 'tests/e2e/test-results/results.json' }],
    ['junit', { outputFile: 'tests/e2e/test-results/results.xml' }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5000',
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
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'npm run start:test',
    url: 'http://localhost:5000/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      NODE_ENV: 'test',
      AUTO_SETUP: 'true',
      JWT_SECRET: 'test-jwt-secret-for-ci-only-32chars!!',
      JWT_REFRESH_SECRET: 'test-refresh-secret-for-ci-only-32chars',
      DB_DIALECT: 'sqlite',
      DB_STORAGE: ':memory:',
    },
  },
});