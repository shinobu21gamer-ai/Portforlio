import { describe, it, expect } from 'vitest';

const {
  escapeLike,
  generateSKU,
  generateBarcode,
  generateInvoiceNo,
  generateOrderNo,
  slugify,
  calculateTax,
  calculateDiscount,
  getPagination,
  getPaginationMeta,
  sanitizeObject,
  escapeHtml,
  generateEmployeeNo,
} = require('../../src/utils/helpers');

describe('escapeLike', () => {
  it('escapes SQL LIKE wildcards so a search term cannot match everything', () => {
    expect(escapeLike('%')).toBe('\\%');
    expect(escapeLike('_')).toBe('\\_');
    expect(escapeLike('100%_off')).toBe('100\\%\\_off');
  });

  it('returns an empty string for falsy input', () => {
    expect(escapeLike('')).toBe('');
    expect(escapeLike(null)).toBe('');
    expect(escapeLike(undefined)).toBe('');
  });

  it('leaves ordinary text alone', () => {
    expect(escapeLike('Bukon')).toBe('Bukon');
  });
});

describe('generateSKU', () => {
  it('builds a SKU from a 3-letter category prefix and a padded index', () => {
    expect(generateSKU('Beverages', 7)).toMatch(/^BEV-[0-9A-F]{6}-0007$/);
  });

  it('falls back to PRD when no category is given', () => {
    expect(generateSKU(null, 1)).toMatch(/^PRD-[0-9A-F]{6}-0001$/);
  });

  it('does not repeat across calls', () => {
    const codes = new Set(Array.from({ length: 25 }, () => generateSKU('Beverages', 1)));
    expect(codes.size).toBe(25);
  });
});

describe('generateBarcode', () => {
  it('produces a 13-digit numeric code', () => {
    expect(generateBarcode()).toMatch(/^\d{13}$/);
  });
});

describe('generateInvoiceNo / generateOrderNo', () => {
  it('uses the supplied prefix and a YYMMDD stamp', () => {
    const now = new Date();
    const y = String(now.getFullYear()).slice(-2);
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    expect(generateInvoiceNo('SAL')).toMatch(new RegExp(`^SAL-${y}${m}${d}-[0-9A-F]{8}$`));
    expect(generateOrderNo('PO')).toMatch(new RegExp(`^PO-${y}${m}${d}-[0-9A-F]{8}$`));
  });

  it('defaults the invoice prefix to INV', () => {
    expect(generateInvoiceNo()).toMatch(/^INV-\d{6}-[0-9A-F]{8}$/);
  });
});

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Fresh Milk')).toBe('fresh-milk');
  });

  it('strips punctuation', () => {
    expect(slugify('BGC & Deli!')).toBe('bgc-deli');
  });

  it('collapses repeated hyphens and trims the ends', () => {
    expect(slugify('  --Hello---World--  ')).toBe('hello-world');
  });
});

describe('calculateTax', () => {
  it('applies the rate and rounds to 2 decimals', () => {
    expect(calculateTax(1000, 0.12)).toBe(120);
    expect(calculateTax(111.11, 0.12)).toBe(13.33);
  });

  it('returns 0 for a zero rate', () => {
    expect(calculateTax(1000, 0)).toBe(0);
  });
});

describe('calculateDiscount', () => {
  it('applies a percentage discount', () => {
    expect(calculateDiscount(1000, 'percentage', 10)).toBe(100);
  });

  it('clamps a percentage into 0-100 so it cannot exceed the subtotal', () => {
    expect(calculateDiscount(1000, 'percentage', 150)).toBe(1000);
    expect(calculateDiscount(1000, 'percentage', -20)).toBe(0);
  });

  it('caps a fixed discount at the subtotal', () => {
    expect(calculateDiscount(100, 'fixed', 5000)).toBe(100);
    expect(calculateDiscount(100, 'fixed', 40)).toBe(40);
  });

  it('treats a negative fixed discount as zero', () => {
    expect(calculateDiscount(100, 'fixed', -5)).toBe(0);
  });
});

describe('getPagination', () => {
  it('defaults to page 1 and limit 10', () => {
    expect(getPagination()).toEqual({ page: 1, limit: 10, offset: 0 });
  });

  it('computes the offset', () => {
    expect(getPagination(3, 20)).toEqual({ page: 3, limit: 20, offset: 40 });
  });

  it('caps the limit at 100', () => {
    expect(getPagination(1, 5000).limit).toBe(100);
  });

  it('treats a non-positive limit as a bulk request capped at 1000', () => {
    expect(getPagination(1, 0).limit).toBe(1000);
    expect(getPagination(1, -5).limit).toBe(1000);
  });

  it('never allows a page below 1', () => {
    expect(getPagination(0, 10)).toEqual({ page: 1, limit: 10, offset: 0 });
    expect(getPagination(-3, 10).page).toBe(1);
  });

  it('coerces junk input to safe defaults', () => {
    expect(getPagination('abc', 'xyz')).toEqual({ page: 1, limit: 10, offset: 0 });
  });
});

describe('getPaginationMeta', () => {
  it('reports totals and page counts', () => {
    expect(getPaginationMeta(45, 2, 20)).toEqual({
      page: 2,
      limit: 20,
      totalItems: 45,
      totalPages: 3,
      hasNextPage: true,
      hasPrevPage: true,
    });
  });

  it('clears the prev flag on the first page', () => {
    expect(getPaginationMeta(45, 1, 20).hasPrevPage).toBe(false);
  });

  it('clears the next flag on the last page', () => {
    expect(getPaginationMeta(45, 3, 20).hasNextPage).toBe(false);
  });

  it('handles an empty result set', () => {
    const meta = getPaginationMeta(0, 1, 20);
    expect(meta.totalPages).toBe(0);
    expect(meta.hasNextPage).toBe(false);
  });
});

describe('sanitizeObject', () => {
  it('drops empty, null and undefined values', () => {
    expect(sanitizeObject({ a: 1, b: '', c: null, d: undefined })).toEqual({ a: 1 });
  });

  it('trims strings', () => {
    expect(sanitizeObject({ name: '  Test  ' })).toEqual({ name: 'Test' });
  });

  it('strips HTML tags from strings', () => {
    expect(sanitizeObject({ bio: 'Hello <script>alert(1)</script>World' })).toEqual({ bio: 'Hello alert(1)World' });
  });

  it('leaves non-string values alone', () => {
    expect(sanitizeObject({ n: 0, b: false })).toEqual({ n: 0, b: false });
  });

  it('does not mutate the input', () => {
    const input = { a: '  x  ' };
    sanitizeObject(input);
    expect(input.a).toBe('  x  ');
  });
});

describe('escapeHtml', () => {
  it('escapes all five dangerous characters', () => {
    expect(escapeHtml('<a href="x">\'&\'</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&#039;&amp;&#039;&lt;/a&gt;');
  });

  it('coerces non-strings', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(42)).toBe('42');
  });
});

describe('generateEmployeeNo', () => {
  const fakeSequelize = (rows) => ({ query: async () => [rows] });

  it('starts at EMP-0001 when the table is empty', async () => {
    expect(await generateEmployeeNo(fakeSequelize([]))).toBe('EMP-0001');
  });

  it('increments past the highest existing number', async () => {
    expect(await generateEmployeeNo(fakeSequelize([{ maxNum: 7 }]))).toBe('EMP-0008');
  });

  it('zero-pads to four digits', async () => {
    expect(await generateEmployeeNo(fakeSequelize([{ maxNum: 1234 }]))).toBe('EMP-1235');
  });
});
