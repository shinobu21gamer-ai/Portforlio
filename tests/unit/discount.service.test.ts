import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../src/models', () => ({
  Discount: {
    findOne: vi.fn(),
    findByPk: vi.fn(),
    create: vi.fn(),
    findAndCountAll: vi.fn(),
  },
  Op: {
    and: 'AND',
    or: 'OR',
    lte: '<=',
    gte: '>=',
  },
}));

import discountService from '../../../src/services/discount.service';

describe('DiscountService - VAT Rounding (BIR Compliance)', () => {
  let mockDiscount: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDiscount = {
      id: 1,
      code: 'TEST10',
      name: 'Test 10%',
      type: 'percentage',
      value: '10',
      minPurchaseAmount: '0',
      maxDiscountAmount: null,
      usageLimit: null,
      usedCount: 0,
      startDate: null,
      endDate: null,
      isActive: true,
    };
  });

  describe('validateAndApply - Discount Calculation', () => {
    it('should calculate percentage discount correctly', async () => {
      const mockGetByCode = vi.spyOn(discountService, 'getByCode').mockResolvedValue({ discount: mockDiscount });

      const result = await discountService.validateAndApply('TEST10', 1000);

      expect(result.discountAmount).toBe(100);
      expect(result.discount.value).toBe(10);
    });

    it('should cap discount at subtotal for fixed discount', async () => {
      const fixedDiscount = { ...mockDiscount, type: 'fixed', value: '150' };
      const mockGetByCode = vi.spyOn(discountService, 'getByCode').mockResolvedValue({ discount: fixedDiscount });

      const result = await discountService.validateAndApply('FIXED150', 100);

      expect(result.discountAmount).toBe(100);
    });

    it('should apply maxDiscountAmount cap', async () => {
      const cappedDiscount = { ...mockDiscount, type: 'percentage', value: '50', maxDiscountAmount: '200' };
      const mockGetByCode = vi.spyOn(discountService, 'getByCode').mockResolvedValue({ discount: cappedDiscount });

      const result = await discountService.validateAndApply('CAPPED50', 1000);

      expect(result.discountAmount).toBe(200);
    });

    it('should throw if min purchase amount not met', async () => {
      const minPurchaseDiscount = { ...mockDiscount, minPurchaseAmount: '500' };
      const mockGetByCode = vi.spyOn(discountService, 'getByCode').mockResolvedValue({ discount: minPurchaseDiscount });

      await expect(discountService.validateAndApply('MIN500', 100)).rejects.toThrow('Minimum purchase amount');
    });

    it('should throw if usage limit reached', async () => {
      const limitedDiscount = { ...mockDiscount, usageLimit: 10, usedCount: 10 };
      const mockGetByCode = vi.spyOn(discountService, 'getByCode').mockResolvedValue({ discount: limitedDiscount });

      await expect(discountService.validateAndApply('LIMITED', 1000)).rejects.toThrow('usage limit reached');
    });
  });

  describe('create - Validation', () => {
    it('should reject percentage > 100', async () => {
      await expect(discountService.create({ type: 'percentage', value: '150', code: 'INVALID' }))
        .rejects.toThrow('Percentage discount cannot exceed 100%');
    });
  });
});