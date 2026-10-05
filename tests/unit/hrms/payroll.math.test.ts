/**
 * Phase 6 — pure payroll math (SSS / PhilHealth / Pag-IBIG / TRAIN tax /
 * overtime / night differential / 13th month). These helpers used to be
 * unexported; calling them through payrollService._math locks the known
 * numbers so a table or rate change can't silently mispay people.
 */
import { describe, it, expect } from 'vitest';

const payrollService = require('../../../src/services/hrms/payroll.service');
const {
  computeSSS,
  computePhilHealth,
  computePagIBIG,
  computeTax,
  computeTaxMonthly,
  computeNightDiff,
  computeOvertimePay,
  compute13thMonth,
  countWorkingDays,
  getHolidayType,
} = payrollService._math;

describe('payroll math — SSS', () => {
  it('uses the 2024 table for a ₱40,000 MSC (top bracket ₱1,125)', () => {
    expect(computeSSS(40000, 2024)).toBe(1125);
  });

  it('uses the 2025 table for the same MSC (top bracket, not 2024)', () => {
    expect(computeSSS(40000, 2025)).not.toBe(1125);
    expect(computeSSS(40000, 2025)).toBeGreaterThan(1125);
  });

  it('picks the lowest bracket for a tiny salary', () => {
    expect(computeSSS(2000, 2024)).toBe(135);
  });

  it('throws when the year has no table', () => {
    expect(() => computeSSS(40000, 2030)).toThrow(/SSS table not defined/i);
  });
});

describe('payroll math — PhilHealth / Pag-IBIG', () => {
  it('splits 5% of MSC 50/50 and caps the employee share at ₱2,500', () => {
    // ₱40,000 × 5% = ₱2,000 → EE ₱1,000
    expect(computePhilHealth(40000)).toBe(1000);
    // Ceiling ₱100,000 × 5% = ₱5,000 → EE ₱2,500
    expect(computePhilHealth(200000)).toBe(2500);
    // Floor ₱10,000 × 5% = ₱500 → EE ₱250
    expect(computePhilHealth(1000)).toBe(250);
  });

  it('caps Pag-IBIG at ₱100 (2% of MSC, max ₱5,000 MSC)', () => {
    expect(computePagIBIG(40000)).toBe(100);
    expect(computePagIBIG(3000)).toBe(60);
    expect(computePagIBIG(5000)).toBe(100);
  });
});

describe('payroll math — TRAIN withholding', () => {
  it('is zero at or below the ₱20,833 monthly exemption', () => {
    expect(computeTaxMonthly(20833)).toBe(0);
    expect(computeTax(20833, false)).toBe(0);
  });

  it('applies 15% on the excess in the first positive bracket', () => {
    expect(computeTaxMonthly(20834)).toBeCloseTo(0.15, 5);
  });

  it('applies the ₱40,000 monthly formula: 1,875 + 20% over 33,333', () => {
    const expected = 1875 + (40000 - 33333) * 0.20;
    expect(computeTax(40000, false)).toBe(parseFloat(expected.toFixed(2)));
  });

  it('uses the semi-monthly table when asked', () => {
    expect(computeTax(10417, true)).toBe(0);
    expect(computeTax(20000, true)).toBeGreaterThan(0);
  });
});

describe('payroll math — premiums', () => {
  it('prices overtime at the PH labor-code multipliers', () => {
    expect(computeOvertimePay(2, 100, 'none', false)).toBe(250); // 1.25x
    expect(computeOvertimePay(2, 100, 'none', true)).toBe(260); // 1.30x rest day
    expect(computeOvertimePay(2, 100, 'special', false)).toBeCloseTo(338, 5); // 1.69x
    expect(computeOvertimePay(2, 100, 'regular', false)).toBe(520); // 2.60x
  });

  it('prices night differential at 10%', () => {
    expect(computeNightDiff(2, 100)).toBe(20);
  });

  it('computes 13th month as YTD basic / 12', () => {
    expect(compute13thMonth(480000, 12)).toBe(40000);
    expect(compute13thMonth(480000, 0)).toBe(0);
  });
});

describe('payroll math — working days / holidays', () => {
  it('flags Christmas as a regular holiday and a Sunday as special', () => {
    expect(getHolidayType('2026-12-25')).toBe('regular');
    expect(getHolidayType('2026-12-06')).toBe('special'); // Sunday
    expect(getHolidayType('2026-12-01')).toBe('none'); // Tuesday
  });

  it('excludes weekends and holidays from working-day counts', () => {
    // Dec 2026: Christmas (Fri) + Rizal Day (Wed) + Last Day (Thu) are regular
    const days = countWorkingDays('2026-12-01', '2026-12-31');
    let weekdays = 0;
    const d = new Date('2026-12-01T00:00:00');
    while (d <= new Date('2026-12-31T00:00:00')) {
      if (d.getDay() !== 0 && d.getDay() !== 6) weekdays++;
      d.setDate(d.getDate() + 1);
    }
    expect(days).toBeLessThan(weekdays);
    expect(days).toBeGreaterThan(0);
  });
});
