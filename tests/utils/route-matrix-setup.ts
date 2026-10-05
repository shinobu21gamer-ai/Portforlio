/**
 * Route-matrix harness (Phase 6).
 *
 * Boots the REAL Express app (src/app.js) on an ephemeral port against an
 * in-memory SQLite database, then seeds the same six roles and permission
 * slugs that src/server.js bootstraps, so every route in the matrix can be
 * exercised through the full middleware chain: rate limit -> protect ->
 * authorize()/hasPermission() -> validate() -> controller -> service ->
 * Sequelize transaction.
 *
 * WHY THE ENV ASSIGNMENTS ARE AT MODULE TOP LEVEL:
 * src/config reads process.env at require time and src/config/database builds
 * the Sequelize instance at require time. If these were set inside beforeAll,
 * the test file's module-level `require('../../src/models')` would already
 * have captured a config pointing at the real database.sqlite -- and the
 * sync({ force: true }) below would wipe the developer's database. This exact
 * bug is documented in tests/utils/test-setup.ts.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-ci-only-32chars!!';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-for-ci-only-32chars';
process.env.JWT_EXPIRES_IN = '1h';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';
process.env.APP_TIMEZONE = 'Asia/Manila';

// Registration must stay off: the matrix asserts 401/403 for unauthorised
// callers, and a public /auth/register would let any caller mint an account.
process.env.ALLOW_PUBLIC_REGISTRATION = 'false';
// No outbound SMTP in CI. Without this the forgot-password / email-receipt /
// payslip legs would attempt a real nodemailer transport and time out.
process.env.EMAIL_DISABLED = 'true';
// PayMongo is unreachable and unconfigured in CI; payment routes must take
// their clean "not configured" branch instead of calling the network.
delete process.env.PAYMONGO_SECRET_KEY;
delete process.env.PAYMONGO_PUBLIC_KEY;

import axios, { AxiosInstance } from 'axios';

export const MATRIX_PASSWORD = 'Passw0rd!123';

/** The six roles seeded by src/server.js bootstrap, in descending privilege. */
export const ROLES = [
  'admin',
  'hr',
  'manager',
  'cashier',
  'inventory_staff',
  'employee',
] as const;
export type RoleSlug = (typeof ROLES)[number];

export const matrixEmail = (role: RoleSlug): string => `${role}@matrix.test.com`;

/**
 * Permission catalogue -- mirrors the `permissions` array in
 * src/server.js runBootstrap(). Kept in sync by hand because the matrix needs
 * the slug list to build a *least-privileged* role per permission.
 */
export const PERMISSION_SLUGS: Array<{ name: string; slug: string; module: string }> = [
  { name: 'View Dashboard', slug: 'dashboard.view', module: 'dashboard' },
  { name: 'View Products', slug: 'products.view', module: 'products' },
  { name: 'Create Products', slug: 'products.create', module: 'products' },
  { name: 'Edit Products', slug: 'products.update', module: 'products' },
  { name: 'Delete Products', slug: 'products.delete', module: 'products' },
  { name: 'View Categories', slug: 'categories.view', module: 'categories' },
  { name: 'Manage Categories', slug: 'categories.manage', module: 'categories' },
  { name: 'View Customers', slug: 'customers.view', module: 'customers' },
  { name: 'Manage Customers', slug: 'customers.manage', module: 'customers' },
  { name: 'Delete Customers', slug: 'customers.delete', module: 'customers' },
  { name: 'View Suppliers', slug: 'suppliers.view', module: 'suppliers' },
  { name: 'Manage Suppliers', slug: 'suppliers.manage', module: 'suppliers' },
  { name: 'Delete Suppliers', slug: 'suppliers.delete', module: 'suppliers' },
  { name: 'View Purchases', slug: 'purchases.view', module: 'purchases' },
  { name: 'Create Purchases', slug: 'purchases.create', module: 'purchases' },
  { name: 'Pay Purchases', slug: 'purchases.pay', module: 'purchases' },
  { name: 'Cancel Purchases', slug: 'purchases.cancel', module: 'purchases' },
  { name: 'View Inventory', slug: 'inventory.view', module: 'inventory' },
  { name: 'Manage Stock', slug: 'inventory.manage', module: 'inventory' },
  { name: 'View Expenses', slug: 'expenses.view', module: 'expenses' },
  { name: 'Manage Expenses', slug: 'expenses.manage', module: 'expenses' },
  { name: 'Delete Expenses', slug: 'expenses.delete', module: 'expenses' },
  { name: 'View Discounts', slug: 'discounts.view', module: 'discounts' },
  { name: 'Manage Discounts', slug: 'discounts.manage', module: 'discounts' },
  { name: 'Delete Discounts', slug: 'discounts.delete', module: 'discounts' },
  { name: 'View Petty Cash', slug: 'petty_cash.view', module: 'petty_cash' },
  { name: 'Manage Petty Cash', slug: 'petty_cash.manage', module: 'petty_cash' },
  { name: 'View Reports', slug: 'reports.view', module: 'reports' },
  { name: 'View Finance', slug: 'finance.view', module: 'finance' },
  { name: 'View Sales', slug: 'sales.view', module: 'sales' },
  { name: 'Create Sales', slug: 'sales.create', module: 'sales' },
  { name: 'Cancel Sales', slug: 'sales.cancel', module: 'sales' },
  { name: 'View Branches', slug: 'branches.view', module: 'branches' },
  { name: 'Manage Branches', slug: 'branches.manage', module: 'branches' },
  { name: 'View Users', slug: 'users.view', module: 'users' },
  { name: 'Manage Users', slug: 'users.manage', module: 'users' },
  { name: 'Delete Users', slug: 'users.delete', module: 'users' },
  { name: 'Manage Settings', slug: 'settings.manage', module: 'settings' },
  { name: 'View Activity Log', slug: 'activity.view', module: 'activity' },
];

/** Mirrors the `rolePermissions` map in src/server.js runBootstrap(). */
export const ROLE_PERMISSIONS: Record<RoleSlug, string[]> = {
  admin: PERMISSION_SLUGS.map((p) => p.slug),
  manager: [
    'dashboard.view', 'products.view', 'products.create', 'products.update',
    'categories.view', 'categories.manage',
    'customers.view', 'customers.manage', 'customers.delete',
    'suppliers.view', 'suppliers.manage', 'suppliers.delete',
    'purchases.view', 'purchases.create', 'purchases.pay',
    'inventory.view', 'inventory.manage',
    'expenses.view', 'expenses.manage',
    'discounts.view', 'discounts.manage',
    'petty_cash.view', 'petty_cash.manage',
    'reports.view', 'finance.view',
    'sales.view', 'sales.create', 'sales.cancel',
    'branches.view', 'activity.view',
  ],
  inventory_staff: [
    'dashboard.view', 'products.view', 'products.create', 'products.update',
    'categories.view', 'categories.manage',
    'suppliers.view', 'suppliers.manage',
    'purchases.view', 'purchases.create',
    'inventory.view', 'inventory.manage',
  ],
  cashier: ['customers.view', 'customers.manage', 'sales.view', 'sales.create'],
  hr: ['dashboard.view', 'activity.view'],
  employee: ['dashboard.view'],
};

export interface RouteMatrixContext {
  baseUrl: string;
  apiBase: string;
  http: AxiosInstance;
  models: any;
  sequelize: any;
  server: any;
  /** Bearer token per role, obtained through the real /auth/login route. */
  tokens: Record<RoleSlug, string>;
  /**
   * Mint a fresh Bearer token for a user id, using the production signing path
   * (authService.generateToken => { id, jti }). The matrix mints per request
   * rather than reusing one token per role because POST /auth/logout
   * blacklists the token it is given and POST /auth/change-password bumps
   * passwordChangedAt, either of which would 401 every later leg sharing that
   * token.
   */
  mint: (userId: number) => string;
  /** Primary keys of seeded fixtures, used to fill `:param` route segments. */
  ids: Record<string, any>;
  close: () => Promise<void>;
}

/**
 * Seed roles + permissions + the six matrix users, then the fixture rows the
 * happy-path legs need. Returns ids for parameterised routes.
 */
async function seedMatrix(models: any): Promise<Record<string, any>> {
  const {
    Role, Permission, User, Branch, Category, ExpenseCategory, Supplier, Product,
    Customer, Department, Position, Employee, Schedule, JobPosting, Discount,
    PettyCashFund, Sale, SaleItem, Payment, Shift,
  } = models;

  const ids: Record<string, any> = {};

  // ── permissions ────────────────────────────────────────────────────────
  const permBySlug: Record<string, any> = {};
  for (const p of PERMISSION_SLUGS) {
    const [perm] = await Permission.findOrCreate({ where: { slug: p.slug }, defaults: p });
    permBySlug[p.slug] = perm;
  }
  ids.permissions = permBySlug;

  // ── roles ──────────────────────────────────────────────────────────────
  const roleBySlug: Record<string, any> = {};
  for (const slug of ROLES) {
    const [role] = await Role.findOrCreate({
      where: { slug },
      defaults: { name: slug.replace(/_/g, ' '), slug, isActive: true },
    });
    const perms = ROLE_PERMISSIONS[slug].map((s) => permBySlug[s]?.id).filter(Boolean);
    if (perms.length) await role.setPermissions(perms);
    roleBySlug[slug] = role;
  }
  ids.roles = roleBySlug;

  // ── one user per role ──────────────────────────────────────────────────
  // mustChangePassword must be false: protect() returns 403 MUST_CHANGE_PASSWORD
  // on every other path for flagged accounts, which would mask the authz matrix.
  for (const slug of ROLES) {
    const user = await User.create({
      firstName: slug.replace(/_/g, ' '),
      lastName: 'Matrix',
      email: matrixEmail(slug),
      password: MATRIX_PASSWORD,
      roleId: roleBySlug[slug].id,
      isActive: true,
      mustChangePassword: false,
    });
    ids[`user_${slug}`] = user.id;
  }

  // A sacrificial admin account for the two routes that mutate the caller's own
  // credentials -- POST /auth/change-password rotates the password and
  // POST /auth/logout blacklists the presented token. Running those against a
  // matrix role would poison every later leg for that role, so they act on this
  // user instead and the six matrix users stay pristine for the whole run.
  ids.user_mutator = (await User.create({
    firstName: 'mutator',
    lastName: 'Matrix',
    email: 'mutator@matrix.test.com',
    password: MATRIX_PASSWORD,
    roleId: roleBySlug.admin.id,
    isActive: true,
    mustChangePassword: false,
  })).id;

  // ── fixture strategy ───────────────────────────────────────────────────
  // Every resource gets TWO rows:
  //   ids.<thing>        stable, read-only — used by GET legs and as a parent
  //                      reference. Must survive the whole run.
  //   ids.<thing>Target  disposable — used by DELETE/PUT/PATCH and by POST
  //                      action legs that mutate or destroy the row.
  // This matters because several services mutate *other* tables as a side
  // effect. employeeService.delete() deactivates the linked User row, so
  // pointing DELETE /hrms/employees/:id at the employee matrix user's own
  // Employee record 401s every later employee-role leg ("Account has been
  // deactivated"). Separating read fixtures from write fixtures makes the
  // matrix order-independent.
  const mk = async (model: any, stable: any, target: any, idKey: string) => {
    const a = await model.create(stable);
    const b = await model.create(target);
    ids[idKey] = a.id;
    ids[`${idKey}Target`] = b.id;
    return a;
  };

  // ── store fixtures ─────────────────────────────────────────────────────
  const branch = await mk(Branch,
    { name: 'Matrix Branch', code: 'MTX', address: '1 Matrix Way', city: 'Makati',
      province: 'Metro Manila', phone: '02-8888-0000', isActive: true },
    { name: 'Matrix Branch Two', code: 'MTX2', address: '2 Matrix Way', city: 'Taguig',
      province: 'Metro Manila', phone: '02-8888-0001', isActive: true },
    'branch');

  const category = await mk(Category,
    { name: 'Matrix Beverages', slug: 'matrix-beverages', description: 'matrix fixture' },
    { name: 'Matrix Snacks', slug: 'matrix-snacks', description: 'matrix fixture target' },
    'category');

  const expenseCategory = await mk(ExpenseCategory,
    { name: 'Matrix Utilities', slug: 'matrix-utilities', description: 'matrix fixture' },
    { name: 'Matrix Rent', slug: 'matrix-rent', description: 'matrix fixture target' },
    'expenseCategory');

  const supplier = await mk(Supplier,
    { name: 'Matrix Supplier Corp.', contactPerson: 'Juan Matrix',
      email: 'juan@matrix-supplier.test', phone: '(02) 8000-0000',
      address: '2 Matrix Ave', city: 'Makati', province: 'Metro Manila', paymentTerms: 'Net 30' },
    { name: 'Matrix Supplier Two', contactPerson: 'Ana Matrix',
      email: 'ana@matrix-supplier.test', phone: '(02) 8000-0001',
      address: '3 Matrix Ave', city: 'Taguig', province: 'Metro Manila', paymentTerms: 'Net 15' },
    'supplier');

  const productFields = (n: number, stock: number, min: number) => ({
    name: `Matrix Product ${n}`, slug: `matrix-product-${n}`, sku: `MTX-${String(n).padStart(3, '0')}`,
    barcode: `48000999900${String(n).padStart(2, '0')}`, categoryId: category.id, brand: 'Matrix',
    unit: 'pcs', buyingPrice: 38, sellingPrice: 52, stockQuantity: stock, minStockLevel: min,
    supplierId: supplier.id, taxRate: 0, isActive: true,
  });
  // ids.product mirrors the demo seed used by the e2e specs (₱52, stock 48).
  const product = await mk(Product, productFields(1, 48, 12), productFields(2, 40, 12), 'product');
  // Kept below minStockLevel so the low-stock routes return something.
  ids.lowStockProduct = (await Product.create(productFields(3, 2, 24))).id;

  const customer = await mk(Customer,
    { firstName: 'Matrix', lastName: 'Customer', email: 'customer@matrix.test',
      mobile: '09170000000', address: '3 Matrix St', city: 'Manila', province: 'Metro Manila' },
    { firstName: 'Matrix', lastName: 'Target', email: 'target@matrix.test',
      mobile: '09170000001', address: '4 Matrix St', city: 'Manila', province: 'Metro Manila' },
    'customer');

  const discountWindow = {
    startDate: new Date(Date.now() - 86400000),
    endDate: new Date(Date.now() + 30 * 86400000),
  };
  const discount = await mk(Discount,
    { name: 'Matrix Promo', code: 'MATRIX10', type: 'percentage', value: 10,
      minPurchaseAmount: 0, isActive: true, ...discountWindow },
    { name: 'Matrix Promo Two', code: 'MATRIX20', type: 'percentage', value: 20,
      minPurchaseAmount: 0, isActive: true, ...discountWindow },
    'discount');

  // ── HRMS fixtures ──────────────────────────────────────────────────────
  const department = await mk(Department,
    { name: 'Matrix Operations', description: 'matrix fixture' },
    { name: 'Matrix Warehouse', description: 'matrix fixture target' },
    'department');

  const position = await mk(Position,
    { title: 'Matrix Cashier', departmentId: department.id, roleSlug: 'cashier',
      minSalary: 13000, maxSalary: 18000 },
    { title: 'Matrix Clerk', departmentId: department.id, roleSlug: 'employee',
      minSalary: 13000, maxSalary: 17000 },
    'position');

  const schedule = await mk(Schedule,
    { name: 'Matrix Morning', startTime: '08:00', endTime: '17:00',
      daysOfWeek: [1, 2, 3, 4, 5], breakMinutes: 60 },
    { name: 'Matrix Evening', startTime: '13:00', endTime: '22:00',
      daysOfWeek: [1, 2, 3, 4, 5], breakMinutes: 60 },
    'schedule');

  const empFields = (no: string, first: string, email: string, extra: any = {}) => ({
    employeeNo: no, firstName: first, lastName: 'Matrix', email,
    departmentId: department.id, positionId: position.id,
    hireDate: new Date('2024-01-01'), employmentType: 'full-time',
    basicSalary: 25000, paymentFrequency: 'semi-monthly', status: 'active', ...extra,
  });
  // The employee linked to the `employee` matrix user powers /hrms/me/* and must
  // never be mutated by the matrix.
  const employee = await Employee.create(
    empFields('MTX-0001', 'employee', matrixEmail('employee'), { userId: ids.user_employee }),
  );
  ids.employee = employee.id;
  ids.employee2 = (await Employee.create(empFields('MTX-0002', 'Second', 'second@matrix.test'))).id;
  // Disposable employees for the approve / reject / terminate / pos-access /
  // pos-revoke / DELETE legs. None is linked to a matrix User, so mutating them
  // cannot deactivate an account the matrix still needs.
  ids.employeeTarget = (await Employee.create(empFields('MTX-0003', 'Target', 'target-emp@matrix.test'))).id;
  ids.pendingEmployee = (await Employee.create(
    empFields('MTX-0004', 'Pending', 'pending@matrix.test',
      { employmentType: 'contract', paymentFrequency: 'monthly', status: 'pending' }),
  )).id;
  ids.rejectEmployee = (await Employee.create(
    empFields('MTX-0005', 'Rejectable', 'rejectable@matrix.test', { status: 'pending' }),
  )).id;
  ids.terminateEmployee = (await Employee.create(
    empFields('MTX-0006', 'Terminable', 'terminable@matrix.test'),
  )).id;
  ids.posAccessEmployee = (await Employee.create(
    empFields('MTX-0007', 'PosAccess', 'posaccess@matrix.test'),
  )).id;
  ids.deleteEmployee = (await Employee.create(
    empFields('MTX-0008', 'Deletable', 'deletable@matrix.test'),
  )).id;
  // An employee with no contract at all: contractService.create refuses when the
  // employee already has an active one, so POST /hrms/contracts needs a clean row.
  ids.contractlessEmployee = (await Employee.create(
    empFields('MTX-0009', 'Contractless', 'contractless@matrix.test'),
  )).id;

  const jobFields = (title: string) => ({
    title, departmentId: department.id, positionId: position.id,
    description: 'matrix fixture posting', requirements: 'none',
    salaryMin: 13000, salaryMax: 18000, employmentType: 'full-time',
    paymentFrequency: 'semi-monthly', openings: 2, location: 'Matrix Branch',
    status: 'open', approvedAt: new Date(),
    closingDate: new Date(Date.now() + 45 * 86400000).toISOString().split('T')[0],
    postedBy: ids.user_admin,
  });
  const job = await mk(JobPosting, jobFields('Matrix Cashier Opening'), jobFields('Matrix Clerk Opening'), 'job');
  ids.pendingJob = (await JobPosting.create(
    { ...jobFields('Matrix Pending Opening'), status: 'pending', approvedAt: null },
  )).id;
  ids.rejectJob = (await JobPosting.create(
    { ...jobFields('Matrix Rejectable Opening'), status: 'pending', approvedAt: null },
  )).id;

  const pettyCashFund = await mk(PettyCashFund,
    { name: 'Matrix Petty Cash', initialBalance: 5000, currentBalance: 5000,
      description: 'matrix fixture', status: 'active' },
    { name: 'Matrix Petty Cash Two', initialBalance: 3000, currentBalance: 3000,
      description: 'matrix fixture target', status: 'active' },
    'pettyCashFund');

  // A completed cash sale and a pending online sale, so /sales/:id, refund,
  // cancel, invoice, payments/status and the online-override legs each have a
  // real row to act on.
  const mkSale = async (paymentMethod: string, status: string, invoiceNo: string) => {
    const sale = await Sale.create({
      invoiceNo, userId: ids.user_cashier, customerId: customer.id,
      branchId: branch.id, subtotal: 52, taxAmount: 0, discountAmount: 0,
      total: 52, paymentMethod, paymentStatus: status === 'pending' ? 'pending' : 'paid',
      status, cashAmount: status === 'pending' ? 0 : 100, changeAmount: status === 'pending' ? 0 : 48,
    });
    await SaleItem.create({
      saleId: sale.id, productId: product.id, productName: product.name,
      quantity: 1, unitPrice: 52, subtotal: 52, total: 52,
    });
    return sale;
  };
  const completedSale = await mkSale('cash', 'completed', 'MTX-INV-0001');
  ids.sale = completedSale.id;
  ids.invoiceNo = completedSale.invoiceNo;
  const pendingSale = await mkSale('gcash', 'pending', 'MTX-INV-0002');
  ids.pendingSale = pendingSale.id;
  // Disposable sales for the cancel / refund legs.
  ids.cancelSale = (await mkSale('cash', 'completed', 'MTX-INV-0003')).id;
  ids.refundSale = (await mkSale('cash', 'completed', 'MTX-INV-0004')).id;
  ids.cancelPendingSale = (await mkSale('gcash', 'pending', 'MTX-INV-0005')).id;
  ids.cashCompleteSale = (await mkSale('gcash', 'pending', 'MTX-INV-0006')).id;
  ids.payment = (await Payment.create({
    saleId: completedSale.id, paymentMethod: 'cash', amount: 52, status: 'completed',
  })).id;

  ids.shift = (await Shift.create({
    userId: ids.user_cashier, branchId: branch.id, openingFloat: 500,
    status: 'open', openedAt: new Date(),
  })).id;

  // ── second-tier fixtures: one row per parameterised resource so every `:id`
  // segment resolves to something real rather than 404ing for want of data. ──
  const {
    Expense, Purchase, PurchaseItem, Contract, LeaveRequest, Interview, Payroll,
    Attendance, EmployeeDocument, Notification, Delivery, JobApplication,
    LoyaltyPoint, LeaveBalance,
  } = models;

  const expense = await mk(Expense,
    { expenseCategoryId: expenseCategory.id, userId: ids.user_admin, amount: 250,
      description: 'Matrix electricity bill', date: new Date() },
    { expenseCategoryId: expenseCategory.id, userId: ids.user_admin, amount: 400,
      description: 'Matrix water bill', date: new Date() },
    'expense');

  const mkPurchase = async (orderNo: string) => {
    const p = await Purchase.create({
      orderNo, userId: ids.user_admin, supplierId: supplier.id,
      status: 'pending', paymentStatus: 'unpaid', totalAmount: 380,
    });
    await PurchaseItem.create({
      purchaseId: p.id, productId: product.id, productName: product.name,
      quantity: 10, unitCost: 38, subtotal: 380, total: 380,
    });
    return p;
  };
  const purchase = await mkPurchase('MTX-PO-0001');
  ids.purchase = purchase.id;
  ids.purchaseTarget = (await mkPurchase('MTX-PO-0002')).id;
  ids.receivePurchase = (await mkPurchase('MTX-PO-0003')).id;
  ids.payPurchase = (await mkPurchase('MTX-PO-0004')).id;
  ids.cancelPurchase = (await mkPurchase('MTX-PO-0005')).id;
  ids.shipPurchase = (await mkPurchase('MTX-PO-0006')).id;

  ids.delivery = (await Delivery.create({
    orderType: 'purchase', orderId: purchase.id, status: 'pending',
  })).id;
  ids.simulateDelivery = (await Delivery.create({
    orderType: 'purchase', orderId: ids.shipPurchase, status: 'in_transit',
  })).id;

  const contract = await mk(Contract,
    { employeeId: employee.id, contractType: 'regular', status: 'pending',
      startDate: new Date('2024-01-01'),
      endDate: new Date(Date.now() + 200 * 86400000), paymentFrequency: 'semi-monthly' },
    { employeeId: ids.employee2, contractType: 'probationary', status: 'pending',
      startDate: new Date('2024-01-01'),
      endDate: new Date(Date.now() + 200 * 86400000), paymentFrequency: 'monthly' },
    'contract');
  ids.approveContract = (await Contract.create({
    employeeId: ids.employee2, contractType: 'regular', status: 'pending',
    startDate: new Date('2024-01-01'), endDate: new Date(Date.now() + 200 * 86400000),
  })).id;
  ids.terminateContract = (await Contract.create({
    employeeId: ids.employee2, contractType: 'regular', status: 'active',
    startDate: new Date('2024-01-01'), endDate: new Date(Date.now() + 200 * 86400000),
  })).id;
  ids.renewContract = (await Contract.create({
    employeeId: ids.employee2, contractType: 'regular', status: 'active',
    startDate: new Date('2024-01-01'), endDate: new Date(Date.now() + 200 * 86400000),
  })).id;

  const leaveFields = (empId: number) => ({
    employeeId: empId, leaveType: 'vacation', status: 'pending',
    startDate: new Date(Date.now() + 10 * 86400000),
    endDate: new Date(Date.now() + 12 * 86400000),
    days: 3, reason: 'Matrix fixture leave',
  });
  const leave = await mk(LeaveRequest, leaveFields(employee.id), leaveFields(ids.employee2), 'leave');
  ids.hrReviewLeave = (await LeaveRequest.create(leaveFields(ids.employee2))).id;
  ids.adminApproveLeave = (await LeaveRequest.create(
    { ...leaveFields(ids.employee2), status: 'hr-reviewed' },
  )).id;
  ids.adminRejectLeave = (await LeaveRequest.create(
    { ...leaveFields(ids.employee2), status: 'hr-reviewed' },
  )).id;
  ids.cancelLeave = (await LeaveRequest.create(leaveFields(employee.id))).id;

  ids.leaveBalance = (await LeaveBalance.create({
    employeeId: employee.id, leaveType: 'vacation', year: new Date().getFullYear(),
    entitledDays: 12, usedDays: 0, remainingDays: 12,
  })).id;

  const application = await mk(JobApplication,
    { jobId: job.id, firstName: 'Applicant', lastName: 'Matrix',
      email: 'applicant@matrix.test', phone: '09170000001', status: 'pending' },
    { jobId: job.id, firstName: 'Applicant', lastName: 'Two',
      email: 'applicant2@matrix.test', phone: '09170000002', status: 'pending' },
    'application');

  const interviewFields = (appId: number) => ({
    applicationId: appId, type: 'initial',
    scheduledDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
    scheduledTime: '10:00', interviewer: 'admin Matrix', mode: 'onsite', result: 'pending',
  });
  // The interview service refuses to schedule against an application still in
  // 'pending' ("Cannot schedule interview for application in ... status"), so
  // POST /hrms/interviews needs one that has already been reviewed.
  ids.reviewedApplication = (await JobApplication.create({
    jobId: job.id, firstName: 'Reviewed', lastName: 'Candidate',
    email: 'reviewed@matrix.test.com', status: 'reviewed',
  })).id;

  const interview = await mk(Interview, interviewFields(application.id), interviewFields(ids.applicationTarget), 'interview');

  const payroll = await mk(Payroll,
    { period: 'MTX-2024-01-A', startDate: new Date('2024-01-01'), endDate: new Date('2024-01-15'),
      status: 'draft', totalNetPay: 0 },
    { period: 'MTX-2024-01-B', startDate: new Date('2024-01-16'), endDate: new Date('2024-01-31'),
      status: 'draft', totalNetPay: 0 },
    'payroll');
  ids.processPayroll = (await Payroll.create({
    period: 'MTX-2024-02-A', startDate: new Date('2024-02-01'), endDate: new Date('2024-02-15'),
    status: 'draft', totalNetPay: 0,
  })).id;
  ids.payPayroll = (await Payroll.create({
    period: 'MTX-2024-02-B', startDate: new Date('2024-02-16'), endDate: new Date('2024-02-29'),
    status: 'processed', totalNetPay: 0,
  })).id;

  const attendance = await mk(Attendance,
    { employeeId: employee.id, date: new Date().toISOString().split('T')[0], status: 'present' },
    { employeeId: ids.employee2, date: new Date().toISOString().split('T')[0], status: 'present' },
    'attendance');

  const notification = await mk(Notification,
    { userId: ids.user_admin, type: 'low_stock', title: 'Matrix low stock',
      message: 'Matrix fixture notification', data: { productId: ids.lowStockProduct } },
    { userId: ids.user_admin, type: 'low_stock', title: 'Matrix low stock two',
      message: 'Matrix fixture notification target', data: { productId: ids.lowStockProduct } },
    'notification');

  ids.loyalty = (await LoyaltyPoint.create({
    customerId: customer.id, points: 120, type: 'earned', description: 'Matrix fixture points',
  })).id;

  // A real file on disk so GET /hrms/employee-documents/:id/download streams
  // instead of 404ing on a missing path.
  const fs = require('fs');
  const nodePath = require('path');
  // Snapshot upload directories before any route leg runs. Multipart happy legs
  // generate random filenames, so tracking only our deterministic fixture paths
  // would still leave uploads behind. close() removes precisely the files that
  // appeared after this snapshot, never pre-existing developer data.
  const uploadsRoot = nodePath.resolve(process.env.UPLOAD_DIR || 'uploads');
  const snapshotDir = (name: string) => {
    const dir = nodePath.join(uploadsRoot, name);
    fs.mkdirSync(dir, { recursive: true });
    return { dir, files: fs.readdirSync(dir) };
  };
  ids.matrixUploadBaselines = ['products', 'documents', 'resumes'].map(snapshotDir);
  ids.matrixFixtureFiles = [];
  const docDir = nodePath.join(uploadsRoot, 'documents');
  // Every document row needs its OWN file: empDocCtrl.delete() unlinks the row's
  // file from disk, and the matrix's DELETE leg runs before the GET download leg
  // in path order. Sharing one filename meant the DELETE removed the file the
  // stable download row still pointed at, so the download 404'd.
  const writeDoc = (name: string): string => {
    const filePath = nodePath.join(docDir, name);
    fs.writeFileSync(filePath, `matrix employee document fixture: ${name}\n`);
    ids.matrixFixtureFiles.push(filePath);
    return name;
  };
  const docFields = (empId: number, name: string) => ({
    employeeId: empId, originalName: name, filename: name,
    mimeType: 'text/plain',
    size: fs.statSync(nodePath.join(docDir, name)).size,
    uploadedBy: ids.user_admin,
  });
  const docName = writeDoc('matrix-fixture.txt');
  const empDoc = await mk(EmployeeDocument,
    docFields(employee.id, docName),
    docFields(ids.employee2, writeDoc('matrix-fixture-target.txt')),
    'employeeDocument');
  ids.documentFilename = docName;

  // A disposable user for DELETE/PUT /users/:id, which deactivate the account.
  // A stable read-only user for GET /users/:id, plus the disposal pool the
  // mutating legs draw from. RESOURCE_ID_KEYS maps `users` -> `user`, so the
  // pool key must be `user` for the allocation to line up.
  ids.user = (await User.create({
    firstName: 'stable', lastName: 'Matrix', email: 'stable-user@matrix.test.com',
    password: MATRIX_PASSWORD, roleId: roleBySlug.employee.id, isActive: true,
  })).id;
  ids.userTarget = (await User.create({
    firstName: 'target', lastName: 'Matrix', email: 'target-user@matrix.test.com',
    password: MATRIX_PASSWORD, roleId: roleBySlug.cashier.id, isActive: true,
  })).id;

  ids.role = roleBySlug.admin.id;
  void expense; void contract; void leave; void application; void interview;
  void payroll; void attendance; void notification; void empDoc; void pettyCashFund;
  void supplier; void discount; void department; void position; void schedule;
  void expenseCategory; void job; void customer; void branch; void product;
  void pendingSale; void completedSale; void employee; void purchase;

  // ── disposal pools ─────────────────────────────────────────────────────
  // PUT and DELETE legs consume their row, and the matrix runs in path order,
  // so two mutating legs pointed at one row would race (DELETE /categories/:id
  // runs before PUT /categories/:id alphabetically and the PUT then 404s).
  // Each mutating route is allocated its own row round-robin from these pools
  // by route-matrix-runner. Routes that need a specific lifecycle state
  // (approve/terminate/pay/receive/...) use the dedicated fixtures above via an
  // explicit params override instead.
  const POOL_SIZE = 4;
  const pool: Record<string, number[]> = {};
  const buildPool = async (key: string, make: (n: number) => Promise<any>) => {
    pool[key] = [];
    for (let n = 0; n < POOL_SIZE; n++) pool[key].push((await make(n)).id);
  };

  await buildPool('category', (n) => Category.create({
    name: `Pool Category ${n}`, slug: `pool-category-${n}`, description: 'pool fixture',
  }));
  await buildPool('expenseCategory', (n) => ExpenseCategory.create({
    name: `Pool Expense Category ${n}`, slug: `pool-expense-category-${n}`, description: 'pool fixture',
  }));
  await buildPool('branch', (n) => Branch.create({
    name: `Pool Branch ${n}`, code: `POOL${n}`, address: `${n} Pool Way`, city: 'Makati',
    province: 'Metro Manila', phone: `02-8888-100${n}`, isActive: true,
  }));
  await buildPool('supplier', (n) => Supplier.create({
    name: `Pool Supplier ${n}`, contactPerson: `Pool Contact ${n}`,
    email: `pool${n}@matrix-supplier.test`, phone: `(02) 8000-100${n}`,
    address: `${n} Pool Ave`, city: 'Makati', province: 'Metro Manila', paymentTerms: 'Net 30',
  }));
  await buildPool('product', (n) => Product.create({
    ...productFields(100 + n, 30, 10), slug: `pool-product-${n}`, sku: `POOL-${String(n).padStart(3, '0')}`,
    barcode: `48000888800${String(n).padStart(2, '0')}`,
  }));
  await buildPool('customer', (n) => Customer.create({
    firstName: `Pool${n}`, lastName: 'Customer', email: `pool${n}@matrix-customer.test`,
    mobile: `091800000${String(n).padStart(2, '0')}`, city: 'Manila', province: 'Metro Manila',
  }));
  await buildPool('discount', (n) => Discount.create({
    name: `Pool Promo ${n}`, code: `POOL${n}OFF`, type: 'percentage', value: 5,
    minPurchaseAmount: 0, isActive: true, ...discountWindow,
  }));
  await buildPool('expense', (n) => Expense.create({
    expenseCategoryId: expenseCategory.id, userId: ids.user_admin, amount: 100 + n,
    description: `Pool expense ${n}`, date: new Date(),
  }));
  await buildPool('pettyCashFund', (n) => PettyCashFund.create({
    name: `Pool Fund ${n}`, initialBalance: 1000, currentBalance: 1000,
    description: 'pool fixture', status: 'active',
  }));
  await buildPool('notification', (n) => Notification.create({
    userId: ids.user_admin, type: 'low_stock', title: `Pool notification ${n}`,
    message: 'pool fixture', data: { productId: ids.lowStockProduct },
  }));
  await buildPool('user', (n) => User.create({
    firstName: `pool${n}`, lastName: 'Matrix', email: `pool-user-${n}@matrix.test.com`,
    password: MATRIX_PASSWORD, roleId: roleBySlug.employee.id, isActive: true,
  }));
  await buildPool('department', (n) => Department.create({
    name: `Pool Department ${n}`, description: 'pool fixture',
  }));
  await buildPool('position', (n) => Position.create({
    title: `Pool Position ${n}`, departmentId: department.id, roleSlug: 'employee',
    minSalary: 13000, maxSalary: 16000,
  }));
  await buildPool('schedule', (n) => Schedule.create({
    name: `Pool Schedule ${n}`, startTime: '09:00', endTime: '18:00',
    daysOfWeek: [1, 2, 3, 4, 5], breakMinutes: 60,
  }));
  // Pool employees are deliberately NOT linked to a matrix User: mutating legs
  // such as DELETE /hrms/employees/:id deactivate the linked User, which would
  // 401 every later leg for that role.
  await buildPool('employee', (n) => Employee.create(
    empFields(`MTX-1${String(n).padStart(3, '0')}`, `Pool${n}`, `pool-emp-${n}@matrix.test`),
  ));
  await buildPool('job', (n) => JobPosting.create(jobFields(`Pool Opening ${n}`)));
  await buildPool('contract', (n) => Contract.create({
    employeeId: ids.employee2, contractType: 'regular', status: 'pending',
    startDate: new Date('2024-01-01'),
    endDate: new Date(Date.now() + 200 * 86400000), paymentFrequency: 'monthly',
  }));
  await buildPool('leave', (n) => LeaveRequest.create(leaveFields(ids.employee2)));
  await buildPool('application', (n) => JobApplication.create({
    jobId: job.id, firstName: `Pool${n}`, lastName: 'Applicant',
    email: `pool-applicant-${n}@matrix.test`, status: 'pending',
  }));
  await buildPool('interview', (n) => Interview.create(interviewFields(ids.applicationTarget)));
  await buildPool('payroll', (n) => Payroll.create({
    period: `MTX-POOL-${n}`, startDate: new Date('2024-03-01'),
    endDate: new Date('2024-03-15'), status: 'draft', totalNetPay: 0,
  }));
  await buildPool('attendance', (n) => Attendance.create({
    employeeId: ids.employee2,
    date: new Date(Date.now() - (n + 1) * 86400000).toISOString().split('T')[0],
    status: 'present',
  }));
  await buildPool('employeeDocument', (n) => {
    const name = writeDoc(`matrix-fixture-pool-${n}.txt`);
    return EmployeeDocument.create(docFields(ids.employee2, name));
  });
  await buildPool('sale', async (n) => mkSale('cash', 'completed', `MTX-POOL-${String(n).padStart(4, '0')}`));
  await buildPool('purchase', async (n) => mkPurchase(`MTX-POOL-PO-${n}`));
  ids.pool = pool;

  // A shift assignment, so DELETE /hrms/schedules/assignments/:id and the
  // assignments/permanent schedule legs have a real row.
  ids.shiftAssignment = (await models.ShiftAssignment.create({
    employeeId: ids.employee2, scheduleId: schedule.id,
    date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
  })).id;
  ids.permanentAssignment = (await models.ShiftAssignment.create({
    employeeId: ids.employee2, scheduleId: schedule.id, isPermanent: true,
    date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
  })).id;

  // A resume on disk, so GET /hrms/jobs/applications/resume/:filename streams a
  // real file instead of 404ing. text/plain is accepted by
  // validateFileSignature (no NUL byte in the first 512).
  const resumeDir = nodePath.resolve(process.env.UPLOAD_DIR || 'uploads', 'resumes');
  fs.mkdirSync(resumeDir, { recursive: true });
  const resumeName = 'matrix-resume.txt';
  const resumePath = nodePath.join(resumeDir, resumeName);
  fs.writeFileSync(resumePath, 'Matrix fixture resume\n');
  ids.matrixFixtureFiles.push(resumePath);
  ids.resumeFilename = resumeName;
  await models.JobApplication.update(
    { resumePath: `/uploads/resumes/${resumeName}` },
    { where: { id: ids.application } },
  );

  ids.productBarcode = product.barcode;
  ids.models = models;
  return ids;
}

/**
 * Boot the matrix app. Call from beforeAll; pair with ctx.close() in afterAll.
 */
export async function startRouteMatrix(): Promise<RouteMatrixContext> {
  const models = require('../../src/models');
  const { sequelize } = models;

  await sequelize.authenticate();
  await sequelize.sync({ force: true });

  const ids = await seedMatrix(models);

  const { server } = require('../../src/app');
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const apiBase = `${baseUrl}/api/v1`;

  const http = axios.create({ timeout: 20000, validateStatus: () => true });

  // Tokens come from the real login route, not from a hand-signed JWT: the
  // matrix must exercise cookie/refresh/blacklist behaviour too.
  const tokens = {} as Record<RoleSlug, string>;
  for (const role of ROLES) {
    const res = await http.post(`${apiBase}/auth/login`, {
      email: matrixEmail(role),
      password: MATRIX_PASSWORD,
    });
    if (res.status !== 200 || !res.data?.data?.token) {
      throw new Error(`matrix login failed for ${role}: HTTP ${res.status} ${JSON.stringify(res.data)}`);
    }
    tokens[role] = res.data.data.token as string;
  }

  // Signing goes through the real service so the payload shape ({ id, jti })
  // and the secret/expiry config can never drift from production.
  const authService = require('../../src/services/auth.service');
  const mint = (userId: number): string => authService.generateToken(userId);

  return {
    baseUrl,
    apiBase,
    http,
    models,
    sequelize,
    server,
    tokens,
    mint,
    ids,
    close: async () => {
      try {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      } catch { /* already closed */ }
      try { await sequelize.close(); } catch { /* already closed */ }
      // DELETE document legs may already have unlinked some files; ENOENT is
      // expected. Never touch a non-matrix upload.
      const fs = require('fs');
      const nodePath = require('path');
      for (const filePath of ids.matrixFixtureFiles || []) {
        try { fs.unlinkSync(filePath); } catch { /* already deleted */ }
      }
      for (const baseline of ids.matrixUploadBaselines || []) {
        try {
          const prior = new Set(baseline.files);
          for (const name of fs.readdirSync(baseline.dir)) {
            if (!prior.has(name)) fs.rmSync(nodePath.join(baseline.dir, name), { recursive: true, force: true });
          }
        } catch { /* upload directory was removed or is unavailable */ }
      }
    },
  };
}

export type MatrixResponse = { status: number; data: any; headers: any };

/** Issue a matrix request. `token` omitted => unauthenticated leg. */
export interface MatrixRequestOptions {
  token?: string;
  body?: any;
  params?: any;
  headers?: Record<string, string>;
  /** Encode the body as multipart/form-data and attach this file part. */
  multipart?: { field: string; filename: string; mimetype: string; contentB64: string };
}

export async function matrixRequest(
  ctx: RouteMatrixContext,
  method: string,
  url: string,
  opts: MatrixRequestOptions = {},
): Promise<MatrixResponse> {
  const headers: Record<string, string> = { ...(opts.headers || {}) };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  let data = opts.body;
  if (opts.multipart) {
    // Node 18+ provides FormData/Blob globally; axios sets the multipart
    // boundary itself, so no Content-Type header is added here.
    const form = new FormData();
    for (const [k, v] of Object.entries(opts.body || {})) {
      if (v !== undefined && v !== null) form.append(k, String(v));
    }
    const bytes = new Uint8Array(Buffer.from(opts.multipart.contentB64, 'base64'));
    form.append(
      opts.multipart.field,
      new Blob([bytes as any], { type: opts.multipart.mimetype }),
      opts.multipart.filename,
    );
    data = form;
  }

  const res = await ctx.http.request({
    method: method.toLowerCase() as any,
    url: url.startsWith('http') ? url : `${ctx.apiBase}${url}`,
    data,
    params: opts.params,
    headers,
    maxRedirects: 0,
  });
  return { status: res.status, data: res.data, headers: res.headers };
}
