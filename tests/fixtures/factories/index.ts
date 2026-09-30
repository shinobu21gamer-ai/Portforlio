import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';

export const UserFactory = {
  build: (overrides: Record<string, any> = {}) => ({
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    email: faker.internet.email().toLowerCase(),
    password: 'password123',
    passwordHash: bcrypt.hashSync('password123', 10),
    roleId: 1,
    branchId: null,
    isActive: true,
    ...overrides,
  }),

  create: async (db: any, overrides: Record<string, any> = {}) => {
    const data = UserFactory.build(overrides);
    return db.User.create(data);
  },

  createAdmin: async (db: any) => {
    const adminRole = await db.Role.findOne({ where: { slug: 'admin' } });
    return UserFactory.create(db, { roleId: adminRole.id, email: 'admin@test.com' });
  },

  createCashier: async (db: any, branchId?: number) => {
    const cashierRole = await db.Role.findOne({ where: { slug: 'cashier' } });
    return UserFactory.create(db, { roleId: cashierRole.id, branchId, email: 'cashier@test.com' });
  },

  createEmployee: async (db: any) => {
    const employeeRole = await db.Role.findOne({ where: { slug: 'employee' } });
    return UserFactory.create(db, { roleId: employeeRole.id, email: 'employee@test.com' });
  },
};

export const CategoryFactory = {
  build: (overrides: Record<string, any> = {}) => ({
    name: faker.commerce.department(),
    slug: faker.helpers.slugify(faker.commerce.department()).toLowerCase(),
    description: faker.lorem.sentence(),
    ...overrides,
  }),

  create: async (db: any, overrides: Record<string, any> = {}) => {
    const data = CategoryFactory.build(overrides);
    return db.Category.create(data);
  },
};

export const ProductFactory = {
  build: (overrides: Record<string, any> = {}) => ({
    name: faker.commerce.productName(),
    sku: `SKU-${faker.string.alphanumeric(8).toUpperCase()}`,
    barcode: faker.string.numeric(13),
    categoryId: 1,
    buyingPrice: parseFloat(faker.commerce.price({ min: 10, max: 500, dec: 2 })),
    sellingPrice: parseFloat(faker.commerce.price({ min: 15, max: 1000, dec: 2 })),
    stockQuantity: faker.number.int({ min: 0, max: 500 }),
    reorderLevel: 10,
    unit: 'pcs',
    isActive: true,
    ...overrides,
  }),

  create: async (db: any, overrides: Record<string, any> = {}) => {
    const data = ProductFactory.build(overrides);
    return db.Product.create(data);
  },

  createLowStock: async (db: any, categoryId: number) => {
    return ProductFactory.create(db, { categoryId, stockQuantity: 5, reorderLevel: 10 });
  },

  createWithStock: async (db: any, categoryId: number, stock: number) => {
    return ProductFactory.create(db, { categoryId, stockQuantity: stock });
  },
};

export const CustomerFactory = {
  build: (overrides: Record<string, any> = {}) => ({
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    email: faker.internet.email().toLowerCase(),
    phone: faker.phone.number(),
    address: faker.location.streetAddress(),
    isActive: true,
    ...overrides,
  }),

  create: async (db: any, overrides: Record<string, any> = {}) => {
    const data = CustomerFactory.build(overrides);
    return db.Customer.create(data);
  },
};

export const SupplierFactory = {
  build: (overrides: Record<string, any> = {}) => ({
    name: faker.company.name(),
    contactPerson: faker.person.fullName(),
    email: faker.internet.email().toLowerCase(),
    phone: faker.phone.number(),
    address: faker.location.streetAddress(),
    isActive: true,
    ...overrides,
  }),

  create: async (db: any, overrides: Record<string, any> = {}) => {
    const data = SupplierFactory.build(overrides);
    return db.Supplier.create(data);
  },
};

export const BranchFactory = {
  build: (overrides: Record<string, any> = {}) => ({
    name: faker.company.name() + ' Branch',
    code: `BR${faker.string.numeric(3)}`,
    address: faker.location.streetAddress(),
    phone: faker.phone.number(),
    email: faker.internet.email().toLowerCase(),
    isActive: true,
    ...overrides,
  }),

  create: async (db: any, overrides: Record<string, any> = {}) => {
    const data = BranchFactory.build(overrides);
    return db.Branch.create(data);
  },
};

export const DepartmentFactory = {
  build: (overrides: Record<string, any> = {}) => ({
    name: faker.commerce.department(),
    code: `D${faker.string.numeric(3)}`,
    description: faker.lorem.sentence(),
    ...overrides,
  }),

  create: async (db: any, overrides: Record<string, any> = {}) => {
    const data = DepartmentFactory.build(overrides);
    return db.Department.create(data);
  },
};

export const PositionFactory = {
  build: (overrides: Record<string, any> = {}) => ({
    title: faker.person.jobTitle(),
    code: `POS${faker.string.numeric(3)}`,
    departmentId: 1,
    description: faker.lorem.sentence(),
    ...overrides,
  }),

  create: async (db: any, overrides: Record<string, any> = {}) => {
    const data = PositionFactory.build(overrides);
    return db.Position.create(data);
  },
};

export const EmployeeFactory = {
  build: (overrides: Record<string, any> = {}) => ({
    employeeNo: `EMP-${faker.string.numeric(4)}`,
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    email: faker.internet.email().toLowerCase(),
    departmentId: 1,
    positionId: 1,
    hireDate: faker.date.past({ years: 5 }),
    employmentType: 'regular',
    basicSalary: parseFloat(faker.commerce.price({ min: 15000, max: 50000, dec: 2 })),
    payFrequency: 'semi-monthly',
    status: 'active',
    ...overrides,
  }),

  create: async (db: any, overrides: Record<string, any> = {}) => {
    const data = EmployeeFactory.build(overrides);
    return db.Employee.create(data);
  },
};

export const SaleFactory = {
  build: (overrides: Record<string, any> = {}) => ({
    invoiceNo: `INV-${Date.now()}-${faker.string.alphanumeric(4).toUpperCase()}`,
    userId: 1,
    customerId: null,
    subtotal: 100,
    discountAmount: 0,
    taxAmount: 12,
    totalAmount: 112,
    paymentMethod: 'cash',
    paymentAmount: 112,
    changeAmount: 0,
    status: 'completed',
    paymentStatus: 'paid',
    ...overrides,
  }),

  create: async (db: any, overrides: Record<string, any> = {}) => {
    const data = SaleFactory.build(overrides);
    return db.Sale.create(data);
  },

  createPending: async (db: any, overrides: Record<string, any> = {}) => {
    return SaleFactory.create(db, { ...overrides, status: 'pending', paymentStatus: 'pending' });
  },
};

export const PayrollFactory = {
  build: (overrides: Record<string, any> = {}) => ({
    period: '2024-01',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-31'),
    status: 'draft',
    totalEmployees: 0,
    totalGrossPay: 0,
    totalDeductions: 0,
    totalNetPay: 0,
    ...overrides,
  }),

  create: async (db: any, overrides: Record<string, any> = {}) => {
    const data = PayrollFactory.build(overrides);
    return db.Payroll.create(data);
  },
};