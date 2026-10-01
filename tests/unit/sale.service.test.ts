import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';

const models = require('../../src/models');
const { sequelize, Product, Sale, SaleItem, Payment, StockMovement, Category, Role, User } = models;
const saleService = require('../../src/services/sale.service');

let userId;
let productId;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  const role = await Role.create({ name: 'Cashier', slug: 'cashier' });
  const user = await User.create({
    firstName: 'Test', lastName: 'Cashier', email: 'cashier@test.local',
    password: 'hashed', roleId: role.id,
  });
  userId = user.id;
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
    name: 'Test Widget', slug: 'test-widget', sku: 'WID-1', barcode: '2000000000001',
    categoryId: category.id,
    sellingPrice: 100, buyingPrice: 60, stockQuantity: 50,
    isActive: true, taxRate: 0,
  });
  productId = product.id;
});

const stockOf = async () => (await Product.findByPk(productId)).stockQuantity;

describe('sale.service - pending (online) sales', () => {
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

  it('rejects a pending sale that exceeds available stock', async () => {
    await expect(
      saleService.createPending({ items: [{ productId, quantity: 1000 }], paymentMethod: 'gcash' }, userId)
    ).rejects.toThrow(/Insufficient stock/i);
    expect(await stockOf()).toBe(50);
  });
});

describe('sale.service - paid (cash) sales', () => {
  it('records a completed sale, a payment row, and decrements stock', async () => {
    const sale = await saleService.create(
      { items: [{ productId, quantity: 1 }], paymentMethod: 'cash', cashAmount: 500, shippingFee: 0 },
      userId
    );
    const persisted = await Sale.findByPk(sale.id);
    expect(persisted.status).toBe('completed');
    expect(persisted.paymentStatus).toBe('paid');
    expect(persisted.changeAmount).toBe(400);
    expect(await Payment.count({ where: { saleId: sale.id } })).toBe(1);
    expect(await stockOf()).toBe(49);
  });

  it('rejects a non-cash payment on the paid path', async () => {
    await expect(
      saleService.create({ items: [{ productId, quantity: 1 }], paymentMethod: 'gcash' }, userId)
    ).rejects.toThrow(/online checkout flow/i);
  });

  it('rejects cash that does not cover the total', async () => {
    await expect(
      saleService.create({ items: [{ productId, quantity: 1 }], paymentMethod: 'cash', cashAmount: 10 }, userId)
    ).rejects.toThrow(/Insufficient cash/i);
  });

  it('decrements stock cumulatively across sales', async () => {
    await saleService.create({ items: [{ productId, quantity: 3 }], paymentMethod: 'cash', cashAmount: 500 }, userId);
    await saleService.create({ items: [{ productId, quantity: 2 }], paymentMethod: 'cash', cashAmount: 500 }, userId);
    expect(await stockOf()).toBe(45);
  });
});

describe('sale.service - cancellation', () => {
  it('restores reserved stock when a pending sale is cancelled', async () => {
    const sale = await saleService.createPending(
      { items: [{ productId, quantity: 4 }], paymentMethod: 'gcash' },
      userId
    );
    expect(await stockOf()).toBe(46);

    const user = await User.findByPk(userId, { include: [{ model: Role, as: 'role' }] });
    const cancelled = await saleService.cancelPendingOnline(sale.id, user);
    expect(cancelled.status).toBe('cancelled');
    expect(await stockOf()).toBe(50);
  });
});
