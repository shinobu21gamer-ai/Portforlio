/**
 * The receipt that comes out of the printer has to be the receipt on screen,
 * and neither may be empty. These cover the pure model/renderer that both the
 * success screen and the 80mm print document are built from — the sale payload
 * reaches the page under three different shapes (POST /sales, the PayMongo
 * verify response and the sessionStorage snapshot kept across the gateway
 * redirect), and a missed field alias is exactly what used to print a blank
 * slip.
 */
import { describe, expect, it } from 'vitest';
import {
  buildReceiptModel,
  escapeHtml,
  formatReceiptDate,
  money,
  normalizeItems,
  printHtmlDocument,
  renderReceiptHtml,
} from '../../frontend/src/utils/receipt';

const settings = {
  storeName: 'MiniMart',
  address: 'Poblacion, Cebu',
  phone: '032-123-4567',
  gcashNumber: '0917-000-0000',
  receiptFooter: 'Salamat po!',
  taxRate: 12,
};

// Shape returned by POST /sales (Sequelize JSON: strings, taxAmount/discountAmount).
const cashSale = {
  id: 42,
  invoiceNo: 'INV-20261006-0001',
  createdAt: '2026-10-06T09:12:00.000Z',
  subtotal: '250.00',
  discountAmount: '25.00',
  taxAmount: '27.00',
  total: '252.00',
  paymentMethod: 'cash',
  cashAmount: '300.00',
  changeAmount: '48.00',
  paymentStatus: 'paid',
  user: { firstName: 'Ana', lastName: 'Reyes' },
  customer: { firstName: 'Juan', lastName: 'Dela Cruz' },
  items: [
    {
      productName: 'Lucky Me Pancit Canton',
      quantity: 2,
      unitPrice: '15.00',
      subtotal: '30.00',
      taxAmount: '3.60',
      total: '33.60',
      product: { name: 'Lucky Me Pancit Canton', sku: 'SKU-1' },
    },
    {
      productName: 'Coke Mismo 295ml',
      quantity: 10,
      unitPrice: '22.00',
      subtotal: '220.00',
      discountAmount: '25.00',
      taxAmount: '23.40',
      total: '218.40',
    },
  ],
  payments: [{ amount: '252.00', paymentMethod: 'cash', status: 'completed' }],
};

describe('buildReceiptModel', () => {
  it('reads a completed cash sale (taxAmount / discountAmount / changeAmount)', () => {
    const m = buildReceiptModel({ sale: cashSale, settings });

    expect(m.invoiceNo).toBe('INV-20261006-0001');
    expect(m.items).toHaveLength(2);
    expect(m.items[0].name).toBe('Lucky Me Pancit Canton');
    expect(m.subtotal).toBe(250);
    expect(m.discount).toBe(25);
    expect(m.tax).toBe(27);
    expect(m.total).toBe(252);
    expect(m.tendered).toBe(300);
    expect(m.change).toBe(48);
    expect(m.isCash).toBe(true);
    expect(m.customerName).toBe('Juan Dela Cruz');
    expect(m.cashierName).toBe('Ana Reyes');
    expect(m.hasData).toBe(true);
  });

  it('lists every split leg that was actually completed', () => {
    const m = buildReceiptModel({
      sale: {
        invoiceNo: 'INV-9',
        subtotal: 500,
        taxAmount: 60,
        total: 560,
        paymentMethod: 'split',
        items: [{ productName: 'Rice 5kg', quantity: 2, unitPrice: 250, total: 560 }],
        payments: [
          { amount: 300, paymentMethod: 'cash', status: 'completed' },
          { amount: 260, paymentMethod: 'gcash', status: 'completed', reference: 'GC-1' },
          { amount: 50, paymentMethod: 'cash', status: 'refunded' },
        ],
      },
    });

    expect(m.isSplit).toBe(true);
    expect(m.isCash).toBe(false);
    expect(m.payments).toHaveLength(2);
    expect(m.payments.map((p) => p.method)).toEqual(['cash', 'gcash']);
  });

  it('falls back to the pending-sale snapshot when the verify payload is thin', () => {
    const m = buildReceiptModel({
      sale: { verified: true, paymentStatus: 'paid' },
      snapshot: {
        saleId: 77,
        invoiceNo: 'INV-77',
        subtotal: 150,
        tax: 18,
        total: 168,
        paymentMethod: 'gcash',
        items: [{ productName: 'Shampoo Sachet', quantity: 15, unitPrice: 10, total: 168 }],
      },
    });

    expect(m.invoiceNo).toBe('INV-77');
    expect(m.items[0].name).toBe('Shampoo Sachet');
    expect(m.tax).toBe(18);
    expect(m.total).toBe(168);
    expect(m.hasData).toBe(true);
  });

  it('can still print from the cart alone', () => {
    const m = buildReceiptModel({
      cartItems: [{ id: 5, name: 'Pandesal', quantity: 3, sellingPrice: 20 }],
      cart: { subtotal: 60, discount: 0, itemTax: 7.2, total: 67.2 },
      method: 'cash',
      cashAmount: '100',
    });

    expect(m.items[0].name).toBe('Pandesal');
    expect(m.subtotal).toBe(60);
    expect(m.total).toBe(67.2);
    expect(m.tendered).toBe(100);
    expect(m.change).toBe(32.8);
    expect(m.hasData).toBe(true);
  });

  it('flags a receipt with nothing on it instead of pretending it is fine', () => {
    const m = buildReceiptModel({});
    expect(m.hasData).toBe(false);
    expect(m.items).toHaveLength(0);
    expect(m.invoiceNo).toBe('N/A');
  });
});

describe('normalizeItems', () => {
  it('accepts server, cart and checkout line shapes', () => {
    const lines = normalizeItems([
      { productName: 'A', quantity: 2, unitPrice: 10, total: 20 },
      { name: 'B', quantity: 1, sellingPrice: 5 },
      { product: { name: 'C' }, quantity: 3, price: 4, taxAmount: 1.44, total: 13.44 },
      { description: 'D', qty: 1, amount: 7 },
    ]);

    expect(lines.map((l) => l.name)).toEqual(['A', 'B', 'C', 'D']);
    expect(lines[1].lineTotal).toBe(5);
    expect(lines[2].tax).toBe(1.44);
    expect(lines[3].unitPrice).toBe(7);
  });

  it('drops junk entries', () => {
    expect(normalizeItems([null, undefined, 'x', {}])).toHaveLength(0);
    expect(normalizeItems(undefined)).toHaveLength(0);
  });
});

describe('renderReceiptHtml', () => {
  it('renders a self-contained 80mm slip with every field on it', () => {
    const html = renderReceiptHtml(buildReceiptModel({ sale: cashSale, settings }));

    expect(html).toContain('@page { size: 80mm auto; margin: 0; }');
    expect(html).toContain('MiniMart');
    expect(html).toContain('INV-20261006-0001');
    expect(html).toContain('Lucky Me Pancit Canton');
    expect(html).toContain('₱252.00');
    expect(html).toContain('₱48.00');
    expect(html).toContain('Salamat po!');
    expect(html).toContain('VAT 12%');
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('NaN');
  });

  it('omits tendered/change for non-cash tenders', () => {
    const html = renderReceiptHtml(
      buildReceiptModel({
        sale: { invoiceNo: 'INV-2', total: 100, paymentMethod: 'gcash', items: [{ productName: 'A', quantity: 1, unitPrice: 100, total: 100 }] },
      })
    );
    expect(html).toContain('GCash');
    expect(html).not.toContain('Tendered');
  });

  it('says so when there is nothing to print, rather than emitting an empty body', () => {
    const html = renderReceiptHtml(buildReceiptModel({}));
    expect(html).toContain('No items recorded');
    expect(html).toContain('₱0.00');
  });

  it('can auto-print when saved as a file', () => {
    expect(renderReceiptHtml(buildReceiptModel({ sale: cashSale }), { autoPrint: true })).toContain('window.print()');
    expect(renderReceiptHtml(buildReceiptModel({ sale: cashSale }))).not.toContain('window.print()');
  });

  it('escapes whatever the catalogue calls a product', () => {
    const html = renderReceiptHtml(
      buildReceiptModel({
        sale: {
          invoiceNo: '<img src=x onerror=alert(1)>',
          total: 5,
          subtotal: 5,
          items: [{ productName: '<script>alert(2)</script>', quantity: 1, unitPrice: 5, total: 5 }],
        },
      })
    );
    expect(html).not.toContain('<script>alert(2)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#039;');
  });
});

describe('formatReceiptDate / money', () => {
  it('formats like the rest of the POS', () => {
    expect(money(1234.5)).toBe('₱1,234.50');
    expect(money('0')).toBe('₱0.00');
    expect(money(undefined)).toBe('₱0.00');
    expect(formatReceiptDate(new Date('2026-10-06T09:12:00Z'), false)).toMatch(/2026/);
  });
});

describe('printHtmlDocument', () => {
  it('reports failure (so the caller can fall back) when there is no DOM', async () => {
    await expect(printHtmlDocument('<html></html>')).resolves.toBe(false);
    await expect(printHtmlDocument('')).resolves.toBe(false);
  });
});
