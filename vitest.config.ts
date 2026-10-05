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
      // Phase-6 ratchet. The full unit + integration suite measures
      // 80.53% statements / 64.14% branches / 89.03% functions / 85.05%
      // lines (2026-10-05); leave a modest buffer for platform differences
      // while preventing a meaningful coverage regression.
      thresholds: {
        statements: 78,
        branches: 62,
        functions: 85,
        lines: 82,
      },
    },
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
    },
  },
});