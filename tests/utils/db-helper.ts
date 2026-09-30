import { Sequelize } from 'sequelize';
import { Umzug, SequelizeStorage } from 'umzug';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let testSequelize: Sequelize;
let umzug: Umzug<Sequelize>;

export async function setupTestDB(): Promise<Sequelize> {
  if (testSequelize) return testSequelize;

  testSequelize = new Sequelize({
    dialect: 'sqlite',
    storage: ':memory:',
    logging: false,
    define: {
      timestamps: true,
      underscored: true,
      paranoid: true,
    },
  });

  umzug = new Umzug({
    migrations: {
      glob: path.join(__dirname, '../../../migrations/*.js'),
      resolve: ({ name, path, context }) => {
        const migration = require(path);
        return {
          name,
          up: () => migration.up(context, Sequelize),
          down: () => migration.down(context, Sequelize),
        };
      },
    },
    context: testSequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize: testSequelize }),
    logger: undefined,
  });

  await umzug.up();
  return testSequelize;
}

export async function teardownTestDB(): Promise<void> {
  if (testSequelize) {
    await testSequelize.close();
    testSequelize = undefined as any;
    umzug = undefined as any;
  }
}

export async function seedTestData(db: any): Promise<any> {
  const adminRole = await db.Role.create({ name: 'Admin', slug: 'admin', description: 'Full system access' });
  const cashierRole = await db.Role.create({ name: 'Cashier', slug: 'cashier', description: 'Point of sale operations' });
  const employeeRole = await db.Role.create({ name: 'Employee', slug: 'employee', description: 'Basic employee access' });
  const hrRole = await db.Role.create({ name: 'HR', slug: 'hr', description: 'Human resources management' });
  const managerRole = await db.Role.create({ name: 'Manager', slug: 'manager', description: 'Store manager' });
  const inventoryStaffRole = await db.Role.create({ name: 'Inventory Staff', slug: 'inventory_staff', description: 'Product, supplier, and stock management' });

  const bcrypt = require('bcryptjs');
  const hashedPassword = await bcrypt.hash('admin123', 10);

  const admin = await db.User.create({
    firstName: 'Test',
    lastName: 'Admin',
    email: 'admin@test.com',
    password: hashedPassword,
    roleId: adminRole.id,
    isActive: true,
  });

  const cashier = await db.User.create({
    firstName: 'Test',
    lastName: 'Cashier',
    email: 'cashier@test.com',
    password: hashedPassword,
    roleId: cashierRole.id,
    isActive: true,
  });

  const employee = await db.User.create({
    firstName: 'Test',
    lastName: 'Employee',
    email: 'employee@test.com',
    password: hashedPassword,
    roleId: employeeRole.id,
    isActive: true,
  });

  const category = await db.Category.create({ name: 'Test Category', slug: 'test-category', description: 'Test category' });
  
  const product = await db.Product.create({
    name: 'Test Product',
    categoryId: category.id,
    buyingPrice: 10,
    sellingPrice: 20,
    stockQuantity: 100,
    sku: 'TEST-001',
    barcode: '1234567890123',
    isActive: true,
  });

  const branch = await db.Branch.create({
    name: 'Main Branch',
    code: 'MB001',
    address: '123 Test St',
    phone: '555-0001',
    email: 'main@test.com',
    isActive: true,
  });

  const department = await db.Department.create({
    name: 'Test Department',
    code: 'TD001',
    description: 'Test department',
  });

  const position = await db.Position.create({
    title: 'Test Position',
    code: 'TP001',
    departmentId: department.id,
    description: 'Test position',
  });

  const emp = await db.Employee.create({
    employeeNo: 'EMP-0001',
    firstName: 'Test',
    lastName: 'Employee',
    email: 'employee@test.com',
    departmentId: department.id,
    positionId: position.id,
    hireDate: new Date('2024-01-01'),
    employmentType: 'regular',
    basicSalary: 25000,
    payFrequency: 'semi-monthly',
    status: 'active',
  });

  return { admin, cashier, employee, category, product, branch, department, position, emp };
}