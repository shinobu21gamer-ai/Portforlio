/**
 * Phase 6 — attendance math: geofence haversine, night-shift hours,
 * holiday / rest-day premiums.
 */
import { describe, it, expect } from 'vitest';

const attendanceService = require('../../../src/services/hrms/attendance.service');
const {
  distanceMeters,
  computeNightShiftHours,
  computeHolidayPay,
  computeRestDayPay,
  getHolidayType,
} = attendanceService._math;

describe('attendance math — geofence (haversine)', () => {
  it('is 0 for the same point', () => {
    expect(distanceMeters(14.5995, 120.9842, 14.5995, 120.9842)).toBe(0);
  });

  it('is ~1.11 km for a 0.01° latitude shift at the equator-ish PH latitudes', () => {
    const m = distanceMeters(14.5995, 120.9842, 14.6095, 120.9842);
    expect(m).toBeGreaterThan(1000);
    expect(m).toBeLessThan(1300);
  });
});

describe('attendance math — night-shift hours', () => {
  it('counts only the 22:00–06:00 window', () => {
    // 21:00–23:00 local → 1 hour of night (22:00–23:00)
    const hours = computeNightShiftHours('2026-03-01T21:00:00', '2026-03-01T23:00:00');
    expect(hours).toBe(1);
  });

  it('is zero for a daytime shift', () => {
    expect(computeNightShiftHours('2026-03-01T09:00:00', '2026-03-01T18:00:00')).toBe(0);
  });
});

describe('attendance math — holiday / rest-day pay', () => {
  it('pays 200% of hourly for a regular holiday and 130% for special', () => {
    expect(computeHolidayPay('regular', 8, 100)).toBe(1600);
    expect(computeHolidayPay('special', 8, 100)).toBe(1040);
    expect(computeHolidayPay('none', 8, 100)).toBe(0);
  });

  it('pays the 30% rest-day premium on hours worked', () => {
    expect(computeRestDayPay(8, 100)).toBe(240);
  });

  it('classifies Christmas as regular and a Sunday as special', () => {
    expect(getHolidayType('2026-12-25')).toBe('regular');
    expect(getHolidayType('2026-12-06')).toBe('special');
    expect(getHolidayType('2026-12-01')).toBe('none');
  });
});
