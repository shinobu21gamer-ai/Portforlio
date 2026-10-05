import { describe, it, expect } from 'vitest';

const {
  tzOffsetMinutes, localDayBounds, localDateStr, localMonthBounds,
  sqlLocalDateExpr, localDateBoundsForDate,
} = require('../../src/utils/timezone');

// PH is UTC+8, no DST: local midnight = 16:00 UTC the previous day.
describe('tzOffsetMinutes', () => {
  it('reports Asia/Manila as +480 minutes year-round', () => {
    expect(tzOffsetMinutes('Asia/Manila', new Date('2026-01-15T00:00:00Z'))).toBe(480);
    expect(tzOffsetMinutes('Asia/Manila', new Date('2026-07-15T00:00:00Z'))).toBe(480);
  });

  it('reports a DST zone with the offset in effect at that instant', () => {
    // Sydney: AEDT +11 in the southern summer (January), AEST +10 in July.
    expect(tzOffsetMinutes('Australia/Sydney', new Date('2026-01-15T00:00:00Z'))).toBe(660);
    expect(tzOffsetMinutes('Australia/Sydney', new Date('2026-07-15T00:00:00Z'))).toBe(600);
  });

  it('reports UTC as zero', () => {
    expect(tzOffsetMinutes('UTC', new Date('2026-03-01T12:00:00Z'))).toBe(0);
  });
});

describe('localDayBounds', () => {
  it('bounds the PH day for an instant inside it', () => {
    // 2026-10-05T16:30:00Z = 2026-10-06 00:30 PH → the PH day of Oct 6.
    const { start, end } = localDayBounds('Asia/Manila', new Date('2026-10-05T16:30:00Z'));
    expect(start.toISOString()).toBe('2026-10-05T16:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-06T16:00:00.000Z');
    expect(end.getTime() - start.getTime()).toBe(86400000);
  });

  it('keeps an instant just before local midnight in the previous PH day', () => {
    // 2026-10-05T15:59:59Z = 2026-10-05 23:59:59 PH
    const { start, end } = localDayBounds('Asia/Manila', new Date('2026-10-05T15:59:59Z'));
    expect(start.toISOString()).toBe('2026-10-04T16:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-05T16:00:00.000Z');
  });

  it('works in UTC without an offset', () => {
    const { start, end } = localDayBounds('UTC', new Date('2026-10-05T08:15:00Z'));
    expect(start.toISOString()).toBe('2026-10-05T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-06T00:00:00.000Z');
  });
});

describe('localDateStr', () => {
  it('returns the local calendar date, not the UTC one', () => {
    // Same instant, different "date" depending on the zone.
    expect(localDateStr('Asia/Manila', new Date('2026-10-05T15:59:59Z'))).toBe('2026-10-05');
    expect(localDateStr('Asia/Manila', new Date('2026-10-05T16:00:00Z'))).toBe('2026-10-06');
    expect(localDateStr('UTC', new Date('2026-10-05T16:00:00Z'))).toBe('2026-10-05');
  });
});

describe('localMonthBounds', () => {
  it('bounds the local month containing the instant', () => {
    // 2026-10-01T00:30:00Z = 2026-10-01 08:30 PH → October.
    const { start, end } = localMonthBounds('Asia/Manila', new Date('2026-10-01T00:30:00Z'));
    expect(start.toISOString()).toBe('2026-09-30T16:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-31T16:00:00.000Z');
  });

  it('does not fall into the previous month for early-morning PH instants', () => {
    // 2026-10-01T09:00:00Z = 2026-10-01 17:00 PH (UTC date Oct 1, PH date Oct 1)
    const { start } = localMonthBounds('Asia/Manila', new Date('2026-10-01T09:00:00Z'));
    expect(start.toISOString()).toBe('2026-09-30T16:00:00.000Z');
  });
});

describe('localDateBoundsForDate', () => {
  it('resolves a local YYYY-MM-DD to UTC-instant bounds', () => {
    const { start, end } = localDateBoundsForDate('Asia/Manila', '2026-10-05');
    expect(start.toISOString()).toBe('2026-10-04T16:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-05T16:00:00.000Z');
  });
});

describe('sqlLocalDateExpr', () => {
  it('emits date(col, offset) for SQLite', () => {
    expect(sqlLocalDateExpr('s.created_at', 'Asia/Manila', 'sqlite')).toBe("date(s.created_at, '+08:00')");
  });

  it('emits CONVERT_TZ for MySQL', () => {
    expect(sqlLocalDateExpr('s.created_at', 'Asia/Manila', 'mysql'))
      .toBe("DATE(CONVERT_TZ(s.created_at, '+00:00', '+08:00'))");
  });

  it('formats negative offsets correctly', () => {
    // New York in January = EST = UTC-5.
    expect(sqlLocalDateExpr('x', 'America/New_York', 'sqlite', new Date('2026-01-10T12:00:00Z')))
      .toBe("date(x, '-05:00')");
  });
});
