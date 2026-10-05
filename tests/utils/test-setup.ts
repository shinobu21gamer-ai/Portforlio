// Test environment MUST be set at module top level — before ANY import in
// this file or the test files. src/config captures process.env values at
// require time, and a beforeAll here runs after the test file's module-level
// src requires have already cached a config (and a database connection).
// With env set in beforeAll, the unit suite silently connected to the real
// database.sqlite and its sync({ force: true }) wiped the dev database.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-ci-only-32chars!!';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-for-ci-only-32chars';
process.env.JWT_EXPIRES_IN = '1h';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';

import { beforeAll, vi } from 'vitest';

beforeAll(() => {
  vi.clearAllMocks();
});
