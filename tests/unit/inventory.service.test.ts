/**
 * Phase 6 — stock math: stock-in / stock-out / adjust, with the
 * insufficient-stock and invalid-qty failure paths.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';

const models = require('../../src/models');
const { sequelize, Product, Category, Role, User, StockMovement, Inventory } = models;
const inventoryService = require('../../src/services/inventory.service');

let userId: number;
let productId: number;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  const role = await Role.create({ name: 'Admin', slug: 'admin' });
  const user = await User.create({
    firstName: 'Inv', lastName: 'Staff', email: 'inv@test.local',
    password: 'hashed', roleId: role.id,
  });
  userId = user.id;
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await StockMovement.destroy({ where: {}, force: true });
  await Inventory.destroy({ where: {}, force: true });
  await Product.destroy({ where: {}, force: true });
  await Category.destroy({ where: {}, force: true });
  const cat = await Category.create({ name: 'Stock Cat', slug: 'stock-cat' });
  const product = await Product.create({
    name: 'Canned Tuna', slug: 'canned-tuna', sku: 'INV-1', barcode: '3000000000001',
    categoryId: cat.id, sellingPrice: 40, buyingPrice: 25, stockQuantity: 10, isActive: true,
  });
  productId = product.id;
});

const stockOf = async () => (await Product.findByPk(productId))!.stockQuantity;

describe('inventory.service — stockIn', () => {
  it('adds quantity and writes a movement + inventory row', async () => {
    const result = await inventoryService.stockIn({ productId, quantity: 5, notes: 'delivery' }, userId);
    expect(await stockOf()).toBe(15);
    expect(result.product.stockQuantity).toBe(15);
    expect(await StockMovement.count({ where: { productId, type: 'in' } })).toBe(1);
    expect(await Inventory.count({ where: { productId, type: 'stock_in' } })).toBe(1);
  });

  it('rejects non-positive quantities', async () => {
    await expect(inventoryService.stockIn({ productId, quantity: 0 }, userId))
      .rejects.toThrow(/positive integer/i);
    expect(await stockOf()).toBe(10);
  });

  it('404s an unknown product', async () => {
    await expect(inventoryService.stockIn({ productId: 99999, quantity: 1 }, userId))
      .rejects.toThrow(/not found/i);
  });
});

describe('inventory.service — stockOut', () => {
  it('subtracts quantity when stock is sufficient', async () => {
    await inventoryService.stockOut({ productId, quantity: 4 }, userId);
    expect(await stockOf()).toBe(6);
  });

  it('rejects an oversell and leaves stock unchanged', async () => {
    await expect(inventoryService.stockOut({ productId, quantity: 50 }, userId))
      .rejects.toThrow(/Insufficient stock/i);
    expect(await stockOf()).toBe(10);
  });
});

describe('inventory.service — adjustStock', () => {
  it('sets an absolute quantity (up or down) and records the delta', async () => {
    await inventoryService.adjustStock({ productId, newQuantity: 3, reason: 'count' }, userId);
    expect(await stockOf()).toBe(3);
    const mv = await StockMovement.findOne({ where: { productId, type: 'adjustment' } });
    expect(mv.quantity).toBe(-7);
    await inventoryService.adjustStock({ productId, newQuantity: 12, reason: 'recount' }, userId);
    expect(await stockOf()).toBe(12);
  });

  it('rejects a negative target', async () => {
    await expect(inventoryService.adjustStock({ productId, newQuantity: -1 }, userId))
      .rejects.toThrow(/non-negative/i);
    expect(await stockOf()).toBe(10);
  });
});
