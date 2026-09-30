import { setupTestDB, teardownTestDB, seedTestData } from './db-helper';

let testDb: any;

beforeAll(async () => {
  testDb = await setupTestDB();
  await seedTestData(testDb);
}, 60000);

afterAll(async () => {
  await teardownTestDB();
}, 30000);

export { testDb };