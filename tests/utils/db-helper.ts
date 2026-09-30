// Test Database Helper
// Sets up an in-memory SQLite database with migrations for testing

import { Sequelize } from 'sequelize';
import { Umzug, SequelizeStorage } from 'umzug';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let testSequelize: Sequelize | null = null;
let umzug: Umzug<any> | null = null;

/**
 * Initialize and return a test Sequelize instance with migrations applied
 */
export async function setupTestDB(): Promise<Sequelize> {
  if (testSequelize) {
    return testSequelize;
  }

  testSequelize = new Sequelize({
    dialect: 'sqlite',
    storage: ':memory:',
    logging: false,
    define: {
      timestamps: true,
      underscored: true,
      paranoid: true,
    },
    dialectOptions: {
      // Enable WAL mode for better concurrency
      pragma: {
        journal_mode: 'WAL',
        busy_timeout: 5000,
        synchronous: 'NORMAL',
      },
    },
  });

  // Load all models
  const modelsPath = path.join(__dirname, '../../src/models');
  const { readdirSync } = await import('fs');
  
  readdirSync(modelsPath)
    .filter((file: string) => file !== 'index.js' && file.endsWith('.js'))
    .forEach((file: string) => {
      const model = require(path.join(modelsPath, file))(testSequelize!, testSequelize!.DataTypes);
      // Model is registered in sequelize.models automatically
    });

  // Run associations
  Object.values(testSequelize.models).forEach((model: any) => {
    if (model.associate) {
      model.associate(testSequelize!.models);
    }
  });

  // Run migrations using Umzug
  umzug = new Umzug({
    migrations: {
      glob: path.join(__dirname, '../../../migrations/*.js'),
    },
    context: testSequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize: testSequelize }),
    logger: undefined,
  });

  await umzug.up();

  return testSequelize!;
}

/**
 * Close the test database connection
 */
export async function teardownTestDB(): Promise<void> {
  if (testSequelize) {
    await testSequelize.close();
    testSequelize = null;
    umzug = null;
  }
}

/**
 * Get the current test database instance
 */
export function getTestDB(): Sequelize | null {
  return testSequelize;
}

/**
 * Seed minimal test data for integration tests
 */
export async function seedTestData(db: Sequelize): Promise<{
  admin: any;
  cashier: any;
  category: any;
  product: any;
  employee: any;
  department: any;
  position: any;
}> {
  const { Role, User, Category, Product, Employee, Department, Position } = db.models;

  // Create roles
  const adminRole = await Role.create({ name: 'Admin', slug: 'admin', description: 'Full system access' });
  const cashierRole = await Role.create({ name: 'Cashier', slug: 'cashier', description: 'Point of sale operations' });
  const hrRole = await Role.create({ name: 'HR', slug: 'hr', description: 'Human resources management' });
  const employeeRole = await Role.create({ name: 'Employee', slug: 'employee', description: 'Basic employee access' });
  const inventoryRole = await Role.create({ name: 'Inventory Staff', slug: 'inventory_staff', description: 'Product, supplier, and stock management' });

  // Create users
  const bcrypt = (await import('bcryptjs')).default;
  const hashedPassword = await bcrypt.hash('password123', 10);

  const admin = await User.create({
    firstName: 'Test',
    lastName: 'Admin',
    email: 'admin@test.com',
    password: hashedPassword,
    roleId: adminRole.id,
    isActive: true,
  });

  const cashier = await User.create({
    firstName: 'Test',
    lastName: 'Cashier',
    email: 'cashier@test.com',
    password: hashedPassword,
    roleId: cashierRole.id,
    isActive: true,
  });

  const hr = await User.create({
    firstName: 'Test',
    lastName: 'HR',
    email: 'hr@test.com',
    password: hashedPassword,
    roleId: hrRole.id,
    isActive: true,
  });

  // Create category
  const category = await Category.create({
    name: 'Test Category',
    slug: 'test-category',
    description: 'Test category for products',
    isActive: true,
  });

  // Create product
  const product = await Product.create({
    name: 'Test Product',
    sku: 'TEST-001',
    barcode: '1234567890123',
    categoryId: category.id,
    buyingPrice: 10.00,
    sellingPrice: 20.00,
    stockQuantity: 100,
    reorderLevel: 10,
    unit: 'pcs',
    isActive: true,
  });

  // Create department
  const department = await Department.create({
    name: 'Test Department',
    slug: 'test-department',
    description: 'Test department',
    isActive: true,
  });

  // Create position
  const position = await Position.create({
    name: 'Test Position',
    slug: 'test-position',
    description: 'Test position',
    departmentId: department.id,
    isActive: true,
  });

  // Create employee
  const employee = await Employee.create({
    employeeNo: 'EMP-0001',
    firstName: 'Test',
    lastName: 'Employee',
    email: 'employee@test.com',
    departmentId: department.id,
    positionId: position.id,
    hireDate: new Date('2023-01-01'),
    employmentType: 'regular',
    basicSalary: 15000.00,
    payFrequency: 'semi-monthly',
    status: 'active',
    userId: null,
  });

  return { admin, cashier, hr, category, product, department, position, employee };
}

/**
 * Clear all data but keep schema (for test isolation)
 */
export async function clearTestData(db: Sequelize): Promise<void> {
  const modelNames = Object.keys(db.models);
  
  // Disable foreign key checks temporarily
  await db.query('PRAGMA foreign_keys = OFF;');
  
  for (const modelName of modelNames) {
    const model = db.models[modelName];
    if (model.truncate) {
      await model.truncate({ cascade: true, restartIdentity: true });
    }
  }
  
  await db.query('PRAGMA foreign_keys = ON;');
}

/**
 * Create a test user with specific role
 */
export async function createTestUser(
  db: Sequelize,
  roleSlug: string,
  overrides: any = {}
): Promise<any> {
  const { Role, User } = db.models;
  const bcrypt = (await import('bcryptjs')).default;
  
  const role = await Role.findOne({ where: { slug: roleSlug } });
  if (!role) {
    throw new Error(`Role ${roleSlug} not found`);
  }

  const hashedPassword = await bcrypt.hash('password123', 10);

  return User.create({
    firstName: 'Test',
    lastName: roleSlug.charAt(0).toUpperCase() + roleSlug.slice(1),
    email: `test.${roleSlug}@test.com`,
    password: hashedPassword,
    roleId: role.id,
    isActive: true,
    ...overrides,
  });
}