/**
 * Phase-6 unit suite: src/services/inventory.service.js
 *
 * inventory.service was one of the ~40 service files still at 0% coverage when
 * the Phase-5 ratchet was set, and it is the one that moves stock — the numbers
 * here are the ones a store reconciles against. It covers:
 *
 *   • stock-in / stock-out / adjust arithmetic and their guards;
 *   • the StockMovement and Inventory audit rows each operation writes,
 *     including the signed deltas (stock-out logs a NEGATIVE quantity in the
 *     Inventory ledger while StockMovement stores the positive magnitude);
 *   • transactional rollback, so a rejected operation leaves no partial audit
 *     trail behind;
 *   • the low-stock notification dedupe window (6h) and the expiring-product
 *     dedupe window (24h), plus the custom `days` window on checkExpiring.
 *
 * The dedupe windows are the reason this suite exists: both cron jobs run on a
 * schedule (low stock every 6h, expiry daily), and without the window check they
 * would spam a duplicate notification on every single run.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';

const {
  sequelize, Product, Category, StockMovement, Inventory, Notification, User, Role,
} = require('../../src/models');
const inventoryService = require('../../src/services/inventory.service');

let userId: number;

const mkProduct = async (overrides: any = {}) => {
  const category = await Category.findOne({ where: { slug: 'inv-test' } })
    || await Category.create({ name: 'Inventory Test', slug: 'inv-test' });
  const seq = await Product.count();
  return Product.create({
    name: `Inv Product ${seq}`,
    slug: `inv-product-${seq}-${Date.now()}`,
    sku: `INV-${seq}`,
    barcode: `48000666600${String(seq).padStart(2, '0')}`,
    categoryId: category.id,
    unit: 'pcs',
    buyingPrice: 10,
    sellingPrice: 20,
    stockQuantity: 50,
    minStockLevel: 10,
    taxRate: 0,
    isActive: true,
    ...overrides,
  });
};

beforeAll(async () => {
  await sequelize.sync({ force: true });
  const role = await Role.create({ name: 'Admin', slug: 'admin', isActive: true });
  const user = await User.create({
    firstName: 'Inv', lastName: 'Tester', email: 'inv@test.local',
    password: 'Passw0rd!123', roleId: role.id, isActive: true,
  });
  userId = user.id;
}, 60000);

afterAll(async () => {
  await sequelize.close();
}, 30000);

beforeEach(async () => {
  await Notification.destroy({ where: {}, force: true });
  await StockMovement.destroy({ where: {}, force: true });
  await Inventory.destroy({ where: {}, force: true });
  await Product.destroy({ where: {}, force: true });
});

describe('inventory.service — stockIn', () => {
  it('adds the quantity to the current stock and returns the reloaded product', async () => {
    const product = await mkProduct({ stockQuantity: 50 });
    const res = await inventoryService.stockIn({ productId: product.id, quantity: 25 }, userId);
    expect(res.product.stockQuantity).toBe(75);
    expect(res.message).toMatch(/added/i);
  });

  it('writes a StockMovement "in" row carrying the before/after delta', async () => {
    const product = await mkProduct({ stockQuantity: 50 });
    await inventoryService.stockIn({ productId: product.id, quantity: 25 }, userId);

    const movements = await StockMovement.findAll({ where: { productId: product.id } });
    expect(movements).toHaveLength(1);
    expect(movements[0].type).toBe('in');
    expect(movements[0].quantity).toBe(25);
    expect(movements[0].previousStock).toBe(50);
    expect(movements[0].newStock).toBe(75);
    expect(movements[0].userId).toBe(userId);
  });

  it('writes a positive Inventory "stock_in" ledger row', async () => {
    const product = await mkProduct({ stockQuantity: 50 });
    await inventoryService.stockIn({ productId: product.id, quantity: 25, notes: 'delivery' }, userId);

    const logs = await Inventory.findAll({ where: { productId: product.id } });
    expect(logs).toHaveLength(1);
    expect(logs[0].type).toBe('stock_in');
    expect(logs[0].quantity).toBe(25);
    expect(logs[0].previousStock).toBe(50);
    expect(logs[0].currentStock).toBe(75);
    expect(logs[0].notes).toBe('delivery');
  });

  it('rejects zero, negative, and non-numeric quantities with a 400 and writes nothing', async () => {
    const product = await mkProduct({ stockQuantity: 50 });
    for (const quantity of [0, -5, 'abc']) {
      await expect(inventoryService.stockIn({ productId: product.id, quantity }, userId))
        .rejects.toMatchObject({ statusCode: 400 });
    }
    expect(await StockMovement.count()).toBe(0);
    expect((await Product.findByPk(product.id)).stockQuantity).toBe(50);
  });

  it('404s for an unknown product', async () => {
    await expect(inventoryService.stockIn({ productId: 999999, quantity: 5 }, userId))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('inventory.service — stockOut', () => {
  it('subtracts the quantity from stock', async () => {
    const product = await mkProduct({ stockQuantity: 50 });
    const res = await inventoryService.stockOut({ productId: product.id, quantity: 20 }, userId);
    expect(res.product.stockQuantity).toBe(30);
    expect(res.message).toMatch(/removed/i);
  });

  it('refuses to draw down below zero and reports what is available', async () => {
    const product = await mkProduct({ stockQuantity: 5 });
    await expect(inventoryService.stockOut({ productId: product.id, quantity: 6 }, userId))
      .rejects.toMatchObject({ statusCode: 400 });

    // Guard fired before any write: stock untouched, no audit row.
    expect((await Product.findByPk(product.id)).stockQuantity).toBe(5);
    expect(await StockMovement.count()).toBe(0);
    expect(await Inventory.count()).toBe(0);
  });

  it('logs a NEGATIVE quantity in the Inventory ledger but a positive magnitude in StockMovement', async () => {
    const product = await mkProduct({ stockQuantity: 50 });
    await inventoryService.stockOut({ productId: product.id, quantity: 20 }, userId);

    const [movement] = await StockMovement.findAll({ where: { productId: product.id } });
    expect(movement.type).toBe('out');
    expect(movement.quantity).toBe(20);
    expect(movement.previousStock).toBe(50);
    expect(movement.newStock).toBe(30);

    const [log] = await Inventory.findAll({ where: { productId: product.id } });
    expect(log.type).toBe('stock_out');
    expect(log.quantity).toBe(-20);
    expect(log.currentStock).toBe(30);
  });

  it('rejects a zero or negative quantity with a 400', async () => {
    const product = await mkProduct({ stockQuantity: 50 });
    await expect(inventoryService.stockOut({ productId: product.id, quantity: 0 }, userId))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('404s for an unknown product', async () => {
    await expect(inventoryService.stockOut({ productId: 999999, quantity: 5 }, userId))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('inventory.service — adjustStock', () => {
  it('sets stock to the new absolute value and records the signed difference', async () => {
    const product = await mkProduct({ stockQuantity: 50 });
    const res = await inventoryService.adjustStock(
      { productId: product.id, newQuantity: 62, reason: 'stocktake' }, userId,
    );
    expect(res.product.stockQuantity).toBe(62);

    const [movement] = await StockMovement.findAll({ where: { productId: product.id } });
    expect(movement.type).toBe('adjustment');
    expect(movement.quantity).toBe(12);
    expect(movement.previousStock).toBe(50);
    expect(movement.newStock).toBe(62);
    expect(movement.notes).toBe('stocktake');
  });

  it('records a negative difference when adjusting down, and honours an explicit ledger type', async () => {
    const product = await mkProduct({ stockQuantity: 50 });
    await inventoryService.adjustStock(
      { productId: product.id, newQuantity: 44, type: 'damage', reason: 'broken in transit' }, userId,
    );

    const [movement] = await StockMovement.findAll({ where: { productId: product.id } });
    expect(movement.quantity).toBe(-6);

    const [log] = await Inventory.findAll({ where: { productId: product.id } });
    expect(log.type).toBe('damage');
    expect(log.quantity).toBe(-6);
    expect(log.currentStock).toBe(44);
  });

  it('allows adjusting to exactly zero (write-off) but rejects a negative target', async () => {
    const product = await mkProduct({ stockQuantity: 50 });
    const res = await inventoryService.adjustStock({ productId: product.id, newQuantity: 0 }, userId);
    expect(res.product.stockQuantity).toBe(0);

    await expect(inventoryService.adjustStock({ productId: product.id, newQuantity: -1 }, userId))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('404s for an unknown product', async () => {
    await expect(inventoryService.adjustStock({ productId: 999999, newQuantity: 10 }, userId))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('inventory.service — checkLowStock notification dedupe', () => {
  it('notifies once for a product at or below its minimum, and not for healthy stock', async () => {
    const low = await mkProduct({ stockQuantity: 4, minStockLevel: 10, slug: 'low-1' });
    await mkProduct({ stockQuantity: 40, minStockLevel: 10, slug: 'healthy-1' });
    // Exactly at the minimum counts as low (the query is <=).
    const atMin = await mkProduct({ stockQuantity: 10, minStockLevel: 10, slug: 'at-min-1' });

    const result = await inventoryService.checkLowStock();
    expect(result.count).toBe(2);
    expect(result.products.map((p: any) => p.id).sort()).toEqual([low.id, atMin.id].sort());

    const notes = await Notification.findAll({ where: { type: 'low_stock' } });
    expect(notes).toHaveLength(2);
    expect(notes[0].title).toMatch(/Low Stock/i);
    expect(notes[0].data.productId).toBeDefined();
  });

  it('suppresses a duplicate inside the 6h window but re-notifies once it has passed', async () => {
    const product = await mkProduct({ stockQuantity: 2, minStockLevel: 10, slug: 'dedupe-low' });

    await inventoryService.checkLowStock();
    expect(await Notification.count({ where: { type: 'low_stock' } })).toBe(1);

    // Second run inside the window: the cron job fires every 6h, so an
    // un-deduped implementation would add a notification on every single run.
    await inventoryService.checkLowStock();
    await inventoryService.checkLowStock();
    expect(await Notification.count({ where: { type: 'low_stock' } })).toBe(1);

    // Age the existing notification past the 6h threshold; the next run must
    // re-notify so a still-unresolved shortage stays visible.
    const existing = await Notification.findOne({ where: { type: 'low_stock' } });
    await existing.update({ createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000 - 60000) });
    await sequelize.query(
      `UPDATE notifications SET created_at = :ts WHERE id = :id`,
      { replacements: { ts: new Date(Date.now() - 6 * 60 * 60 * 1000 - 60000), id: existing.id } },
    );

    await inventoryService.checkLowStock();
    const after = await Notification.findAll({ where: { type: 'low_stock' } });
    expect(after).toHaveLength(2);
    expect(after.map((n: any) => n.data.productId)).toEqual([product.id, product.id]);
  });
});

describe('inventory.service — checkExpiringProducts notification dedupe', () => {
  it('notifies for products expiring inside the default window and ignores those outside it', async () => {
    const soon = await mkProduct({
      stockQuantity: 10, slug: 'expiring-soon',
      expiryDate: new Date(Date.now() + 5 * 86400000),
    });
    await mkProduct({
      stockQuantity: 10, slug: 'expiring-later',
      expiryDate: new Date(Date.now() + 200 * 86400000),
    });
    await mkProduct({ stockQuantity: 10, slug: 'no-expiry', expiryDate: null });

    // Default window is config.app.expiryWarningDays (30).
    const result = await inventoryService.checkExpiringProducts();
    expect(result.count).toBe(1);
    expect(result.products[0].id).toBe(soon.id);

    const notes = await Notification.findAll({ where: { type: 'expiring_product' } });
    expect(notes).toHaveLength(1);
    expect(notes[0].title).toMatch(/Expiring/i);
  });

  it('honours a custom `days` window', async () => {
    await mkProduct({ stockQuantity: 10, slug: 'exp-60', expiryDate: new Date(Date.now() + 60 * 86400000) });
    await mkProduct({ stockQuantity: 10, slug: 'exp-3', expiryDate: new Date(Date.now() + 3 * 86400000) });

    // A 7-day window catches only the 3-day product, not the 60-day one.
    const narrow = await inventoryService.checkExpiringProducts(7);
    expect(narrow.count).toBe(1);

    // A 90-day window catches both.
    await Notification.destroy({ where: {}, force: true });
    const wide = await inventoryService.checkExpiringProducts(90);
    expect(wide.count).toBe(2);
  });

  it('suppresses a duplicate inside the 24h window but re-notifies once it has passed', async () => {
    await mkProduct({ stockQuantity: 10, slug: 'dedupe-exp', expiryDate: new Date(Date.now() + 5 * 86400000) });

    await inventoryService.checkExpiringProducts(30);
    expect(await Notification.count({ where: { type: 'expiring_product' } })).toBe(1);

    // The expiry cron runs daily, so the window is 24h rather than the 6h the
    // low-stock job uses.
    await inventoryService.checkExpiringProducts(30);
    expect(await Notification.count({ where: { type: 'expiring_product' } })).toBe(1);

    const existing = await Notification.findOne({ where: { type: 'expiring_product' } });
    await sequelize.query(
      `UPDATE notifications SET created_at = :ts WHERE id = :id`,
      { replacements: { ts: new Date(Date.now() - 24 * 60 * 60 * 1000 - 60000), id: existing.id } },
    );

    await inventoryService.checkExpiringProducts(30);
    expect(await Notification.count({ where: { type: 'expiring_product' } })).toBe(2);
  });
});
