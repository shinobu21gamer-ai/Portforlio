import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
    globals: true,
    setupFiles: ['./tests/utils/test-setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: 'forks',
    singleFork: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.js'],
      exclude: [
        'src/server.js',
        'src/docs/**',
        '**/__tests__/**',
        'src/config/**',
        'src/routes/**',
        'src/controllers/**',
      ],
      // Ratchet: these sit just under the measured floor so the gate fails only
      // on regression. Raise them as suites land (discount + helpers are at
      // 100%, models at 96%; the other ~40 service files are still 0%).
      // A global 50% is not reachable until those services are covered.
      thresholds: {
        lines: 65,
        functions: 68,
        branches: 50,
        statements: 68,
      },
    },
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
    },
  },
});