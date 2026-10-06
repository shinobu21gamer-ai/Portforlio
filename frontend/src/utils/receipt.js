/**
 * Receipt rendering for the POS payment success screen.
 *
 * Why this lives in its own module:
 *  1. The sale payload arrives in three different shapes — the cash/split
 *     response from POST /sales, the PayMongo verify response
 *     (GET /payments/verify/:id) and the `pendingOnlineSale` snapshot kept in
 *     sessionStorage across the gateway redirect. Each names its fields
 *     slightly differently (`taxAmount` vs `tax`, `discountAmount` vs
 *     `discount`, `items[].productName` vs `items[].product.name`). Reading
 *     them inline in the page silently produced an EMPTY receipt: every lookup
 *     missed, the cart had already been cleared, and the slip rendered with no
 *     invoice, no lines and ₱0.00 totals.
 *  2. Printing has to be independent from the app's layout. The success screen
 *     sits inside `.pos-shell`/`.main` (both `overflow:hidden`, one of them a
 *     transformed animation container), so an absolutely positioned print node
 *     could be offset or clipped away — a blank sheet on the thermal printer.
 *     `printHtmlDocument()` prints a self-contained 80mm document in a hidden
 *     frame instead, with an in-page portal as fallback.
 *
 * Everything here is pure except the two DOM helpers at the bottom, so the
 * receipt content can be unit tested without a browser.
 */

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/** First value that is present (not null/undefined/''). */
const pick = (...values) => {
  for (const v of values) {
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
};

const round2 = (n) => Math.round((num(n) + Number.EPSILON) * 100) / 100;

/** Same formatting as `peso()` in utils/helpers — kept local so this module
 *  stays free of JSX imports (it is unit tested in a plain node environment). */
export const money = (n) =>
  '₱' + Number(num(n)).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const METHOD_LABELS = {
  cash: 'Cash',
  gcash: 'GCash',
  maya: 'Maya',
  paymaya: 'Maya',
  credit_card: 'Credit Card',
  debit_card: 'Debit Card',
  bank_transfer: 'Bank Transfer',
  card: 'Card',
  online: 'Online Payment',
  other: 'Other',
};

export const methodLabel = (method) => METHOD_LABELS[method] || 'Cash';

export const escapeHtml = (str) => {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const personName = (p) => {
  if (!p) return '';
  if (typeof p === 'string') return p.trim();
  return `${p.firstName || ''} ${p.lastName || ''} ${p.name || ''}`.replace(/\s+/g, ' ').trim();
};

const firstNonEmptyArray = (...arrays) => {
  for (const a of arrays) {
    if (Array.isArray(a) && a.length > 0) return a;
  }
  return [];
};

/**
 * Normalise any item shape we can be handed (server SaleItem, cart line,
 * checkout line) into one printable line.
 */
export function normalizeItems(rawItems) {
  const list = Array.isArray(rawItems) ? rawItems : [];
  return list
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const nameSource = pick(
        item.product?.name,
        item.productName,
        item.name,
        item.description,
        item.product?.sku,
        item.sku
      );
      const hasValue = pick(
        item.unitPrice,
        item.sellingPrice,
        item.price,
        item.amount,
        item.total,
        item.subtotal,
        item.quantity,
        item.qty
      ) != null;
      // An empty object is not a line item — dropping it keeps placeholder rows
      // off the slip.
      if (nameSource == null && !hasValue) return null;
      const qty = parseInt(item.quantity ?? item.qty ?? 1, 10) || 1;
      const name = nameSource || 'Item';
      const unitPrice = num(pick(item.unitPrice, item.sellingPrice, item.price, item.amount));
      // Prefer the server's own line totals; only derive them when absent.
      const lineSubtotal = item.subtotal != null ? num(item.subtotal) : round2(unitPrice * qty);
      const discount = num(pick(item.discountAmount, item.discount, item.lineDiscount));
      const tax = num(pick(item.taxAmount, item.tax, item.lineTax));
      const lineTotal = item.total != null ? num(item.total) : round2(lineSubtotal - discount + tax);
      return {
        name: String(name),
        sku: item.product?.sku || item.productSku || item.sku || '',
        qty,
        unitPrice: round2(unitPrice),
        subtotal: round2(lineSubtotal),
        discount: round2(discount),
        tax: round2(tax),
        lineTotal: round2(lineTotal),
      };
    })
    .filter(Boolean);
}

/**
 * Build the single source of truth the on-screen slip, the printed slip and
 * the downloaded HTML all render from.
 *
 * @param {object} input
 * @param {object} [input.sale]       sale payload (POST /sales or verify)
 * @param {object} [input.snapshot]   `pendingOnlineSale` sessionStorage snapshot
 * @param {Array}  [input.cartItems]  cart lines (still present for cash sales)
 * @param {object} [input.cart]       cart-derived totals { subtotal, discount, tax, total }
 * @param {string} [input.method]     tender chosen on the payment screen
 * @param {number} [input.cashAmount] cash tendered on the payment screen
 * @param {object} [input.settings]   store settings (name/address/footer/…)
 * @param {object} [input.customer]   selected customer, if any
 * @param {object} [input.cashier]    signed-in user, if any
 * @param {Date}   [input.now]        injectable clock (tests)
 */
export function buildReceiptModel(input = {}) {
  const {
    sale,
    snapshot,
    cartItems,
    cart,
    method,
    cashAmount,
    settings,
    customer,
    cashier,
    now,
  } = input;

  const s = sale && typeof sale === 'object' ? sale : {};
  const snap = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const cartTotals = cart && typeof cart === 'object' ? cart : {};

  const items = normalizeItems(
    firstNonEmptyArray(s.items, s.lineItems, snap.items, snap.cartItems, cartItems)
  );

  const itemsSubtotal = round2(items.reduce((sum, i) => sum + num(i.subtotal), 0));
  const itemsTax = round2(items.reduce((sum, i) => sum + num(i.tax), 0));
  const itemsDiscount = round2(items.reduce((sum, i) => sum + num(i.discount), 0));

  const subtotal = round2(pick(numOrNull(s.subtotal), numOrNull(snap.subtotal), numOrNull(cartTotals.subtotal)) ?? itemsSubtotal);
  const discount = round2(
    pick(numOrNull(s.discountAmount), numOrNull(s.discount), numOrNull(snap.discount), numOrNull(snap.discountAmount), numOrNull(cartTotals.discount))
      ?? (itemsDiscount || 0)
  );
  const tax = round2(
    pick(numOrNull(s.taxAmount), numOrNull(s.tax), numOrNull(snap.tax), numOrNull(snap.taxAmount), numOrNull(cartTotals.itemTax), numOrNull(cartTotals.tax))
      ?? (itemsTax || 0)
  );
  const shipping = round2(pick(numOrNull(s.shippingFee), numOrNull(snap.shippingFee)) ?? 0);
  const total = round2(
    pick(numOrNull(s.total), numOrNull(snap.total), numOrNull(cartTotals.total)) ?? (subtotal - discount + tax + shipping)
  );

  const paymentMethod = pick(s.paymentMethod, snap.paymentMethod, method) || 'cash';
  const payments = firstNonEmptyArray(s.payments, snap.payments)
    .filter((p) => p && (!p.status || p.status === 'completed') && num(p.amount) > 0)
    .map((p) => ({ method: p.paymentMethod || p.method || paymentMethod, amount: round2(p.amount), reference: p.reference || '' }));

  const isSplit = paymentMethod === 'split' || (!isSingleMethod(paymentMethod) && payments.length > 1);
  const tenderSource = pick(
    numOrNull(s.cashAmount),
    numOrNull(snap.cashAmount),
    numOrNull(s.amountTendered),
    method === 'cash' ? numOrNull(cashAmount) : undefined,
    isSplit ? undefined : numOrNull(total)
  );
  const tendered = round2(numOrNull(tenderSource) ?? total);
  const changeRaw = pick(numOrNull(s.changeAmount), numOrNull(s.change));
  const change = round2(changeRaw != null ? Math.max(0, changeRaw) : Math.max(0, tendered - total));

  const invoiceNo = String(pick(s.invoiceNo, s.invoice, snap.invoiceNo, snap.invoice) || '').trim();
  const saleDate = s.createdAt || s.saleDate || snap.createdAt || now || new Date();
  const date = saleDate instanceof Date && !Number.isNaN(saleDate.getTime()) ? saleDate : new Date(saleDate);

  const customerName =
    personName(customer) ||
    personName(s.customer) ||
    snap.customerName ||
    'Walk-in';

  const model = {
    invoiceNo: invoiceNo || 'N/A',
    saleId: s.id || snap.saleId || null,
    date: Number.isNaN(date.getTime()) ? new Date() : date,
    items,
    itemCount: items.reduce((sum, i) => sum + num(i.qty), 0),
    subtotal,
    discount,
    tax,
    shipping,
    total,
    paymentMethod,
    payments,
    isSplit,
    // Only a single cash tender has "tendered / change" semantics.
    isCash: !isSplit && paymentMethod === 'cash',
    tendered,
    change,
    customerName,
    cashierName: personName(s.user) || personName(cashier) || '',
    status: s.paymentStatus || s.status || (snap.saleId ? 'paid' : ''),
    reference: s.paymentReference || snap.paymentReference || payments[0]?.reference || '',
    store: {
      name: settings?.storeName || 'MiniMart POS',
      // `receiptHeader` is a documented setting (setting.service DEFAULT_KEYS);
      // it was never rendered anywhere, so a configured header silently
      // vanished from the slip.
      header: settings?.receiptHeader || '',
      address: settings?.address || '',
      phone: settings?.phone || '',
      gcashNumber: settings?.gcashNumber || '',
      mayaNumber: settings?.mayaNumber || '',
      footer: settings?.receiptFooter || 'Thank you for your purchase!',
      taxLabel: settings?.taxLabel || (num(settings?.taxRate) > 0 ? `VAT ${num(settings.taxRate)}%` : 'Tax'),
    },
  };

  // True when the slip has something meaningful on it. The UI uses this to
  // decide whether to re-fetch the sale instead of printing an empty sheet.
  model.hasData = Boolean(
    (invoiceNo && invoiceNo !== 'N/A') || model.items.length > 0 || model.total > 0
  );

  return model;
}

/** parseFloat that yields null (not 0) for missing values, so `pick` can skip them. */
function numOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function isSingleMethod(m) {
  return ['cash', 'gcash', 'maya', 'paymaya', 'credit_card', 'debit_card', 'bank_transfer', 'card', 'online', 'other'].includes(m);
}

export function formatReceiptDate(date, withTime = true) {
  const d = date instanceof Date ? date : new Date(date || Date.now());
  const dateStr = d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  if (!withTime) return dateStr;
  const timeStr = d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${dateStr} ${timeStr}`;
}

const row = (label, value, opts = {}) => `
      <div class="row${opts.strong ? ' strong' : ''}${opts.muted ? ' muted' : ''}">
        <span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span>
      </div>`;

const divider = (cls = 'dash') => `<div class="${cls}"></div>`;

/**
 * Standalone 80mm thermal slip. Self-contained on purpose: it carries its own
 * `@page` size and colours, so no app stylesheet, dark theme, `overflow:hidden`
 * ancestor or iframe can turn the printout blank.
 */
export function renderReceiptHtml(model, options = {}) {
  const m = model || {};
  const store = m.store || {};
  const { autoPrint = false, title } = options;
  const items = Array.isArray(m.items) ? m.items : [];
  const payments = Array.isArray(m.payments) ? m.payments : [];
  const taxLabel = store.taxLabel || 'Tax';

  const itemRows = items.length
    ? items
        .map(
          (i) => `
        <div class="item">
          <div class="item-name">${escapeHtml(i.name)}${i.sku ? ` <span class="sku">[${escapeHtml(i.sku)}]</span>` : ''}</div>
          <div class="item-line">
            <span>${num(i.qty)} @ ${money(i.unitPrice)}</span>
            <span>${money(i.subtotal)}</span>
          </div>
        </div>`
        )
        .join('')
    : `<div class="item"><div class="item-line muted"><span>No items recorded</span><span></span></div></div>`;

  const paymentRows = m.isSplit && payments.length
    ? payments.map((p) => row(methodLabel(p.method), money(p.amount))).join('')
    : row('Payment', methodLabel(m.paymentMethod));

  const tenderRows = m.isCash
    ? row('Tendered', money(m.tendered)) + row('Change', money(m.change), { strong: true })
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title || `Receipt ${m.invoiceNo || ''}`.trim())}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    background: #fff;
    color: #000;
    /* 'visibility' inherits across the frame boundary: if the host page hides
       the print frame, the slip would print blank. Insist on being visible. */
    visibility: visible !important;
    opacity: 1 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body {
    width: 72mm;
    padding: 2mm 3mm 4mm;
    font-family: 'Courier New', Courier, monospace;
    font-size: 11.5px;
    line-height: 1.4;
  }
  .center { text-align: center; }
  .store { font-size: 16px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
  .small { font-size: 10px; }
  .muted { color: #333; }
  .dash { border-top: 1px dashed #000; margin: 4px 0; }
  .solid { border-top: 2px solid #000; margin: 4px 0; }
  .row { display: flex; justify-content: space-between; gap: 6px; padding: 1px 0; }
  .row.strong { font-weight: 700; }
  .total { font-size: 14px; font-weight: 700; }
  .item { padding: 2px 0; }
  .item-name { font-weight: 700; word-break: break-word; }
  .item-line { display: flex; justify-content: space-between; gap: 6px; }
  .sku { font-weight: 400; font-size: 10px; }
  .head-row { display: flex; justify-content: space-between; gap: 6px; font-weight: 700; font-size: 10px; text-transform: uppercase; }
  /* Line amounts are pre-tax so the items add up to the Subtotal row, with
     discount and VAT accounted for below it. */
  .footer { text-align: center; font-size: 10px; margin-top: 4px; }
  .brand-mark { letter-spacing: 2px; font-size: 10px; }
</style>
</head>
<body>
  <div class="center">
    <div class="store">${escapeHtml(store.name || 'MiniMart POS')}</div>
    ${store.header ? `<div class="small">${escapeHtml(store.header)}</div>` : ''}
    ${store.address ? `<div class="small">${escapeHtml(store.address)}</div>` : ''}
    ${store.phone ? `<div class="small">Tel: ${escapeHtml(store.phone)}</div>` : ''}
    ${store.gcashNumber || store.mayaNumber
      ? `<div class="small">${store.gcashNumber ? `GCash: ${escapeHtml(store.gcashNumber)}` : ''}${store.gcashNumber && store.mayaNumber ? ' &middot; ' : ''}${store.mayaNumber ? `Maya: ${escapeHtml(store.mayaNumber)}` : ''}</div>`
      : ''}
  </div>
  ${divider('solid')}
  <div class="row"><span>Invoice</span><span>${escapeHtml(m.invoiceNo || 'N/A')}</span></div>
  <div class="row"><span>Date</span><span>${escapeHtml(formatReceiptDate(m.date))}</span></div>
  <div class="row"><span>Customer</span><span>${escapeHtml(m.customerName || 'Walk-in')}</span></div>
  ${m.cashierName ? `<div class="row"><span>Cashier</span><span>${escapeHtml(m.cashierName)}</span></div>` : ''}
  ${divider()}
  <div class="head-row"><span>Item</span><span>Amount</span></div>
  ${divider()}
  ${itemRows}
  ${divider()}
  <div class="row"><span>Total items</span><span>${num(m.itemCount || items.length)}</span></div>
  ${row('Subtotal', money(m.subtotal))}
  ${num(m.discount) > 0 ? row('Discount', '-' + money(m.discount)) : ''}
  ${row(taxLabel, money(m.tax))}
  ${num(m.shipping) > 0 ? row('Shipping', money(m.shipping)) : ''}
  <div class="row total"><span>TOTAL</span><span>${money(m.total)}</span></div>
  ${divider()}
  ${paymentRows}
  ${tenderRows}
  ${m.reference ? row('Ref', String(m.reference).slice(0, 24)) : ''}
  ${divider('solid')}
  <div class="footer">
    <div>${escapeHtml(store.footer || 'Thank you for your purchase!')}</div>
    <div class="muted">This receipt serves as your official proof of purchase.</div>
    <div class="brand-mark">*** ${escapeHtml(m.invoiceNo || 'N/A')} ***</div>
  </div>
  ${autoPrint ? '<script>window.onload=function(){try{window.focus();window.print();}catch(e){}};<\/script>' : ''}
</body>
</html>`;
}

/**
 * The top-most document we are allowed to touch. When the POS runs inside the
 * HRMS shell (same origin) the print frame is created there, so the browser
 * prints the receipt document instead of the app around it. Cross-origin
 * parents throw on `.document` and we stay put.
 */
function printableDocument() {
  let w = window;
  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const parent = w.parent;
      if (!parent || parent === w) break;
      const doc = parent.document; // throws when cross-origin
      if (!doc || !doc.body) break;
      w = parent;
    }
  } catch {
    /* cross-origin: print from where we are */
  }
  return w.document;
}

/**
 * Print a self-contained HTML document through a hidden frame.
 * Resolves true when the print dialog was invoked, false if the caller should
 * fall back to in-page printing.
 */
export function printHtmlDocument(html, { timeout = 1500 } = {}) {
  return new Promise((resolve) => {
    if (typeof document === 'undefined' || !html) {
      resolve(false);
      return;
    }
    let doc;
    try {
      doc = printableDocument();
    } catch {
      doc = document;
    }

    let frame;
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      resolve(ok);
      // Give the spooler time to read the document before it goes away.
      setTimeout(() => {
        try { frame && frame.parentNode && frame.parentNode.removeChild(frame); } catch { /* already gone */ }
      }, 1000);
    };

    const runPrint = () => {
      if (settled) return;
      try {
        const win = frame.contentWindow;
        const body = win && win.document && win.document.body;
        // Never hand the printer an empty document — that is the blank slip.
        if (!win || !body || !body.textContent || body.textContent.trim().length === 0) {
          finish(false);
          return;
        }
        win.focus();
        win.print();
        finish(true);
      } catch {
        finish(false);
      }
    };

    try {
      frame = doc.createElement('iframe');
      frame.setAttribute('aria-hidden', 'true');
      frame.setAttribute('title', 'Receipt print');
      // Deliberately no `visibility:hidden` / `display:none` here: both can
      // propagate into the frame and hand the printer an empty sheet. A 0x0
      // off-flow frame is invisible without touching visibility.
      frame.style.cssText =
        'position:fixed;right:0;bottom:0;width:0;height:0;border:0;padding:0;margin:0;overflow:hidden;opacity:0;';
      doc.body.appendChild(frame);

      // document.write (not srcdoc): no navigation, so no frame-src/CSP or
      // load-event race can leave us with an empty frame.
      const frameDoc = frame.contentDocument || frame.contentWindow.document;
      frameDoc.open();
      frameDoc.write(html);
      frameDoc.close();

      // Give the slip a beat to lay out, then print. Belt and braces: the load
      // event and a hard timeout both funnel into the same guarded runPrint().
      setTimeout(runPrint, 80);
      frame.onload = () => setTimeout(runPrint, 30);
      setTimeout(runPrint, timeout);
    } catch {
      finish(false);
    }
  });
}

/**
 * Fallback: print the on-screen slip without the app chrome around it.
 * The node is cloned into a portal that is a direct child of <body>, so no
 * ancestor can clip, offset or restyle it (see the `body.print-receipt` rules
 * in index.css).
 */
export function printNodeInPage(sourceId = 'receipt-print-area') {
  if (typeof document === 'undefined') return false;
  const source = document.getElementById(sourceId);
  const body = document.body;
  if (!source || !body) {
    try { window.print(); } catch { return false; }
    return true;
  }

  const portal = document.createElement('div');
  portal.id = 'receipt-print-portal';
  const clone = source.cloneNode(true);
  clone.removeAttribute('id');
  clone.classList.add('receipt-print-copy');
  portal.appendChild(clone);
  body.appendChild(portal);
  body.classList.add('print-receipt');

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    body.classList.remove('print-receipt');
    if (portal.parentNode) portal.parentNode.removeChild(portal);
  };
  window.addEventListener('afterprint', cleanup, { once: true });

  try {
    window.focus();
    window.print();
  } catch {
    cleanup();
    return false;
  }
  // Safari/Edge do not always fire afterprint.
  setTimeout(cleanup, 2000);
  return true;
}
