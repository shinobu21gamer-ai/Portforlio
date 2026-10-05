/**
 * Phase 6 — money/tax: product taxRate may be stored as 12 (percent) or
 * 0.12 (fraction). Both must produce the same peso tax on a sale.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';

const models = require('../../src/models');
const { sequelize, Product, Sale, SaleItem, Payment, StockMovement, Category, Role, User } = models;
const saleService = require('../../src/services/sale.service');
const { calculateTax, calculateDiscount } = require('../../src/utils/helpers');

let userId: number;
let categoryId: number;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  const role = await Role.create({ name: 'Cashier', slug: 'cashier' });
  const user = await User.create({
    firstName: 'Tax', lastName: 'Cashier', email: 'tax@test.local',
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
  const cat = await Category.create({ name: 'Tax Cat', slug: 'tax-cat' });
  categoryId = cat.id;
});

describe('helpers — calculateTax / calculateDiscount', () => {
  it('rounds tax to 2 decimals', () => {
    expect(calculateTax(100, 0.12)).toBe(12);
    expect(calculateTax(33.33, 0.12)).toBe(4);
  });

  it('caps a percentage discount at 100% and a fixed discount at the subtotal', () => {
    expect(calculateDiscount(100, 'percentage', 10)).toBe(10);
    expect(calculateDiscount(100, 'percentage', 150)).toBe(100);
    expect(calculateDiscount(100, 'fixed', 30)).toBe(30);
    expect(calculateDiscount(100, 'fixed', 150)).toBe(100);
  });
});

describe('sale.service — taxRate 12 vs 0.12', () => {
  it('produces the same ₱12 tax on a ₱100 item', async () => {
    const percent = await Product.create({
      name: 'Percent Tax', slug: 'pct-tax', sku: 'TAX-P', barcode: '4000000000001',
      categoryId, sellingPrice: 100, buyingPrice: 50, stockQuantity: 10, isActive: true, taxRate: 12,
    });
    const fraction = await Product.create({
      name: 'Fraction Tax', slug: 'frac-tax', sku: 'TAX-F', barcode: '4000000000002',
      categoryId, sellingPrice: 100, buyingPrice: 50, stockQuantity: 10, isActive: true, taxRate: 0.12,
    });

    const salePct = await saleService.create(
      { items: [{ productId: percent.id, quantity: 1 }], paymentMethod: 'cash', cashAmount: 200 },
      userId,
    );
    const saleFrac = await saleService.create(
      { items: [{ productId: fraction.id, quantity: 1 }], paymentMethod: 'cash', cashAmount: 200 },
      userId,
    );

    expect(salePct.taxAmount).toBe(12);
    expect(saleFrac.taxAmount).toBe(12);
    expect(salePct.total).toBe(112);
    expect(saleFrac.total).toBe(112);
  });
});
