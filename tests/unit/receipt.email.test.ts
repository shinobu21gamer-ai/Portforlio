/**
 * The emailed receipt has to have a body in both MIME parts.
 *
 * `sendEmail()` falls back to `text: text || subject`, so before
 * `receiptEmailText` existed a customer on a plain-text client (or any client
 * that prefers text/plain) received a "receipt" consisting of the subject line
 * and nothing else — the email equivalent of the blank printed slip.
 */
import { describe, expect, it } from 'vitest';

process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';

const { receiptEmail, receiptEmailText } = require('../../src/utils/emailTemplates');

const items = [
  { name: 'Coke Mismo 295ml', quantity: 12, subtotal: 264 },
  { name: 'Lucky Me Pancit Canton', quantity: 5, subtotal: 77.5 },
];

describe('receiptEmailText', () => {
  it('carries the invoice, every line, the total and the tender', () => {
    const text = receiptEmailText('Juan Dela Cruz', 'INV-20261006-0042', items, 490.39, 'cash', [
      { amount: 490.39, paymentMethod: 'cash', status: 'completed' },
    ]);

    expect(text).toContain('INV-20261006-0042');
    expect(text).toContain('Juan Dela Cruz');
    expect(text).toContain('Coke Mismo 295ml x 12');
    expect(text).toContain('PHP 264.00');
    expect(text).toContain('Lucky Me Pancit Canton x 5');
    expect(text).toContain('TOTAL: PHP 490.39');
    expect(text).toContain('Payment: cash');
    expect(text.trim().length).toBeGreaterThan(100);
  });

  it('lists every completed split leg and ignores refunds', () => {
    const text = receiptEmailText('Ana', 'INV-9', items, 560, 'split', [
      { amount: 300, paymentMethod: 'cash', status: 'completed' },
      { amount: 260, paymentMethod: 'gcash', status: 'completed', reference: 'GC-1' },
      { amount: 50, paymentMethod: 'cash', status: 'refunded' },
    ]);

    expect(text).toContain('Paid with:');
    expect(text).toContain('cash  PHP 300.00');
    expect(text).toContain('gcash (GC-1)  PHP 260.00');
    expect(text).not.toContain('refunded');
  });

  it('never produces an empty body', () => {
    const text = receiptEmailText('Walk-in', 'INV-0', [], 0, 'cash', []);
    expect(text).toContain('INV-0');
    expect(text).toContain('no items recorded');
    expect(text).toContain('TOTAL: PHP 0.00');
  });
});

describe('receiptEmail (html part)', () => {
  it('still renders the lines and total', () => {
    const html = receiptEmail('Juan Dela Cruz', 'INV-20261006-0042', items, 490.39, 'cash', [
      { amount: 490.39, paymentMethod: 'cash', status: 'completed' },
    ]);
    expect(html).toContain('INV-20261006-0042');
    expect(html).toContain('Coke Mismo 295ml');
    expect(html).toContain('490.39');
    expect(html).toContain('<!DOCTYPE html>');
  });
});
