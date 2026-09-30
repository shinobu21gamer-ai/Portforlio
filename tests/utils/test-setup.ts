beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-for-ci-only-32chars!!';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-ci-only-32chars';
  process.env.DB_DIALECT = 'sqlite';
  process.env.DB_STORAGE = ':memory:';
});

vi.clearAllMocks();