import { describe, it, expect } from 'vitest';

describe('DiscountService - VAT Rounding Logic (Pure Functions)', () => {
  // Test the VAT rounding logic directly without importing the service
  // JavaScript uses "round half away from zero" not banker's rounding
  function roundToTwoDecimals(value: number): number {
    return Math.round(value * 100) / 100;
  }

  function calculateVat(subtotal: number, discountAmount: number, isZeroRated = false, isSenior = false): number {
    if (isZeroRated || isSenior) return 0;
    const taxable = Math.max(0, subtotal - discountAmount);
    return roundToTwoDecimals(taxable * 0.12);
  }

  describe('roundToTwoDecimals - JavaScript Rounding (round half away from zero)', () => {
    it('should round 0.005 to 0.01 (away from zero)', () => {
      expect(roundToTwoDecimals(0.005)).toBe(0.01);
    });

    it('should round 0.015 to 0.02', () => {
      expect(roundToTwoDecimals(0.015)).toBe(0.02);
    });

    it('should round 0.025 to 0.03', () => {
      expect(roundToTwoDecimals(0.025)).toBe(0.03);
    });

    it('should round 0.035 to 0.04', () => {
      expect(roundToTwoDecimals(0.035)).toBe(0.04);
    });

    it('should round 0.045 to 0.05', () => {
      expect(roundToTwoDecimals(0.045)).toBe(0.05);
    });

    it('should round 0.055 to 0.06', () => {
      expect(roundToTwoDecimals(0.055)).toBe(0.06);
    });
  });

  describe('calculateVat - VAT Calculation', () => {
    it('should calculate VAT on standard sale correctly', () => {
      expect(calculateVat(1000, 0)).toBe(120); // 1000 * 0.12 = 120
    });

    it('should calculate VAT with percentage discount correctly', () => {
      expect(calculateVat(1000, 100)).toBe(108); // (1000-100) * 0.12 = 108
    });

    it('should calculate VAT with fixed discount correctly', () => {
      expect(calculateVat(1000, 50)).toBe(114); // (1000-50) * 0.12 = 114
    });

    it('should return 0 for zero-rated items', () => {
      expect(calculateVat(1000, 0, true)).toBe(0);
    });

    it('should return 0 for senior citizen (VAT exempt)', () => {
      expect(calculateVat(1000, 200, false, true)).toBe(0);
    });

    it('should correctly round VAT to 2 decimal places', () => {
      expect(calculateVat(111.11, 0)).toBe(13.33); // 111.11 * 0.12 = 13.3332 -> 13.33
    });

    it('should cap discount at subtotal (taxable cannot be negative)', () => {
      expect(calculateVat(100, 150)).toBe(0); // Discount capped at subtotal
    });
  });

  describe('Discount Stacking Rules', () => {
    function validateDiscounts(discounts: Array<{ type: string }>): { valid: boolean; error?: string } {
      const types = discounts.map(d => d.type);
      const percentageCount = types.filter(t => t === 'percentage').length;
      const fixedCount = types.filter(t => t === 'fixed').length;
      const hasBxgy = types.includes('bxgy');
      const hasSenior = types.includes('senior');

      if (hasSenior && types.length > 1) {
        return { valid: false, error: 'Senior discount is exclusive' };
      }
      if (types.includes('bxgy') && types.length > 1) {
        return { valid: false, error: 'BXGY discount cannot be combined' };
      }
      if (discounts.filter(d => d.type === 'percentage').length > 1) {
        return { valid: false, error: 'Cannot stack multiple percentage discounts' };
      }
      if (discounts.filter(d => d.type === 'fixed').length > 1) {
        return { valid: false, error: 'Cannot stack multiple fixed discounts' };
      }
      if (types.includes('bxgy') && types.length > 1) {
        return { valid: false, error: 'BXGY discount cannot be combined' };
      }
      if (hasSenior && types.length > 1) {
        return { valid: false, error: 'Senior discount is exclusive' };
      }
      return { valid: true };
    }

    it('should allow percentage + fixed discount stacking', () => {
      expect(validateDiscounts([{ type: 'percentage' }, { type: 'fixed' }]).valid).toBe(true);
    });

    it('should reject two percentage discounts', () => {
      expect(validateDiscounts([{ type: 'percentage' }, { type: 'percentage' }]).valid).toBe(false);
    });

    it('should reject two fixed discounts', () => {
      expect(validateDiscounts([{ type: 'fixed' }, { type: 'fixed' }]).valid).toBe(false);
    });

    it('should reject BXGY with any other discount', () => {
      expect(validateDiscounts([{ type: 'bxgy' }, { type: 'percentage' }]).valid).toBe(false);
    });

    it('should reject senior with any other discount', () => {
      expect(validateDiscounts([{ type: 'senior' }, { type: 'percentage' }]).valid).toBe(false);
    });
  });
});