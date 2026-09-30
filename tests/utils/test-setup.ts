// Global test setup for Vitest
import { vi } from 'vitest';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-ci-only-32chars!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-ci-only-32chars';
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';
process.env.AUTO_SETUP = 'true';

// Global test timeout
vi.setConfig({ testTimeout: 15000 });