import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';

const { sequelize, Discount } = require('../../src/models');
const discountService = require('../../src/services/discount.service');

const baseDiscount = (overrides = {}) => ({
  code: 'SAVE10',
  name: 'Save 10%',
  type: 'percentage',
  value: 10,
  isActive: true,
  ...overrides,
});

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await Discount.destroy({ where: {}, force: true });
});

describe('discount.service - stacking rules', () => {
  it('allows percentage + fixed together', () => {
    expect(discountService._validateDiscountStacking([{ type: 'percentage' }, { type: 'fixed' }])).toEqual({ valid: true });
  });

  it('rejects two percentage discounts', () => {
    const r = discountService._validateDiscountStacking([{ type: 'percentage' }, { type: 'percentage' }]);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/multiple percentage/i);
  });

  it('rejects two fixed discounts', () => {
    const r = discountService._validateDiscountStacking([{ type: 'fixed' }, { type: 'fixed' }]);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/multiple fixed/i);
  });

  it('rejects BXGY combined with anything', () => {
    const r = discountService._validateDiscountStacking([{ type: 'bxgy' }, { type: 'percentage' }]);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/BXGY/i);
  });

  it('rejects senior combined with anything', () => {
    const r = discountService._validateDiscountStacking([{ type: 'senior' }, { type: 'fixed' }]);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/senior/i);
  });

  it('allows a lone senior discount', () => {
    expect(discountService._validateDiscountStacking([{ type: 'senior' }])).toEqual({ valid: true });
  });
});

describe('discount.service - validateAndApply', () => {
  it('computes a percentage discount off the subtotal', async () => {
    await Discount.create(baseDiscount());
    const { discountAmount, discount } = await discountService.validateAndApply('SAVE10', 1000);
    expect(discountAmount).toBe(100);
    expect(discount.code).toBe('SAVE10');
  });

  it('is case-insensitive on the code', async () => {
    await Discount.create(baseDiscount());
    const { discountAmount } = await discountService.validateAndApply('save10', 1000);
    expect(discountAmount).toBe(100);
  });

  it('caps a fixed discount at the subtotal so the total cannot go negative', async () => {
    await Discount.create(baseDiscount({ code: 'BIGFIX', type: 'fixed', value: 5000 }));
    const { discountAmount } = await discountService.validateAndApply('BIGFIX', 100);
    expect(discountAmount).toBe(100);
  });

  it('respects maxDiscountAmount as a ceiling on a percentage', async () => {
    await Discount.create(baseDiscount({ value: 50, maxDiscountAmount: 200 }));
    const { discountAmount } = await discountService.validateAndApply('SAVE10', 1000);
    expect(discountAmount).toBe(200);
  });

  it('rejects a subtotal below the minimum purchase', async () => {
    await Discount.create(baseDiscount({ minPurchaseAmount: 500 }));
    await expect(discountService.validateAndApply('SAVE10', 100)).rejects.toThrow(/Minimum purchase/i);
  });

  it('rejects a code past its usage limit', async () => {
    await Discount.create(baseDiscount({ usageLimit: 5, usedCount: 5 }));
    await expect(discountService.validateAndApply('SAVE10', 1000)).rejects.toThrow(/usage limit/i);
  });

  it('rejects an inactive code', async () => {
    await Discount.create(baseDiscount({ isActive: false }));
    await expect(discountService.validateAndApply('SAVE10', 1000)).rejects.toThrow(/not found or expired/i);
  });

  it('rejects a code that has not started yet', async () => {
    await Discount.create(baseDiscount({ startDate: new Date(Date.now() + 86400000) }));
    await expect(discountService.validateAndApply('SAVE10', 1000)).rejects.toThrow(/not found or expired/i);
  });

  it('rejects a code that has already ended', async () => {
    await Discount.create(baseDiscount({ endDate: new Date(Date.now() - 86400000) }));
    await expect(discountService.validateAndApply('SAVE10', 1000)).rejects.toThrow(/not found or expired/i);
  });

  it('rejects an unknown code', async () => {
    await expect(discountService.validateAndApply('GONE', 1000)).rejects.toThrow(/not found or expired/i);
  });

  it('rejects stacking a second percentage discount', async () => {
    await Discount.create(baseDiscount());
    await expect(
      discountService.validateAndApply('SAVE10', 1000, [{ type: 'percentage' }])
    ).rejects.toThrow(/multiple percentage/i);
  });

  it('rejects applying a senior code on top of another discount', async () => {
    await Discount.create(baseDiscount({ code: 'SENIOR', type: 'senior', value: 0 }));
    await expect(
      discountService.validateAndApply('SENIOR', 1000, [{ type: 'percentage' }])
    ).rejects.toThrow(/senior/i);
  });

  it('allows stacking a fixed discount on a percentage', async () => {
    await Discount.create(baseDiscount({ code: 'FIVEOFF', type: 'fixed', value: 5 }));
    const { discountAmount } = await discountService.validateAndApply('FIVEOFF', 100, [{ type: 'percentage' }]);
    expect(discountAmount).toBe(5);
  });
});

describe('discount.service - create', () => {
  it('uppercases the code before saving', async () => {
    const { discount } = await discountService.create({ code: 'lower10', name: 'Lower Ten', type: 'percentage', value: 10 });
    expect(discount.code).toBe('LOWER10');
  });

  it('rejects a duplicate code regardless of case', async () => {
    await Discount.create(baseDiscount());
    await expect(discountService.create({ code: 'save10', name: 'Dupe', type: 'percentage', value: 10 })).rejects.toThrow(/already exists/i);
  });

  it('rejects a percentage above 100', async () => {
    await expect(
      discountService.create({ code: 'TOOBIG', name: 'Too Big', type: 'percentage', value: 150 })
    ).rejects.toThrow(/cannot exceed 100/i);
  });

  it('rejects a null name via the model', async () => {
    await expect(
      discountService.create({ code: 'NONAME', type: 'percentage', value: 10 })
    ).rejects.toThrow();
  });
});

describe('discount.service - update', () => {
  it('updates a field', async () => {
    const { discount } = await discountService.create({ code: 'UPD', name: 'Before', type: 'percentage', value: 10 });
    const res = await discountService.update(discount.id, { name: 'After' });
    expect(res.discount.name).toBe('After');
  });

  it('rejects renaming to a code that already exists', async () => {
    const { discount } = await discountService.create({ code: 'OLD', name: 'Old', type: 'percentage', value: 10 });
    await Discount.create(baseDiscount({ code: 'TAKEN', name: 'Taken' }));
    await expect(discountService.update(discount.id, { code: 'taken' })).rejects.toThrow(/already exists/i);
  });

  it('allows a no-op save back to the same code', async () => {
    const { discount } = await discountService.create({ code: 'SAME', name: 'Same', type: 'percentage', value: 10 });
    const res = await discountService.update(discount.id, { code: 'SAME', value: 20 });
    expect(res.discount.value).toBe(20);
  });

  it('throws when the discount does not exist', async () => {
    await expect(discountService.update(999999, { name: 'x' })).rejects.toThrow(/not found/i);
  });

  it('rejects raising a percentage above 100', async () => {
    const { discount } = await discountService.create({ code: 'PCT', name: 'Pct', type: 'percentage', value: 10 });
    await expect(discountService.update(discount.id, { value: 101 })).rejects.toThrow(/cannot exceed 100/i);
  });
});

describe('discount.service - delete', () => {
  it('soft deletes a discount', async () => {
    const { discount } = await discountService.create({ code: 'GONE', name: 'Gone', type: 'percentage', value: 10 });
    await discountService.delete(discount.id);
    await expect(discountService.getById(discount.id)).rejects.toThrow(/not found/i);
  });

  it('throws when deleting a missing discount', async () => {
    await expect(discountService.delete(999999)).rejects.toThrow(/not found/i);
  });
});

describe('discount.service - getAll', () => {
  it('paginates and returns metadata', async () => {
    await Discount.create(baseDiscount({ code: 'AAA', name: 'A' }));
    await Discount.create(baseDiscount({ code: 'BBB', name: 'B' }));
    const res = await discountService.getAll({ page: 1, limit: 1 });
    expect(res.discounts).toHaveLength(1);
    expect(res.pagination.totalItems).toBe(2);
    expect(res.pagination.hasNextPage).toBe(true);
  });

  it('filters by type', async () => {
    await Discount.create(baseDiscount({ code: 'PCT', name: 'Pct' }));
    await Discount.create(baseDiscount({ code: 'FIX', name: 'Fix', type: 'fixed', value: 5 }));
    const res = await discountService.getAll({ type: 'fixed' });
    expect(res.discounts).toHaveLength(1);
    expect(res.discounts[0].code).toBe('FIX');
  });

  it('filters out inactive records', async () => {
    await Discount.create(baseDiscount({ code: 'ON', name: 'On', isActive: true }));
    await Discount.create(baseDiscount({ code: 'OFF', name: 'Off', isActive: false }));
    const res = await discountService.getAll({ isActive: 'true' });
    expect(res.discounts).toHaveLength(1);
    expect(res.discounts[0].code).toBe('ON');
  });

  it('searches by code without letting wildcards match everything', async () => {
    await Discount.create(baseDiscount({ code: 'SAVE10', name: 'Save' }));
    await Discount.create(baseDiscount({ code: 'OTHER', name: 'Other' }));
    expect((await discountService.getAll({ search: 'SAVE' })).discounts).toHaveLength(1);
    expect((await discountService.getAll({ search: '%' })).discounts).toHaveLength(0);
  });

  it('falls back to a safe sort column when given an unknown one', async () => {
    await Discount.create(baseDiscount());
    await expect(discountService.getAll({ sortBy: 'value; DROP TABLE discounts' })).resolves.toBeTruthy();
  });
});

describe('discount.service - incrementUsage', () => {
  it('increments usedCount', async () => {
    const { discount } = await discountService.create({ code: 'USE', name: 'Use', type: 'percentage', value: 10 });
    const res = await discountService.incrementUsage(discount.id);
    expect(res.discount.usedCount).toBe(1);
    const reread = await Discount.findByPk(discount.id);
    expect(reread.usedCount).toBe(1);
  });

  it('accumulates across repeated increments', async () => {
    const { discount } = await discountService.create({ code: 'USE2', name: 'Use2', type: 'percentage', value: 10 });
    await discountService.incrementUsage(discount.id);
    const res = await discountService.incrementUsage(discount.id);
    expect(res.discount.usedCount).toBe(2);
  });

  it('throws for a missing discount', async () => {
    await expect(discountService.incrementUsage(999999)).rejects.toThrow(/not found/i);
  });
});
