const clamped = (n, lo, hi) => Math.min(Math.max(lo, n), hi);

const parseMoney = (n) => parseFloat(n) || 0;

export const calculateDiscount = (subtotal, discountType, discountValue) => {
  const v = parseMoney(discountValue);
  if (discountType === 'percentage') {
    const pct = clamped(v, 0, 100);
    return parseFloat(((subtotal * pct) / 100).toFixed(2));
  }
  if (discountType === 'fixed') {
    return parseFloat(clamped(v, 0, subtotal).toFixed(2));
  }
  return 0;
};

const resolveTaxRate = (itemTaxRate, appTaxRate) => {
  if (itemTaxRate == null || itemTaxRate === '') return parseMoney(appTaxRate);
  const raw = parseFloat(itemTaxRate);
  if (!Number.isFinite(raw)) return 0;
  return raw > 1 ? raw / 100 : raw;
};

const itemTaxOf = (amount, rate) => parseFloat((amount * rate).toFixed(2));

/**
 * Mirrors the backend total computation (sale.service.js create/createPending):
 * per-item taxRate (product.taxRate, falling back to app settings; >1 treated as
 * percentage), tax computed on the pre-sale-discount item subtotal, sale-level
 * discount clamped to the promo's maxDiscountAmount.
 */
export const computeCartTotal = (items, options = {}) => {
  const {
    discountType = 'none',
    discountValue = 0,
    maxDiscountAmount = null,
    appTaxRate = 12,
    shippingFee = 0,
  } = options;

  const safeItems = Array.isArray(items) ? items : [];
  let subtotal = 0;
  let itemTax = 0;
  let itemDiscount = 0;

  for (const i of safeItems) {
    const qty = parseInt(i.quantity, 10) || 1;
    const unit = parseMoney(i.sellingPrice || i.price || 0);
    const itemSubtotal = unit * qty;
    // Per-line discounts reduce the tax base and the payable total, mirroring
    // sale.service.js (which was fixed to subtract them from the total).
    const lineDiscount = calculateDiscount(itemSubtotal, i.discountType, i.discountValue);
    const rate = resolveTaxRate(i.taxRate, appTaxRate);
    itemTax += itemTaxOf(itemSubtotal - lineDiscount, rate);
    subtotal += itemSubtotal;
    itemDiscount += lineDiscount;
  }

  let discount = calculateDiscount(subtotal, discountType, discountValue);
  if (maxDiscountAmount != null && discount > parseMoney(maxDiscountAmount)) {
    discount = parseMoney(maxDiscountAmount);
  }

  const sub = parseFloat(subtotal.toFixed(2));
  const tax = parseFloat(itemTax.toFixed(2));
  const total = parseFloat((sub - itemDiscount - discount + tax + parseMoney(shippingFee)).toFixed(2));
  return {
    subtotal: sub,
    itemTax: tax,
    discount: parseFloat(discount.toFixed(2)),
    total,
  };
};