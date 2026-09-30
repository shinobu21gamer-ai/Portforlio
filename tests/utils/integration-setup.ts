// Integration test setup - runs before integration tests
import { vi } from 'vitest';
import { setupTestDB, teardownTestDB } from '../utils/db-helper';

let testDB: any;

beforeAll(async () => {
  testDB = await setupTestDB();
  // Make testDB globally available for tests
  (global as any).testDB = testDB;
});

afterAll(async () => {
  await teardownTestDB();
});

// Clean up between tests
afterEach(async () => {
  if (testDB) {
    // Clear all tables but keep schema
    const models = Object.values(testDB.models);
    for (const model of models) {
      if (model.truncate) {
        await model.truncate({ cascade: true, restartIdentity: true });
      }
    }
  }
});

vi.setConfig({ testTimeout: 30000 });