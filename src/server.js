// Bootstrap: connect DB, auto-setup, cron jobs, listen.
// The Express app itself lives in src/app.js so integration tests can
// build it against a test database without binding a port.
const config = require('./config');
const { connectDB } = require('./config/database');
const cron = require('node-cron');
const { app, io, server } = require('./app');


// â”€â”€â”€ Scheduled Tasks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const { sequelize } = require('./config/database');

const scheduleLowStockCheck = () => {
  cron.schedule('0 */6 * * *', async () => {
    try {
      const inventoryService = require('./services/inventory.service');
      const result = await inventoryService.checkLowStock();
      console.log(`Low stock check completed: ${result.count} products low on stock`);
    } catch (error) {
      console.error('Low stock check failed:', error.message);
    }
  });
};

const scheduleExpiryCheck = () => {
  cron.schedule('0 0 * * *', async () => {
    try {
      const inventoryService = require('./services/inventory.service');
      const result = await inventoryService.checkExpiringProducts();
      console.log(`Expiry check completed: ${result.count} products expiring soon`);
    } catch (error) {
      console.error('Expiry check failed:', error.message);
    }
  });
};

const scheduleTokenCleanup = () => {
  cron.schedule('0 3 * * *', async () => {
    try {
      const { BlacklistedToken } = require('./models');
      const { Op } = require('sequelize');
      const deleted = await BlacklistedToken.destroy({ where: { expiresAt: { [Op.lt]: new Date() } } });
      console.log(`Token cleanup: removed ${deleted} expired blacklisted tokens`);
    } catch (error) {
      console.error('Token cleanup failed:', error.message);
    }
  });
};

const scheduleContractExpiryCheck = () => {
  cron.schedule('0 6 * * *', async () => {
    try {
      const contractService = require('./services/hrms/contract.service');
      const result = await contractService.checkExpired();
      console.log(`Contract expiry check completed: ${result.expired} contracts expired`);
    } catch (error) {
      console.error('Contract expiry check failed:', error.message);
    }
  });
};

// â”€â”€â”€ Start Server â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let srv;

const runAutoSetup = async () => {
  try {
    const { Role, User, Category, ExpenseCategory, Product, Customer, Supplier, Department, Position, Schedule, Discount, Permission, Employee, Branch, JobPosting } = require('./models');
    const { sequelize: db } = require('./config/database');

    const isSQLite = config.dbDialect === 'sqlite';
    const safeAddColumn = async (table, column, type) => {
      try {
        if (isSQLite) {
          const [results] = await db.query(`PRAGMA table_info(${table})`);
          const colNames = results.map(c => c.name);
          if (!colNames.includes(column)) {
            await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
            console.log(`Added column ${table}.${column}`);
          }
        } else {
          const [results] = await db.query(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
            [table, column]
          );
          if (results.length === 0) {
            await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
            console.log(`Added column ${table}.${column}`);
          }
        }
      } catch (e) {
        console.log(`Column ${table}.${column} already exists or skip: ${e.message}`);
      }
    };

    // sequelize.sync() only creates indexes when it CREATES a table; it never
    // adds them to an existing one. On an already-deployed SQLite file that
    // means model-level `indexes: []` entries silently never appear, so indexes
    // are created explicitly here. Idempotent: skipped if already present.
    const safeAddIndex = async (table, name, columns) => {
      try {
        const [existing] = await db.query(`PRAGMA index_list(${table})`);
        if ((existing || []).some(i => i.name === name)) return false;
        await db.query(`CREATE INDEX ${name} ON ${table} (${columns.join(', ')})`);
        console.log(`Created index ${name} on ${table}(${columns.join(', ')})`);
        return true;
      } catch (e) {
        console.log(`Index ${name} skipped: ${e.message}`);
        return false;
      }
    };

    const safeModifyEnum = async (table, column, enumDef) => {
      // SQLite ignores ENUM; this runs only for MySQL (isSQLite false) to widen ENUM
      if (isSQLite) return;
      try {
        const [prev] = await db.query(
          `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
          [table, column]
        );
        if (prev && prev[0] && prev[0].COLUMN_TYPE && prev[0].COLUMN_TYPE.toLowerCase().includes('enum')) {
          const fullEnum = `ENUM(${enumDef})`;
          await db.query(`ALTER TABLE ${table} MODIFY COLUMN ${column} ${fullEnum}`);
          console.log(`Modified ENUM ${table}.${column}`);
        }
      } catch (e) {
        console.log(`ENUM modify ${table}.${column} skipped: ${e.message}`);
      }
    };

    await safeAddColumn('users', 'branch_id', 'INTEGER');
    await safeAddColumn('users', 'reports_to_id', 'INTEGER');
    await safeAddColumn('products', 'branch_id', 'INTEGER');
    await safeAddColumn('products', 'supplier_id', 'INTEGER');
    await safeAddColumn('sales', 'branch_id', 'INTEGER');
    await safeAddColumn('attendances', 'night_shift_hours', "DECIMAL(5,2) DEFAULT 0");
    await safeAddColumn('attendances', 'meal_break_minutes', "INTEGER DEFAULT 60");
    await safeAddColumn('attendances', 'late_minutes', "INTEGER DEFAULT 0");
    await safeAddColumn('attendances', 'is_rest_day', "BOOLEAN DEFAULT 0");
    await safeAddColumn('attendances', 'holiday_type', "VARCHAR(20) DEFAULT 'none'");
    await safeAddColumn('attendances', 'is_overtime_approved', "BOOLEAN DEFAULT 0");
    await safeAddColumn('job_postings', 'closing_date', 'DATE');
      await safeAddColumn('job_postings', 'location', 'VARCHAR(100)');
      await safeAddColumn('suppliers', 'mobile', 'VARCHAR(20)');
      await safeAddColumn('suppliers', 'city', 'VARCHAR(100)');
      await safeAddColumn('suppliers', 'province', 'VARCHAR(100)');
      await safeAddColumn('suppliers', 'postal_code', 'VARCHAR(10)');
      await safeAddColumn('suppliers', 'tax_id', 'VARCHAR(50)');
      await safeAddColumn('suppliers', 'payment_terms', 'VARCHAR(50)');
      await safeAddColumn('suppliers', 'latitude', 'DECIMAL(10,7)');
      await safeAddColumn('suppliers', 'longitude', 'DECIMAL(10,7)');
      await safeAddColumn('employees', 'middle_name', 'VARCHAR(100)');
      await safeAddColumn('employees', 'civil_status', 'VARCHAR(20)');
      await safeAddColumn('employees', 'nationality', 'VARCHAR(50)');
      await safeAddColumn('employees', 'education_level', 'VARCHAR(50)');
      await safeAddColumn('employees', 'tin_number', 'VARCHAR(20)');
      await safeAddColumn('employees', 'sss_number', 'VARCHAR(20)');
      await safeAddColumn('employees', 'phil_health_number', 'VARCHAR(20)');
      await safeAddColumn('employees', 'pag_ibig_number', 'VARCHAR(20)');
      await safeAddColumn('employees', 'bank_name', 'VARCHAR(100)');
      await safeAddColumn('employees', 'bank_account_number', 'VARCHAR(50)');
      await safeAddColumn('employees', 'emergency_contact_name', 'VARCHAR(200)');
      await safeAddColumn('employees', 'emergency_contact_phone', 'VARCHAR(20)');
      await safeAddColumn('employees', 'emergency_contact_relation', 'VARCHAR(50)');
      await safeAddColumn('employees', 'regularization_date', 'DATE');
      await safeAddColumn('employees', 'probationary_end_date', 'DATE');
      await safeAddColumn('employees', 'reports_to_id', 'INTEGER');
      await safeAddColumn('employees', 'termination_type', 'VARCHAR(50)');
      await safeAddColumn('employees', 'termination_date', 'DATE');
      await safeAddColumn('employees', 'payment_frequency', 'VARCHAR(20)');
      await safeAddColumn('contracts', 'payment_frequency', 'VARCHAR(20)');
      await safeAddColumn('job_applications', 'middle_name', 'VARCHAR(100)');
      await safeAddColumn('interviews', 'latitude', 'DECIMAL(10,7)');
      await safeAddColumn('interviews', 'longitude', 'DECIMAL(10,7)');
      await safeAddColumn('positions', 'role_slug', 'VARCHAR(50)');
      await safeAddColumn('sales', 'discount_id', 'INTEGER');

      await safeAddColumn('payrolls', 'paid_at', 'DATETIME');
      await safeAddColumn('purchases', 'payment_source', "VARCHAR(20)");
      await safeAddColumn('purchases', 'change_given', 'DECIMAL(15,2) DEFAULT 0');
      await safeAddColumn('purchases', 'last_paid_at', 'DATETIME');
      // Geofencing support (opt-in per branch).
      await safeAddColumn('branches', 'geofence_radius_meters', 'INTEGER');
      await safeAddColumn('branches', 'enforce_geofence', 'BOOLEAN DEFAULT 0');
      await safeAddColumn('attendances', 'clock_in_lat', 'DECIMAL(10,7)');
      await safeAddColumn('attendances', 'clock_in_lng', 'DECIMAL(10,7)');
      await safeAddColumn('attendances', 'geofence_distance_meters', 'INTEGER');
      await safeAddColumn('attendances', 'is_geofence_verified', 'BOOLEAN');
      // Indexes for existing databases (see safeAddIndex for why this is needed).
      await safeAddIndex('leave_requests', 'idx_leave_employee_start', ['employee_id', 'start_date']);
      await safeAddIndex('leave_requests', 'idx_leave_status', ['status']);
      await safeAddIndex('leave_requests', 'idx_leave_date_range', ['start_date', 'end_date']);
      await safeAddIndex('leave_requests', 'idx_leave_deleted_at', ['deleted_at']);
      await safeAddIndex('payslips', 'idx_payslip_payroll_id', ['payroll_id']);
      await safeAddIndex('payslips', 'idx_payslip_employee_id', ['employee_id']);
      await safeAddIndex('payslips', 'idx_payslip_employee_created', ['employee_id', 'created_at']);
      await safeAddIndex('payslips', 'idx_payslip_deleted_at', ['deleted_at']);
      await safeModifyEnum('notifications', 'type', "'low_stock','expiring_product','new_purchase','new_sale','payment_received','system','stock_adjustment','refund','hrms_leave_request','hrms_leave_approved','hrms_leave_rejected','hrms_interview_scheduled','hrms_application_status','hrms_employee_approved','hrms_contract_terminated','hrms_contract_expired','hrms_payroll_generated','hrms_payroll_paid'");

      await db.sync();
      console.log('Database synced');

      const [inventoryStaffRole] = await Role.findOrCreate({
        where: { slug: 'inventory_staff' },
        defaults: { name: 'Inventory Staff', slug: 'inventory_staff', description: 'Product, supplier, and stock management' }
      });

      const [adminRole] = await Role.findOrCreate({
        where: { slug: 'admin' },
        defaults: { name: 'Admin', slug: 'admin', description: 'Full system access' }
      });
      const [hrRole] = await Role.findOrCreate({
        where: { slug: 'hr' },
        defaults: { name: 'HR', slug: 'hr', description: 'Human resources management' }
      });
      const [managerRole] = await Role.findOrCreate({
        where: { slug: 'manager' },
        defaults: { name: 'Manager', slug: 'manager', description: 'Store manager' }
      });
      const [cashierRole] = await Role.findOrCreate({
        where: { slug: 'cashier' },
        defaults: { name: 'Cashier', slug: 'cashier', description: 'Point of sale operations' }
      });
      const [employeeRole] = await Role.findOrCreate({
        where: { slug: 'employee' },
        defaults: { name: 'Employee', slug: 'employee', description: 'Basic employee access' }
      });

      await User.findOrCreate({
        where: { email: 'admin@minimart.com' },
        defaults:         { firstName: 'Maria', lastName: 'Santos', email: 'admin@minimart.com', password: 'admin123', roleId: adminRole.id, isActive: true }
      });
      await User.findOrCreate({
        where: { email: 'hr@minimart.com' },
        defaults:         { firstName: 'Ana', lastName: 'Reyes', email: 'hr@minimart.com', password: 'hr123', roleId: hrRole.id, isActive: true }
      });
      await User.findOrCreate({
        where: { email: 'manager@minimart.com' },
        defaults:         { firstName: 'Carlos', lastName: 'Garcia', email: 'manager@minimart.com', password: 'admin123', roleId: managerRole.id, isActive: true }
      });
      await User.findOrCreate({
        where: { email: 'cashier@minimart.com' },
        defaults: { firstName: 'Joy', lastName: 'Dela Cruz', email: 'cashier@minimart.com', password: 'cashier123', roleId: cashierRole.id, isActive: true }
      });
      await User.findOrCreate({
        where: { email: 'ligma1@gmail.com' },
        defaults: { firstName: 'Ligma', lastName: 'One', email: 'ligma1@gmail.com', password: 'employee123', roleId: employeeRole.id, isActive: true }
      });
      await User.findOrCreate({
        where: { email: 'inventory@minimart.com' },
        defaults: { firstName: 'Rico', lastName: 'Dela PeÃ±a', email: 'inventory@minimart.com', password: 'inventory123', roleId: inventoryStaffRole.id, isActive: true }
      });

      const seedAccounts = [
        { email: 'admin@minimart.com', password: 'admin123' },
        { email: 'hr@minimart.com', password: 'hr123' },
        { email: 'manager@minimart.com', password: 'admin123' },
        { email: 'cashier@minimart.com', password: 'cashier123' },
        { email: 'ligma1@gmail.com', password: 'employee123' },
        { email: 'inventory@minimart.com', password: 'inventory123' },
      ];
      const bcrypt = require('bcryptjs');
      for (const acct of seedAccounts) {
        const u = await User.findOne({ where: { email: acct.email } });
        if (u) {
          const hashed = await bcrypt.hash(acct.password, 10);
          await User.update({ password: hashed }, { where: { id: u.id }, individualHooks: false });
        }
      }

      console.log('Seed data ready');

      const permissions = [
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

      const permMap = {};
      for (const p of permissions) {
        const [perm] = await Permission.findOrCreate({ where: { slug: p.slug }, defaults: p });
        permMap[p.slug] = perm;
      }
      console.log('Permissions seeded');

      const rolePermissions = {
        admin: Object.values(permMap).map(p => p.id),
        manager: [
          permMap['dashboard.view'], permMap['products.view'], permMap['products.create'], permMap['products.update'],
          permMap['categories.view'], permMap['categories.manage'],
          permMap['customers.view'], permMap['customers.manage'], permMap['customers.delete'],
          permMap['suppliers.view'], permMap['suppliers.manage'], permMap['suppliers.delete'],
          permMap['purchases.view'], permMap['purchases.create'], permMap['purchases.pay'],
          permMap['inventory.view'], permMap['inventory.manage'],
          permMap['expenses.view'], permMap['expenses.manage'],
          permMap['discounts.view'], permMap['discounts.manage'],
          permMap['petty_cash.view'], permMap['petty_cash.manage'],
          permMap['reports.view'], permMap['finance.view'],
          permMap['sales.view'], permMap['sales.create'], permMap['sales.cancel'],
          permMap['branches.view'],
          permMap['activity.view'],
        ].filter(Boolean).map(p => p.id),
        inventory_staff: [
          permMap['dashboard.view'], permMap['products.view'], permMap['products.create'], permMap['products.update'],
          permMap['categories.view'], permMap['categories.manage'],
          permMap['suppliers.view'], permMap['suppliers.manage'],
          permMap['purchases.view'], permMap['purchases.create'],
          permMap['inventory.view'], permMap['inventory.manage'],
        ].filter(Boolean).map(p => p.id),
        cashier: [
          permMap['customers.view'], permMap['customers.manage'],
          permMap['sales.view'], permMap['sales.create'],
        ].filter(Boolean).map(p => p.id),
        hr: [
          permMap['dashboard.view'], permMap['activity.view'],
        ].filter(Boolean).map(p => p.id),
        employee: [
          permMap['dashboard.view'],
        ].filter(Boolean).map(p => p.id),
      };

      const roleSlugToRole = { admin: adminRole, manager: managerRole, inventory_staff: inventoryStaffRole, cashier: cashierRole, hr: hrRole, employee: employeeRole };
      for (const [slug, permIds] of Object.entries(rolePermissions)) {
        const role = roleSlugToRole[slug];
        if (role && permIds.length > 0) {
          await role.setPermissions(permIds);
        }
      }
      console.log('Role permissions assigned');

      const categories = [
        { name: 'Beverages', slug: 'beverages', description: 'Drinks and refreshments' },
        { name: 'Snacks', slug: 'snacks', description: 'Chips, cookies, and light bites' },
        { name: 'Dairy', slug: 'dairy', description: 'Milk, cheese, and other dairy products' },
        { name: 'Bread & Bakery', slug: 'bread-bakery', description: 'Bread, pastries, and baked goods' },
        { name: 'Meat & Seafood', slug: 'meat-seafood', description: 'Fresh and frozen meat and seafood' },
        { name: 'Fruits & Vegetables', slug: 'fruits-vegetables', description: 'Fresh produce' },
        { name: 'Rice & Grains', slug: 'rice-grains', description: 'Rice, pasta, and other grains' },
        { name: 'Canned Goods', slug: 'canned-goods', description: 'Canned and preserved foods' },
        { name: 'Condiments & Sauces', slug: 'condiments-sauces', description: 'Seasonings, sauces, and spices' },
        { name: 'Frozen Foods', slug: 'frozen-foods', description: 'Frozen meals and ice cream' },
        { name: 'Personal Care', slug: 'personal-care', description: 'Hygiene and personal care products' },
        { name: 'Household', slug: 'household', description: 'Cleaning and household supplies' },
        { name: 'Baby Care', slug: 'baby-care', description: 'Baby food, diapers, and essentials' },
        { name: 'Pet Supplies', slug: 'pet-supplies', description: 'Food and supplies for pets' },
        { name: 'Stationery', slug: 'stationery', description: 'Office and school supplies' },
      ];
      const catMap = {};
      for (const cat of categories) {
        const [c, created] = await Category.findOrCreate({ where: { slug: cat.slug }, defaults: cat });
        const id = c ? (c.id || c.dataValues.id) : null;
        catMap[cat.slug] = id;
        console.log(`Category: ${cat.name} -> ID ${id} (created: ${created})`);
      }
      console.log('Categories seeded');

      const expenseCategories = [
        { name: 'Rent', slug: 'rent', description: 'Monthly store rental' },
        { name: 'Utilities', slug: 'utilities', description: 'Electricity, water, internet' },
        { name: 'Salaries', slug: 'salaries', description: 'Employee salaries and wages' },
        { name: 'Supplies', slug: 'supplies', description: 'Office and store supplies' },
        { name: 'Maintenance', slug: 'maintenance', description: 'Equipment and facility maintenance' },
        { name: 'Marketing', slug: 'marketing', description: 'Advertising and promotions' },
        { name: 'Transportation', slug: 'transportation', description: 'Delivery and logistics' },
        { name: 'Cost of Goods', slug: 'cost-of-goods', description: 'Payments to suppliers for purchased inventory' },
        { name: 'Miscellaneous', slug: 'miscellaneous', description: 'Other expenses' },
      ];
      for (const ec of expenseCategories) {
        await ExpenseCategory.findOrCreate({ where: { slug: ec.slug }, defaults: ec });
      }
      console.log('Expense categories seeded');

      const suppliers = [
        { name: 'San Miguel Foods Corp.', contactPerson: 'Juan Dela Cruz', email: 'juan@sanmiguel.com', phone: '(02) 8888-1234', mobile: '0917-123-4567', address: '40 San Miguel Ave', city: 'Mandaluyong', province: 'Metro Manila', paymentTerms: 'Net 30' },
        { name: 'Universal Robina Corp.', contactPerson: 'Maria Santos', email: 'maria@urc.com', phone: '(02) 8633-8000', mobile: '0918-234-5678', address: '2228 Pasong Tamo', city: 'Makati', province: 'Metro Manila', paymentTerms: 'Net 15' },
        { name: 'Jollibee Foods Corp.', contactPerson: 'Pedro Reyes', email: 'pedro@jollibee.com', phone: '(02) 8888-7000', mobile: '0920-345-6789', address: '10 E. Rodriguez Jr. Ave', city: 'Quezon City', province: 'Metro Manila', paymentTerms: 'Net 30' },
        { name: 'Purefoods Hormel', contactPerson: 'Ana Cruz', email: 'ana@purefoods.com', phone: '(02) 8651-8000', mobile: '0917-456-7890', address: '77 Cybergate', city: 'Mandaluyong', province: 'Metro Manila', paymentTerms: 'Net 30' },
        { name: 'Nestle Philippines', contactPerson: 'Luis Garcia', email: 'luis@nestle.com', phone: '(02) 8989-7000', mobile: '0918-567-8901', address: '32rockefeller', city: 'Makati', province: 'Metro Manila', paymentTerms: 'Net 45' },
      ];
      for (const s of suppliers) {
        await Supplier.findOrCreate({ where: { name: s.name }, defaults: s });
      }
      console.log('Suppliers seeded');

      const branches = [
        { name: 'Main Branch - Makati', code: 'MAIN', address: '123 Ayala Ave, Makati City', city: 'Makati', province: 'Metro Manila', phone: '02-8888-1234', latitude: 14.5547, longitude: 121.05 },
        { name: 'BGC Branch', code: 'BGC', address: '456 Bonifacio High Street, Taguig City', city: 'Taguig', province: 'Metro Manila', phone: '02-8888-5678', latitude: 14.5505, longitude: 121.0487 },
        { name: 'Quezon City Branch', code: 'QC', address: '789 Tomas Morato Ave, Quezon City', city: 'Quezon City', province: 'Metro Manila', phone: '02-8888-9012', latitude: 14.6333, longitude: 121.0333 },
        { name: 'Cebu Branch', code: 'CEB', address: '101 Osmena Blvd, Cebu City', city: 'Cebu City', province: 'Cebu', phone: '032-8888-3456', latitude: 10.3157, longitude: 123.8854 },
        { name: 'Davao Branch', code: 'DVO', address: '202 Rizal Ave, Davao City', city: 'Davao City', province: 'Davao del Sur', phone: '082-8888-7890', latitude: 7.0731, longitude: 125.4553 },
      ];
      for (const b of branches) {
        await Branch.findOrCreate({ where: { code: b.code }, defaults: b });
      }
      console.log('Branches seeded');

      const products = [
        { name: 'Coca-Cola 1.5L', slug: 'coca-cola-15l', sku: 'BEV-001', barcode: '4800012345001', categoryId: catMap['beverages'], brand: 'Coca-Cola', unit: 'pcs', buyingPrice: 38, sellingPrice: 52, stockQuantity: 48, minStockLevel: 12, supplierId: 1 },
        { name: 'Pepsi 500ml', slug: 'pepsi-500ml', sku: 'BEV-002', barcode: '4800012345002', categoryId: catMap['beverages'], brand: 'Pepsi', unit: 'pcs', buyingPrice: 18, sellingPrice: 25, stockQuantity: 72, minStockLevel: 20, supplierId: 1 },
        { name: 'Lipton Iced Tea 1L', slug: 'lipton-iced-tea-1l', sku: 'BEV-003', barcode: '4800012345003', categoryId: catMap['beverages'], brand: 'Lipton', unit: 'pcs', buyingPrice: 28, sellingPrice: 38, stockQuantity: 36, minStockLevel: 10, supplierId: 1 },
        { name: 'Summit Water 500ml', slug: 'summit-water-500ml', sku: 'BEV-004', barcode: '4800012345004', categoryId: catMap['beverages'], brand: 'Summit', unit: 'pcs', buyingPrice: 6, sellingPrice: 10, stockQuantity: 96, minStockLevel: 24, supplierId: 1 },
        { name: 'Lays Classic Salted', slug: 'lays-classic', sku: 'SNK-001', barcode: '4800012345005', categoryId: catMap['snacks'], brand: 'Lays', unit: 'pcs', buyingPrice: 28, sellingPrice: 38, stockQuantity: 30, minStockLevel: 10, supplierId: 2 },
        { name: 'Oishi Prawn Crackers', slug: 'oishi-prawn', sku: 'SNK-002', barcode: '4800012345006', categoryId: catMap['snacks'], brand: 'Oishi', unit: 'pcs', buyingPrice: 12, sellingPrice: 18, stockQuantity: 48, minStockLevel: 12, supplierId: 2 },
        { name: 'Jack n Jill Clorets', slug: 'clorets-gum', sku: 'SNK-003', barcode: '4800012345007', categoryId: catMap['snacks'], brand: 'Jack n Jill', unit: 'pcs', buyingPrice: 8, sellingPrice: 12, stockQuantity: 60, minStockLevel: 15, supplierId: 2 },
        { name: 'Nestle Fresh Milk 1L', slug: 'nestle-fresh-milk', sku: 'DRY-001', barcode: '4800012345008', categoryId: catMap['dairy'], brand: 'Nestle', unit: 'pcs', buyingPrice: 65, sellingPrice: 85, stockQuantity: 24, minStockLevel: 8, supplierId: 5 },
        { name: 'Magnolia Ice Cream', slug: 'magnolia-icecream', sku: 'FRZ-001', barcode: '4800012345009', categoryId: catMap['frozen-foods'], brand: 'Magnolia', unit: 'pcs', buyingPrice: 85, sellingPrice: 110, stockQuantity: 12, minStockLevel: 6, supplierId: 3 },
        { name: 'Gardenia Bread', slug: 'gardenia-bread', sku: 'BRD-001', barcode: '4800012345010', categoryId: catMap['bread-bakery'], brand: 'Gardenia', unit: 'pcs', buyingPrice: 35, sellingPrice: 48, stockQuantity: 20, minStockLevel: 8, supplierId: 3 },
        { name: 'Royal Pasta 500g', slug: 'royal-pasta', sku: 'GRN-001', barcode: '4800012345011', categoryId: catMap['rice-grains'], brand: 'Royal', unit: 'pcs', buyingPrice: 32, sellingPrice: 45, stockQuantity: 36, minStockLevel: 10, supplierId: 4 },
        { name: 'Datu Puti Vinegar 500ml', slug: 'datu-puti-vinegar', sku: 'CND-001', barcode: '4800012345012', categoryId: catMap['condiments-sauces'], brand: 'Datu Puti', unit: 'pcs', buyingPrice: 18, sellingPrice: 25, stockQuantity: 40, minStockLevel: 10, supplierId: 4 },
        { name: 'Silver Swan Soy Sauce', slug: 'silver-swan-soy', sku: 'CND-002', barcode: '4800012345013', categoryId: catMap['condiments-sauces'], brand: 'Silver Swan', unit: 'pcs', buyingPrice: 16, sellingPrice: 22, stockQuantity: 36, minStockLevel: 10, supplierId: 4 },
        { name: 'Century Tuna 155g', slug: 'century-tuna', sku: 'CND-003', barcode: '4800012345014', categoryId: catMap['canned-goods'], brand: 'Century', unit: 'pcs', buyingPrice: 22, sellingPrice: 32, stockQuantity: 48, minStockLevel: 12, supplierId: 4 },
        { name: 'Lucky Me Pancit Canton', slug: 'lucky-me-canton', sku: 'FRZ-002', barcode: '4800012345015', categoryId: catMap['frozen-foods'], brand: 'Lucky Me', unit: 'pcs', buyingPrice: 10, sellingPrice: 15, stockQuantity: 80, minStockLevel: 20, supplierId: 3 },
        { name: 'Dove Shampoo 350ml', slug: 'dove-shampoo', sku: 'PRC-001', barcode: '4800012345016', categoryId: catMap['personal-care'], brand: 'Dove', unit: 'pcs', buyingPrice: 150, sellingPrice: 195, stockQuantity: 18, minStockLevel: 6, supplierId: 5 },
        { name: 'Pride Dishwashing Liquid', slug: 'pride-dishwash', sku: 'HH-001', barcode: '4800012345017', categoryId: catMap['household'], brand: 'Pride', unit: 'pcs', buyingPrice: 35, sellingPrice: 48, stockQuantity: 24, minStockLevel: 8, supplierId: 5 },
        { name: 'Bear Brand Powder Milk', slug: 'bear-brand', sku: 'DRY-002', barcode: '4800012345018', categoryId: catMap['dairy'], brand: 'Bear Brand', unit: 'pcs', buyingPrice: 55, sellingPrice: 72, stockQuantity: 30, minStockLevel: 10, supplierId: 5 },
        { name: 'Jasmine Rice 5kg', slug: 'jasmine-rice-5kg', sku: 'GRN-002', barcode: '4800012345019', categoryId: catMap['rice-grains'], brand: 'Jasmine', unit: 'bag', buyingPrice: 220, sellingPrice: 285, stockQuantity: 15, minStockLevel: 5, supplierId: 4 },
        { name: 'C2 Green Tea 500ml', slug: 'c2-green-tea', sku: 'BEV-005', barcode: '4800012345020', categoryId: catMap['beverages'], brand: 'C2', unit: 'pcs', buyingPrice: 15, sellingPrice: 22, stockQuantity: 48, minStockLevel: 12, supplierId: 2 },
      ];
      for (const p of products) {
        const defaults = { ...p, image: `/uploads/products/${p.slug}.svg` };
        const [prod, created] = await Product.findOrCreate({ where: { slug: p.slug }, defaults });
        if (!created) {
          if (!prod.supplierId && p.supplierId) {
            await prod.update({ supplierId: p.supplierId });
          }
          if (!prod.image) {
            await prod.update({ image: defaults.image });
          }
        }
      }
      console.log('Products seeded');

      const customers = [
        { firstName: 'Walk-in', lastName: 'Customer', phone: null },
        { firstName: 'Juan', lastName: 'Dela Cruz', email: 'juan.delacruz@email.com', phone: '(02) 8123-4567', mobile: '0917-111-2222', address: '123 Rizal St', city: 'Manila', province: 'Metro Manila' },
        { firstName: 'Maria', lastName: 'Clara', email: 'maria.clara@email.com', phone: '(02) 8234-5678', mobile: '0918-222-3333', address: '456 Mabini Ave', city: 'Quezon City', province: 'Metro Manila' },
        { firstName: 'Jose', lastName: 'Rizal', email: 'jose.rizal@email.com', phone: '(02) 8345-6789', mobile: '0920-333-4444', address: '789 Bonifacio Blvd', city: 'Makati', province: 'Metro Manila' },
        { firstName: 'Andres', lastName: 'Bonifacio', email: 'andres.bonifacio@email.com', mobile: '0917-444-5555', address: '321 Aguinaldo Hwy', city: 'Pasig', province: 'Metro Manila' },
        { firstName: 'Gregorio', lastName: 'Del Pilar', email: 'gregorio.delpilar@email.com', mobile: '0918-555-6666', address: '654 Luna St', city: 'Mandaluyong', province: 'Metro Manila' },
      ];
      for (const c of customers) {
        const where = c.email ? { email: c.email } : { firstName: c.firstName, lastName: c.lastName };
        await Customer.findOrCreate({ where, defaults: c });
      }
      console.log('Customers seeded');

      const departments = [
        { name: 'Operations', description: 'Store operations and daily management' },
        { name: 'Human Resources', description: 'HR and people management' },
        { name: 'Finance', description: 'Accounting and financial management' },
        { name: 'Sales', description: 'Sales and customer relations' },
        { name: 'Warehouse', description: 'Inventory and warehouse management' },
      ];
      const deptMap = {};
      for (const d of departments) {
        const [dept] = await Department.findOrCreate({ where: { name: d.name }, defaults: d });
        deptMap[d.name] = dept.id;
      }
      console.log('Departments seeded');

      const positions = [
        { title: 'Store Manager', departmentId: deptMap.Operations, minSalary: 25000, maxSalary: 40000, roleSlug: 'manager' },
        { title: 'Shift Supervisor', departmentId: deptMap.Operations, minSalary: 18000, maxSalary: 25000, roleSlug: 'manager' },
        { title: 'Cashier', departmentId: deptMap.Operations, minSalary: 13000, maxSalary: 18000, roleSlug: 'cashier' },
        { title: 'Sales Associate', departmentId: deptMap.Sales, minSalary: 13000, maxSalary: 18000, roleSlug: 'employee' },
        { title: 'HR Officer', departmentId: deptMap['Human Resources'], minSalary: 20000, maxSalary: 30000, roleSlug: 'hr' },
        { title: 'Accountant', departmentId: deptMap.Finance, minSalary: 22000, maxSalary: 35000, roleSlug: 'employee' },
        { title: 'Warehouse Staff', departmentId: deptMap.Warehouse, minSalary: 13000, maxSalary: 18000, roleSlug: 'inventory_staff' },
        { title: 'Inventory Clerk', departmentId: deptMap.Warehouse, minSalary: 13000, maxSalary: 17000, roleSlug: 'inventory_staff' },
      ];
      const posMap = {};
      for (const p of positions) {
        const [pos, created] = await Position.findOrCreate({ where: { title: p.title, departmentId: p.departmentId }, defaults: p });
        posMap[p.title] = pos.id;
        if (!created && p.roleSlug && pos.roleSlug !== p.roleSlug) {
          await pos.update({ roleSlug: p.roleSlug });
        }
      }
      console.log('Positions seeded');

      const schedules = [
        { name: 'Morning Shift', startTime: '08:00', endTime: '17:00', daysOfWeek: [1,2,3,4,5], breakMinutes: 60 },
        { name: 'Afternoon Shift', startTime: '13:00', endTime: '22:00', daysOfWeek: [1,2,3,4,5,6], breakMinutes: 60 },
        { name: 'Full Day', startTime: '08:00', endTime: '22:00', daysOfWeek: [1,2,3,4,5,6], breakMinutes: 90 },
        { name: 'Weekend Only', startTime: '09:00', endTime: '21:00', daysOfWeek: [0,6], breakMinutes: 60 },
      ];
      const schedMap = {};
      for (const s of schedules) {
        const [sch] = await Schedule.findOrCreate({ where: { name: s.name }, defaults: s });
        schedMap[s.name] = sch.id;
      }
      console.log('Schedules seeded');

      // Demo job postings so the public careers page is never an empty grid on
      // a fresh deploy. Idempotent: findOrCreate on (title, departmentId).
      // Only seeded when no open postings exist yet, so a store that has
      // already managed real jobs is left untouched.
      const openCount = await JobPosting.count({ where: { status: 'open' } });
      if (openCount === 0) {
        const adminUser = await User.findOne({ where: { email: 'admin@minimart.com' } });
        const closingIn45Days = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const demoJobs = [
          {
            title: 'Cashier',
            departmentId: deptMap.Operations,
            positionId: posMap['Cashier'],
            scheduleId: schedMap['Full Day'],
            description: 'Join our front-line team and be the friendly face of MiniMart. You will operate the POS, handle cash and digital payments (GCash, Maya, PayMongo), manage the register, and keep the checkout area clean and customer-ready.',
            requirements: 'High school graduate or above. 1+ year retail or cashiering experience preferred. Honest, accurate with numbers, and able to stand for a full shift. Customer service and teamwork are a must.',
            salaryMin: 13000, salaryMax: 18000, employmentType: 'full-time', paymentFrequency: 'semi-monthly', openings: 2,
            location: 'Main Branch', status: 'open', approvedAt: new Date(), closingDate: closingIn45Days, postedBy: adminUser?.id,
          },
          {
            title: 'Sales Associate',
            departmentId: deptMap.Sales,
            positionId: posMap['Sales Associate'],
            scheduleId: schedMap['Full Day'],
            description: 'Help customers find what they need, keep shelves stocked and faced, support promotions, and drive daily sales. A great first role for people who love helping others and want to grow toward supervisory positions.',
            requirements: 'High school graduate or above. Reliable and energetic with a can-do attitude. Basic product knowledge is a plus. Willingness to work a rotating shift schedule.',
            salaryMin: 13000, salaryMax: 17000, employmentType: 'full-time', paymentFrequency: 'monthly', openings: 3,
            location: 'Main Branch', status: 'open', approvedAt: new Date(), closingDate: closingIn45Days, postedBy: adminUser?.id,
          },
          {
            title: 'Warehouse Staff',
            departmentId: deptMap.Warehouse,
            positionId: posMap['Warehouse Staff'],
            scheduleId: schedMap['Morning Shift'],
            description: 'Receive stock, check deliveries against purchase orders, organize the stockroom, and prepare items for the sales floor. You are the backbone that keeps our shelves from running empty.',
            requirements: 'High school graduate or above. Physically fit to lift and move stock. Basic bookkeeping or inventory experience is a plus. Honest and detail-oriented with stock counts.',
            salaryMin: 13000, salaryMax: 18000, employmentType: 'full-time', paymentFrequency: 'semi-monthly', openings: 2,
            location: 'Main Branch', status: 'open', approvedAt: new Date(), closingDate: closingIn45Days, postedBy: adminUser?.id,
          },
          {
            title: 'HR Officer',
            departmentId: deptMap['Human Resources'],
            positionId: posMap['HR Officer'],
            scheduleId: schedMap['Morning Shift'],
            description: 'Support end-to-end people operations: onboarding, attendance and leave management, payroll inputs, performance reviews, and employee relations. A hands-on role in a fast-growing retail team.',
            requirements: 'BS in Business Administration, HR Management, or a related field. 1+ year HR experience preferred. Proficient with spreadsheets and HR systems. Strong communication and confidentiality discipline.',
            salaryMin: 20000, salaryMax: 30000, employmentType: 'full-time', paymentFrequency: 'monthly', openings: 1,
            location: 'Main Branch', status: 'open', approvedAt: new Date(), closingDate: closingIn45Days, postedBy: adminUser?.id,
          },
          {
            title: 'Accountant',
            departmentId: deptMap.Finance,
            positionId: posMap['Accountant'],
            scheduleId: schedMap['Morning Shift'],
            description: 'Own day-to-day bookkeeping, reconciliations, cash and GCash settlements, expense tracking, and month-end reporting. Help management make clear, data-driven decisions about the business.',
            requirements: 'BS in Accountancy. CPA license preferred. 1+ year retail or SME accounting experience. Strong with Excel and accounting software; accuracy and integrity are non-negotiable.',
            salaryMin: 22000, salaryMax: 35000, employmentType: 'full-time', paymentFrequency: 'monthly', openings: 1,
            location: 'Main Branch', status: 'open', approvedAt: new Date(), closingDate: closingIn45Days, postedBy: adminUser?.id,
          },
        ];
        for (const j of demoJobs) {
          await JobPosting.findOrCreate({ where: { title: j.title, departmentId: j.departmentId }, defaults: j });
        }
        console.log(`Demo job postings seeded (${demoJobs.length})`);
      } else {
        console.log('Job postings already present — skipping demo seed');
      }

      const employees = [
        { firstName: 'Joy', lastName: 'Dela Cruz', email: 'cashier@minimart.com', departmentId: deptMap.Operations, positionId: posMap['Cashier'], salary: 15000, userId: (await User.findOne({ where: { email: 'cashier@minimart.com' } }))?.id, status: 'active', hireDate: '2026-01-15' },
        { firstName: 'Rico', lastName: 'Dela PeÃ±a', email: 'inventory@minimart.com', departmentId: deptMap.Warehouse, positionId: posMap['Warehouse Staff'], salary: 15000, userId: (await User.findOne({ where: { email: 'inventory@minimart.com' } }))?.id, status: 'active', hireDate: '2026-01-15' },
        { firstName: 'Ligma', lastName: 'One', email: 'ligma1@gmail.com', departmentId: deptMap.Sales, positionId: posMap['Sales Associate'], salary: 15000, userId: (await User.findOne({ where: { email: 'ligma1@gmail.com' } }))?.id, status: 'active', hireDate: '2026-01-15' },
      ];
      let empNum = 1001;
      for (const e of employees) {
        const existing = await Employee.findOne({ where: { email: e.email } });
        if (!existing && e.userId) {
          await Employee.create({ ...e, employeeNo: `EMP-${empNum++}` });
        } else if (existing && (!existing.departmentId || !existing.positionId)) {
          await existing.update({ departmentId: e.departmentId, positionId: e.positionId, salary: e.salary });
        }
      }
      console.log('Employees seeded');

      const discounts = [
        { code: 'WELCOME10', name: 'Welcome Discount', description: '10% off for new customers', type: 'percentage', value: 10, minPurchaseAmount: 100, usageLimit: 100, startDate: '2026-01-01', endDate: '2026-12-31', isActive: true },
        { code: 'FLAT50', name: 'Flat P50 Off', description: 'â‚±50 off on purchases above â‚±500', type: 'fixed', value: 50, minPurchaseAmount: 500, usageLimit: 50, startDate: '2026-01-01', endDate: '2026-12-31', isActive: true },
        { code: 'SENIOR15', name: 'Senior Citizen', description: '15% discount for senior citizens', type: 'percentage', value: 15, minPurchaseAmount: 0, maxDiscountAmount: 200, usageLimit: null, startDate: '2026-01-01', endDate: '2026-12-31', isActive: true },
        { code: 'HOLIDAY20', name: 'Holiday Special', description: '20% off during holidays', type: 'percentage', value: 20, minPurchaseAmount: 200, usageLimit: 200, startDate: '2026-12-01', endDate: '2026-12-31', isActive: false },
      ];
      for (const d of discounts) {
        await Discount.findOrCreate({ where: { code: d.code }, defaults: d });
      }
      console.log('Discounts seeded');

      console.log('All seed data ready');
    } catch (error) {
      console.error('Auto-setup failed:', error.message);
    }
  };

  const startServer = async () => {
    try {
      console.log('[DEBUG] startServer: before connectDB');
      await connectDB();
      console.log('[DEBUG] startServer: after connectDB');

      const shouldAutoSetup = config.nodeEnv === 'development' || process.env.AUTO_SETUP === 'true';
      console.log('[DEBUG] startServer: shouldAutoSetup=', shouldAutoSetup);
      if (shouldAutoSetup) {
        console.log('Auto-setup running in background...');
        runAutoSetup().catch((e) => console.error('Auto-setup crashed:', e));
      }
      console.log('[DEBUG] startServer: after runAutoSetup fire');

      scheduleLowStockCheck();
      scheduleExpiryCheck();
      scheduleTokenCleanup();

      // Surface payment misconfiguration at boot. Verification fails closed, so
      // a missing webhook secret silently rejects every PayMongo event with a
      // 400 and sales paid online stay "pending" with no visible cause.
      if (config.paymongo?.secretKey && !config.paymongo.webhookSecret) {
        console.warn(
          '[PAYMONGO] PAYMONGO_WEBHOOK_SECRET is not set. Online payments will appear to ' +
          'hang on "pending" because webhook signature verification rejects every event. ' +
          'Set it from the PayMongo dashboard (Webhooks → Secret) to enable them.'
        );
      }

      // Email fails silently by design (callers ignore the send result), so make
      // an unconfigured mail server obvious at boot instead.
      const mailer = require('./utils/mailer');
      if (!mailer.isConfigured()) {
        console.warn(
          '[MAILER] SMTP is not configured — no email will be sent. Password resets, ' +
          'payslips, receipts and contract notices will be dropped silently. Set ' +
          'SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and EMAIL_FROM. For Gmail, ' +
          'SMTP_PASS must be an App Password, not the account password.'
        );
      } else {
        console.log('[MAILER] SMTP configured:', config.smtp.host + ':' + config.smtp.port);
      }

      // Templates refuse to emit a localhost link, so without an explicit
      // public origin every HRMS email that includes a portal link fails to
      // build and is caught by its caller. Say so once, at boot, rather than
      // leaving it to be discovered from a missing welcome email.
      if (!config.app.frontendUrl) {
        console.warn(
          '[MAILER] FRONTEND_URL is not set. Emails carrying portal links ' +
          '(payslip, contract, leave, applicant status, password reset) will be ' +
          'built without a usable link. Set FRONTEND_URL to the public site origin.'
        );
      }

      // Surface accumulated delivery failures in the deploy logs.
      setInterval(() => mailer.reportFailuresIfAny(), 15 * 60 * 1000).unref();
      scheduleContractExpiryCheck();

    cron.schedule('*/30 * * * *', async () => {
      try {
        const { Sale, SaleItem, Product, StockMovement, User } = require('./models');
        const { Op } = require('sequelize');
        const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
        const expiredSales = await Sale.findAll({
          where: { status: 'pending', paymentStatus: 'pending', createdAt: { [Op.lt]: thirtyMinAgo } },
        });

        const systemUser = await User.findOne({ where: { email: 'admin@minimart.com' } });
        const systemUserId = systemUser ? systemUser.id : 1;

        for (const sale of expiredSales) {
          const t = await sequelize.transaction();
          try {
            // Re-check under a row lock. The list above was read without one, so
            // a sale cancelled by the user (or a double-submit) between the read
            // and here would otherwise have its stock restored a second time.
            const lockedSale = await Sale.findByPk(sale.id, { transaction: t, lock: t.LOCK.UPDATE });
            if (!lockedSale || lockedSale.status !== 'pending' || lockedSale.paymentStatus !== 'pending') {
              await t.rollback();
              continue;
            }

            const items = await SaleItem.findAll({ where: { saleId: sale.id }, transaction: t });
            for (const item of items) {
              const product = await Product.findByPk(item.productId, { transaction: t, lock: true });
              if (!product) continue;
              const previousStock = parseInt(product.stockQuantity, 10) || 0;
              const newStock = previousStock + item.quantity;
              await Product.increment('stockQuantity', { by: item.quantity, where: { id: item.productId }, transaction: t });
              await StockMovement.create({
                productId: item.productId,
                userId: systemUserId,
                type: 'in',
                quantity: item.quantity,
                previousStock,
                newStock,
                referenceType: 'Sale',
                referenceId: sale.id,
                notes: `Auto-cancelled expired pending sale #${sale.invoiceNo}`,
              }, { transaction: t });
            }
            await sale.update({ status: 'cancelled', paymentStatus: 'cancelled' }, { transaction: t });
            await t.commit();
          } catch (innerErr) {
            await t.rollback();
            console.error(`Failed to auto-cancel sale #${sale.invoiceNo}:`, innerErr.message);
          }
        }
        if (expiredSales.length) console.log(`Auto-cancelled ${expiredSales.length} expired pending sales`);
      } catch (err) { console.error('Pending sale expiry cron failed:', err.message); }
    });
    console.log('[DEBUG] startServer: about to call server.listen');

    server.on('error', (err) => {
      console.error('Server error:', err);
    });

    srv = server.listen(config.port, '0.0.0.0', () => {
      const addr = server.address();
      console.log(`Server bound to: ${JSON.stringify(addr)}`);
      console.log(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
      console.log(`API Docs: http://localhost:${config.port}/api-docs`);
      console.log(`Health: http://localhost:${config.port}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  if (server) {
    server.close(() => {
      console.log('HTTP server closed.');
      sequelize.close().then(() => {
        console.log('Database connection closed.');
        process.exit(0);
      }).catch(() => process.exit(1));
    });
  } else {
    process.exit(0);
  }
  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  gracefulShutdown('uncaughtException');
});

startServer();

module.exports = { app, io, server };
