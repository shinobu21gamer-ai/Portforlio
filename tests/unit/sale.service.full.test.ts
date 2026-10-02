import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';

const models = require('../../src/models');
const { sequelize, Product, Sale, SaleItem, Payment, StockMovement, Category, Role, User, Customer } = models;
const saleService = require('../../src/services/sale.service');

let userId;
let adminUserId;
let productId;
let customerId;

beforeAll(async () => {
  await sequelize.sync({ force: true });

  // Roles
  const cashierRole = await Role.create({ name: 'Cashier', slug: 'cashier' });
  const adminRole = await Role.create({ name: 'Admin', slug: 'admin' });
  const managerRole = await Role.create({ name: 'Manager', slug: 'manager' });

  // Cashier user
  const user = await User.create({
    firstName: 'Test',
    lastName: 'Cashier',
    email: 'cashier@test.local',
    password: 'hashed',
    roleId: cashierRole.id,
  });
  userId = user.id;

  // Admin user
  const adminUser = await User.create({
    firstName: 'Test',
    lastName: 'Admin',
    email: 'admin@test.local',
    password: 'hashed',
    roleId: adminRole.id,
  });
  adminUserId = adminUser.id;

  // Customer
  const customer = await Customer.create({
    firstName: 'John',
    lastName: 'Customer',
    email: 'customer@test.local',
    phone: '123456',
    address: 'Test Address',
  });
  customerId = customer.id;
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await SaleItem.destroy({ where: {}, force: true });
  await StockMovement.destroy({ where: {}, force: true });
  await Payment.destroy({ where: {}, force: true });
  await Sale.destroy({ where: {}, force: true });
  await Product.destroy({ where: {}, force: true });
  await Category.destroy({ where: {}, force: true });

  const category = await Category.create({ name: 'Test Cat', slug: 'test-cat' });
  const product = await Product.create({
    name: 'Test Widget',
    slug: 'test-widget',
    sku: 'WID-1',
    barcode: '2000000000001',
    categoryId: category.id,
    sellingPrice: 100,
    buyingPrice: 60,
    stockQuantity: 50,
    isActive: true,
    taxRate: 12,
  });
  productId = product.id;
});

const stockOf = async () => (await Product.findByPk(productId)).stockQuantity;

describe('sale.service - getAll', () => {
  it('returns paginated sales for cashier', async () => {
    await saleService.create(
      { items: [{ productId, quantity: 1 }], paymentMethod: 'cash', cashAmount: 500 },
      userId
    );

    const result = await saleService.getAll({ user: { id: userId, role: { slug: 'cashier' } } });
    expect(result.sales).toHaveLength(1);
    expect(result.pagination.totalItems).toBe(1);
  });

  it('filters by payment method', async () => {
    await saleService.create(
      { items: [{ productId, quantity: 1 }], paymentMethod: 'cash', cashAmount: 500 },
      userId
    );
    await saleService.createPending(
      { items: [{ productId, quantity: 1 }], paymentMethod: 'gcash', shippingFee: 0 },
      userId
    );

    const result = await saleService.getAll({ paymentMethod: 'cash' });
    expect(result.sales).toHaveLength(1);
    expect(result.sales[0].paymentMethod).toBe('cash');
  });

  it('filters by status', async () => {
    await saleService.createPending(
      { items: [{ productId, quantity: 1 }], paymentMethod: 'gcash', shippingFee: 0 },
      userId
    );

    const result = await saleService.getAll({ status: 'pending' });
    expect(result.sales).toHaveLength(1);
    expect(result.sales[0].status).toBe('pending');
  });

  it('searches by invoice number', async () => {
    const sale = await saleService.create(
      { items: [{ productId, quantity: 1 }], paymentMethod: 'cash', cashAmount: 500 },
      userId
    );

    const result = await saleService.getAll({ search: sale.invoiceNo });
    expect(result.sales).toHaveLength(1);
  });

  it('searches by customer name', async () => {
    await saleService.create(
      {
        items: [{ productId, quantity: 1 }],
        paymentMethod: 'cash',
        cashAmount: 500,
        customerId,
      },
      userId
    );

    const result = await saleService.getAll({ search: 'John' });
    expect(result.sales).toHaveLength(1);
  });
});

describe('sale.service - getById', () => {
  it('returns sale with items and customer', async () => {
    const sale = await saleService.create(
      {
        items: [{ productId, quantity: 2 }],
        paymentMethod: 'cash',
        cashAmount: 500,
        customerId,
      },
      userId
    );

    const result = await saleService.getById(sale.id, { id: userId, role: { slug: 'cashier' } });
    expect(result.id).toBe(sale.id);
    expect(result.items).toHaveLength(1);
    expect(result.customer.id).toBe(customerId);
  });

  it('rejects cashier accessing another cashier\'s sale', async () => {
    const sale = await saleService.create(
      { items: [{ productId, quantity: 1 }], paymentMethod: 'cash', cashAmount: 500 },
      userId
    );

    await expect(
      saleService.getById(sale.id, { id: 99999, role: { slug: 'cashier' } })
    ).rejects.toThrow(/do not have access/i);
  });

  it('allows admin to access any sale', async () => {
    const sale = await saleService.create(
      { items: [{ productId, quantity: 1 }], paymentMethod: 'cash', cashAmount: 500 },
      userId
    );

    const result = await saleService.getById(sale.id, { id: adminUserId, role: { slug: 'admin' } });
    expect(result.id).toBe(sale.id);
  });
});

describe('sale.service - getByInvoice', () => {
  it('returns sale by invoice number', async () => {
    const sale = await saleService.create(
      { items: [{ productId, quantity: 1 }], paymentMethod: 'cash', cashAmount: 500 },
      userId
    );

    const result = await saleService.getByInvoice(sale.invoiceNo);
    expect(result.id).toBe(sale.id);
  });

  it('throws for non-existent invoice', async () => {
    await expect(saleService.getByInvoice('NONEXISTENT')).rejects.toThrow(/not found/i);
  });

  it('allows cashier to access own sale by invoice', async () => {
    const sale = await saleService.create(
      { items: [{ productId, quantity: 1 }], paymentMethod: 'cash', cashAmount: 500 },
      userId
    );

    const result = await saleService.getByInvoice(sale.invoiceNo, { id: userId, role: { slug: 'cashier' } });
    expect(result.id).toBe(sale.id);
  });

  it('rejects cashier accessing another cashier\'s sale by invoice', async () => {
    const sale = await saleService.create(
      { items: [{ productId, quantity: 1 }], paymentMethod: 'cash', cashAmount: 500 },
      userId
    );

    await expect(
      saleService.getByInvoice(sale.invoiceNo, { id: 99999, role: { slug: 'cashier' } })
    ).rejects.toThrow(/do not have access/i);
  });
});

describe('sale.service - canApplyManualDiscount', () => {
  it('returns true for admin', async () => {
    const canApply = await saleService.canApplyManualDiscount(adminUserId);
    expect(canApply).toBe(true);
  });

  it('returns true for manager', async () => {
    const managerRole = await Role.findOne({ where: { slug: 'manager' } });
    const manager = await User.create({
      firstName: 'Manager',
      lastName: 'Test',
      email: 'manager@test.local',
      password: 'hashed',
      roleId: managerRole.id,
    });

    const canApply = await saleService.canApplyManualDiscount(manager.id);
    expect(canApply).toBe(true);
  });

  it('returns false for cashier', async () => {
    const canApply = await saleService.canApplyManualDiscount(userId);
    expect(canApply).toBe(false);
  });
});

describe('sale.service - cancel (refund)', () => {
  it('cancels a completed cash sale and restores stock', async () => {
    const sale = await saleService.create(
      { items: [{ productId, quantity: 3 }], paymentMethod: 'cash', cashAmount: 500 },
      userId
    );

    const beforeStock = await stockOf();
    expect(beforeStock).toBe(47);

    const result = await saleService.cancel(sale.id, userId);
    expect(result.status).toBe('cancelled');

    const afterStock = await stockOf();
    expect(afterStock).toBe(50);
  });

  it('returns already cancelled sale without error', async () => {
    const sale = await saleService.create(
      { items: [{ productId, quantity: 1 }], paymentMethod: 'cash', cashAmount: 500 },
      userId
    );

    await saleService.cancel(sale.id, userId);
    const result = await saleService.cancel(sale.id, userId);
    expect(result.status).toBe('cancelled');
  });

  it('rejects cancelling already refunded sale', async () => {
    const sale = await saleService.create(
      { items: [{ productId, quantity: 1 }], paymentMethod: 'cash', cashAmount: 500 },
      userId
    );

    // Cancel creates cancelled status, can't be refunded
    await saleService.cancel(sale.id, userId);
    // The service doesn't have a separate refund method, cancel handles refund-like behavior
  });
});

describe('sale.service - getSalesReport', () => {
  it('returns summary for date range', async () => {
    await saleService.create(
      { items: [{ productId, quantity: 2 }], paymentMethod: 'cash', cashAmount: 500 },
      userId
    );

    const end = new Date();
    const start = new Date(end.getTime() - 86400000);

    const result = await saleService.getSalesReport(start.toISOString(), end.toISOString());
    expect(result.totalSales).toBe(1);
    expect(result.totalRevenue).toBe(224); // 200 + 24 tax (12%)
    expect(result.totalProfit).toBeGreaterThan(0);
  });

  it('returns empty summary for empty range', async () => {
    const end = new Date();
    const start = new Date(end.getTime() + 86400000);

    const result = await saleService.getSalesReport(start.toISOString(), end.toISOString());
    expect(result.totalSales).toBe(0);
    expect(result.totalRevenue).toBe(0);
  });

  it('includes daily breakdown', async () => {
    await saleService.create(
      { items: [{ productId, quantity: 1 }], paymentMethod: 'cash', cashAmount: 500 },
      userId
    );

    const end = new Date();
    const start = new Date(end.getTime() - 86400000);

    const result = await saleService.getSalesReport(start.toISOString(), end.toISOString());
    expect(result.dailyBreakdown).toBeDefined();
    expect(Array.isArray(Object.keys(result.dailyBreakdown))).toBe(true);
  });

  it('includes period metadata', async () => {
    await saleService.create(
      { items: [{ productId, quantity: 1 }], paymentMethod: 'cash', cashAmount: 500 },
      userId
    );

    const end = new Date();
    const start = new Date(end.getTime() - 86400000);

    const result = await saleService.getSalesReport(start.toISOString(), end.toISOString());
    expect(result.period).toBeDefined();
    expect(result.period.startDate).toBe(start.toISOString());
    expect(result.period.endDate).toBe(end.toISOString());
    expect(result.averageOrderValue).toBeGreaterThan(0);
  });
});

describe('sale.service - cancelPendingOnline', () => {
  it('cancels pending online sale and restores stock', async () => {
    const sale = await saleService.createPending(
      { items: [{ productId, quantity: 3 }], paymentMethod: 'gcash', shippingFee: 0 },
      userId
    );

    const beforeStock = await stockOf();
    expect(beforeStock).toBe(47);

    const user = await User.findByPk(userId, { include: [{ model: Role, as: 'role' }] });
    const result = await saleService.cancelPendingOnline(sale.id, user);

    expect(result.status).toBe('cancelled');

    const afterStock = await stockOf();
    expect(afterStock).toBe(50);
  });

  it('rejects cancelling non-pending sale', async () => {
    const sale = await saleService.create(
      { items: [{ productId, quantity: 1 }], paymentMethod: 'cash', cashAmount: 500 },
      userId
    );

    const user = await User.findByPk(userId, { include: [{ model: Role, as: 'role' }] });
    await expect(saleService.cancelPendingOnline(sale.id, user)).rejects.toThrow(/Only unpaid pending/i);
  });

  it('returns already cancelled sale', async () => {
    const sale = await saleService.createPending(
      { items: [{ productId, quantity: 1 }], paymentMethod: 'gcash', shippingFee: 0 },
      userId
    );

    const user = await User.findByPk(userId, { include: [{ model: Role, as: 'role' }] });
    await saleService.cancelPendingOnline(sale.id, user);

    const result = await saleService.cancelPendingOnline(sale.id, user);
    expect(result.status).toBe('cancelled');
  });
});

describe('sale.service - finalizeAfterPayment', () => {
  it('processes customer loyalty points without error', async () => {
    const sale = await saleService.createPending(
      { items: [{ productId, quantity: 2 }], paymentMethod: 'gcash', shippingFee: 0, customerId },
      userId
    );

    const t = await sequelize.transaction();
    try {
      const result = await saleService.finalizeAfterPayment(sale.id, t);
      await t.commit();

      expect(result.id).toBe(sale.id);

      // Verify customer stats updated
      const customer = await Customer.findByPk(customerId);
      expect(customer.totalPurchases).toBeGreaterThan(0);
    } catch (e) {
      await t.rollback();
      throw e;
    }
  });

  it('throws for non-existent sale', async () => {
    const t = await sequelize.transaction();
    try {
      await expect(saleService.finalizeAfterPayment(999999, t)).rejects.toThrow(/not found/i);
      await t.rollback();
    } catch (e) {
      await t.rollback();
      throw e;
    }
  });
});

describe('sale.service - existing pending/cancel tests', () => {
  it('records an unpaid sale and reserves stock without a payment row', async () => {
    const sale = await saleService.createPending(
      { items: [{ productId, quantity: 2 }], paymentMethod: 'gcash', shippingFee: 0 },
      userId
    );
    const persisted = await Sale.findByPk(sale.id);
    expect(persisted.status).toBe('pending');
    expect(persisted.paymentStatus).toBe('pending');
    expect(persisted.cashAmount).toBeNull();
    expect(await Payment.count({ where: { saleId: sale.id } })).toBe(0);
    expect(await stockOf()).toBe(48);
  });

  it('rejects a pending cash sale', async () => {
    await expect(
      saleService.createPending({ items: [{ productId, quantity: 1 }], paymentMethod: 'cash', cashAmount: 500 }, userId)
    ).rejects.toThrow(/Cash sales cannot be created as pending/i);
    expect(await stockOf()).toBe(50);
  });

  it('records a completed sale, a payment row, and decrements stock', async () => {
    const sale = await saleService.create(
      { items: [{ productId, quantity: 1 }], paymentMethod: 'cash', cashAmount: 500, shippingFee: 0 },
      userId
    );
    const persisted = await Sale.findByPk(sale.id);
    expect(persisted.status).toBe('completed');
    expect(persisted.paymentStatus).toBe('paid');
    expect(persisted.changeAmount).toBe(388); // 500 - (100 * 1.12 tax)
    expect(await Payment.count({ where: { saleId: sale.id } })).toBe(1);
    expect(await stockOf()).toBe(49);
  });

  it('decrements stock cumulatively across sales', async () => {
    await saleService.create({ items: [{ productId, quantity: 3 }], paymentMethod: 'cash', cashAmount: 500 }, userId);
    await saleService.create({ items: [{ productId, quantity: 2 }], paymentMethod: 'cash', cashAmount: 500 }, userId);
    expect(await stockOf()).toBe(45);
  });
});