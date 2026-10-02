beforeAll(() => {
  process.env.NODE_ENV = 'test';
  // Set JWT secrets before any imports to ensure config picks them up
  process.env.JWT_SECRET = 'test-jwt-secret-for-ci-only-32chars!!';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-ci-only-32chars';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.DB_DIALECT = 'sqlite';
  process.env.DB_STORAGE = ':memory:';
});

vi.clearAllMocks();