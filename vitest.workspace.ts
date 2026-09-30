import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    test: {
      name: 'unit',
      environment: 'node',
      include: ['tests/unit/**/*.test.ts'],
      exclude: ['node_modules/**', 'dist/**'],
      globals: true,
      setupFiles: ['./tests/utils/test-setup.ts'],
      testTimeout: 15000,
      hookTimeout: 15000,
      pool: 'forks',
      singleFork: true,
    },
  },
  {
    test: {
      name: 'integration',
      environment: 'node',
      include: ['tests/integration/**/*.test.ts'],
      exclude: ['node_modules/**', 'dist/**'],
      globals: true,
      setupFiles: ['./tests/utils/integration-setup.ts'],
      testTimeout: 30000,
      hookTimeout: 30000,
      pool: 'forks',
      singleFork: true,
    },
  },
]);