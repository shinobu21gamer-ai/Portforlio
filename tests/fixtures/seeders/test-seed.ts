// Test Seeder - Comprehensive test data setup
import type { Sequelize } from 'sequelize';
import { UserFactory } from './factories/user.factory';
import { ProductFactory } from './factories/product.factory';
import { EmployeeFactory } from './factories/employee.factory';
import { SaleFactory } from './factories/sale.factory';
import { PayrollFactory } from './factories/payroll.factory';

export interface TestData {
  users: {
    admin: any;
    cashier: any;
    hr: any;
    employee: any;
    inventory: any;
  };
  category: any;
  products: any[];
  employees: any[];
  sales: any[];
  payrolls: any[];
}

/**
 * Seed comprehensive test data for integration/E2E tests
 */
export async function seedComprehensiveTestData(db: Sequelize): Promise<TestData> {
  console.log('🌱 Seeding comprehensive test data...');

  // 1. Create role set
  console.log('  Creating users...');
  const { admin, cashier, hr, employee, inventory } = await UserFactory.createRoleSet(db);

  // 2. Create category
  const category = await db.models.Category.findOne({ where: { slug: 'test-category' } }) ||
    await db.models.Category.create({
      name: 'Test Category',
      slug: 'test-category',
      description: 'Test category for products',
      isActive: true,
    });

  // 3. Create products
  console.log('  Creating products...');
  const products = await ProductFactory.createMany(db, 10, category.id);

  // Add specific products for VAT testing
  const vatProducts = await ProductFactory.createForVATTesting(db, category.id);

  // 4. Create employees
  console.log('  Creating employees...');
  const employees = await EmployeeFactory.createMany(db, 5, {});

  // 5. Create sales
  console.log('  Creating sales...');
  const sales = await SaleFactory.createMany(db, 20);

  // 6. Create payroll
  console.log('  Creating payroll...');
  const payroll = await PayrollFactory.create(db);

  console.log('✅ Test data seeded successfully!');

  return {
    users: { admin, cashier, hr, employee, inventory },
    category,
    products: [...products, ...vatProducts],
    employees,
    sales,
    payrolls: [payroll],
  };
}

/**
 * Seed minimal data for unit tests
 */
export async function seedMinimalTestData(db: Sequelize): Promise<TestData> {
  console.log('🌱 Seeding minimal test data...');

  const { admin, cashier, hr, employee, inventory } = await UserFactory.createRoleSet(db);

  const category = await db.models.Category.findOne({ where: { slug: 'test-category' } }) ||
    await db.models.Category.create({
      name: 'Test Category',
      slug: 'test-category',
      description: 'Test category for products',
      isActive: true,
    });

  const product = await ProductFactory.create(db, { categoryId: category.id });
  const employeeRec = await EmployeeFactory.create(db);
  const sale = await SaleFactory.create(db);
  const payroll = await PayrollFactory.create(db);

  return {
    users: { admin, cashier, hr, employee, inventory },
    category,
    products: [product],
    employees: [employeeRec],
    sales: [sale],
    payrolls: [payroll],
  };
}

/**
 * Clean all test data (preserve schema)
 */
export async function cleanTestData(db: Sequelize): Promise<void> {
  await db.query('PRAGMA foreign_keys = OFF;');
  
  const modelNames = Object.keys(db.models).filter(name => name !== 'sequelize' && name !== 'Sequelize');
  
  for (const modelName of modelNames) {
    const model = db.models[modelName];
    if (model.truncate) {
      await model.truncate({ cascade: true, restartIdentity: true });
    }
  }
  
  await db.query('PRAGMA foreign_keys = ON;');
}

/**
 * Create specific test scenarios
 */
export const TestScenarios = {
  /**
   * Low stock scenario
   */
  async lowStock(db: Sequelize) {
    const category = await db.models.Category.findOne({ where: { slug: 'test-category' } });
    const product = await db.models.Product.create({
      name: 'Low Stock Item',
      sku: 'LOW-001',
      barcode: '9999999999999',
      categoryId: category?.id || 1,
      buyingPrice: 10,
      sellingPrice: 20,
      stockQuantity: 5,
      reorderLevel: 10,
      unit: 'pcs',
      isActive: true,
    });
    return { product };
  },

  /**
   * Out of stock scenario
   */
  async outOfStock(db: Sequelize) {
    const category = await db.models.Category.findOne({ where: { slug: 'test-category' } });
    const product = await db.models.Product.create({
      name: 'Out of Stock Item',
      sku: 'OOS-001',
      barcode: '8888888888888',
      categoryId: category?.id || 1,
      buyingPrice: 10,
      sellingPrice: 20,
      stockQuantity: 0,
      reorderLevel: 10,
      unit: 'pcs',
      isActive: true,
    });
    return { product };
  },

  /**
   * Employee with leave balance
   */
  async employeeWithLeave(db: Sequelize) {
    const employee = await db.models.Employee.findOne({ where: { status: 'active' } });
    if (!employee) return null;

    const leaveTypes = ['vacation', 'sick', 'maternity', 'paternity', 'bereavement'];
    for (const type of leaveTypes) {
      await db.models.LeaveBalance.create({
        employeeId: employee.id,
        leaveType: type,
        balance: type === 'vacation' ? 15 : type === 'sick' ? 10 : 7,
        used: 0,
        year: new Date().getFullYear(),
      });
    }
    return { employee };
  },

  /**
   * Employee with attendance record
   */
  async employeeWithAttendance(db: Sequelize) {
    const employee = await db.models.Employee.findOne({ 
      where: { status: 'active' },
      include: [{ association: 'user' }]
    });
    if (!employee) return null;

    const today = new Date();
    today.setHours(8, 0, 0, 0);

    await db.models.Attendance.create({
      employeeId: employee.id,
      date: today,
      timeIn: new Date(today.getTime() + 8 * 60 * 60 * 1000),
      timeOut: new Date(today.getTime() + 17 * 60 * 60 * 1000),
      status: 'present',
      hoursWorked: 8,
      lateMinutes: 0,
      overtimeHours: 0,
      nightDiffHours: 0,
    });

    return { employee };
  },

  /**
   * Pending sale for auto-cancel testing
   */
  async pendingSale(db: Sequelize) {
    const sale = await db.models.Sale.create({
      invoiceNo: `INV-PENDING-${Date.now()}`,
      customerId: null,
      userId: 1,
      subtotal: 100,
      discountAmount: 0,
      taxAmount: 12,
      total: 112,
      paymentMethod: 'cash',
      paymentStatus: 'pending',
      status: 'pending',
      createdAt: new Date(Date.now() - 40 * 60 * 1000), // 40 minutes ago
    });
    return { sale };
  },

  /**
   * Expired discount for validation testing
   */
  async expiredDiscount(db: Sequelize) {
    const discount = await db.models.Discount.create({
      name: 'Expired Promo',
      code: 'EXPIRED20',
      type: 'percentage',
      value: 20,
      minPurchase: 100,
      maxDiscount: 500,
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      endDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      usageLimit: 100,
      usedCount: 0,
      isActive: true,
    });
    return { discount };
  },

  /**
   * Senior citizen discount
   */
  async seniorDiscount(db: Sequelize) {
    const discount = await db.models.Discount.create({
      name: 'Senior Citizen',
      code: 'SENIOR20',
      type: 'percentage',
      value: 20,
      minPurchase: 0,
      maxDiscount: 1000,
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      usageLimit: 1000,
      usedCount: 0,
      isActive: true,
      isSeniorCitizen: true,
    });
    return { discount };
  },
};