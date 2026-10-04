const crypto = require('crypto');

const escapeLike = (str) => {
  if (!str) return '';
  return str.replace(/%/g, '\\%').replace(/_/g, '\\_');
};

const generateSKU = (categoryName, index) => {
  const prefix = categoryName
    ? categoryName.substring(0, 3).toUpperCase()
    : 'PRD';
  const unique = crypto.randomBytes(3).toString('hex').toUpperCase();
  const num = String(index).padStart(4, '0');
  return `${prefix}-${unique}-${num}`;
};

const generateBarcode = () => {
  // 20 + 8 timestamp digits + 3 random digits = 13, the EAN-13 width.
  // The previous 4-digit random produced 14 characters.
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(100 + Math.random() * 900).toString();
  return `20${timestamp}${random}`;
};

const generateInvoiceNo = (prefix = 'INV') => {
  const date = new Date();
  const y = date.getFullYear().toString().slice(-2);
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${y}${m}${d}-${rand}`;
};

const generateOrderNo = (prefix = 'PO') => {
  const date = new Date();
  const y = date.getFullYear().toString().slice(-2);
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${y}${m}${d}-${rand}`;
};

const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

const calculateTax = (amount, taxRate) => {
  return parseFloat((amount * taxRate).toFixed(2));
};

const calculateDiscount = (subtotal, discountType, discountValue) => {
  if (discountType === 'percentage') {
    const pct = Math.min(Math.max(0, discountValue), 100);
    return parseFloat(((subtotal * pct) / 100).toFixed(2));
  }
  return parseFloat(Math.min(Math.max(0, discountValue), subtotal).toFixed(2));
};

const getPagination = (page = 1, limit = 10) => {
  const p = Math.max(1, parseInt(page, 10) || 1);
  // Check for an explicit non-positive value before the `|| 10` fallback,
  // which would otherwise swallow 0 and make the bulk branch unreachable.
  const rawLimit = parseInt(limit, 10);
  const parsedLimit = Number.isNaN(rawLimit) ? 10 : rawLimit;
  // Allow limit <= 0 to bypass cap (for bulk operations like dashboard)
  const l = parsedLimit <= 0 ? 1000 : Math.min(100, Math.max(1, parsedLimit));
  return { page: p, limit: l, offset: (p - 1) * l };
  };

const getPaginationMeta = (count, page, limit) => {
  return {
    page,
    limit,
    totalItems: count,
    totalPages: Math.ceil(count / limit),
    hasNextPage: page * limit < count,
    hasPrevPage: page > 1,
  };
};

const sanitizeObject = (obj) => {
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null && value !== '') {
      sanitized[key] = typeof value === 'string' ? value.trim().replace(/<[^>]*>/g, '') : value;
    }
  }
  return sanitized;
};

const escapeHtml = (str) => {
  if (typeof str !== 'string') return String(str || '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const generateEmployeeNo = async (sequelize) => {
  const [result] = await sequelize.query(
    "SELECT MAX(CAST(SUBSTR(employee_no, 5) AS INTEGER)) AS maxNum FROM employees"
  );
  const lastNum = (result && result[0] && result[0].maxNum) || 0;
  return `EMP-${String(lastNum + 1).padStart(4, '0')}`;
};

/**
 * Public origin for links that leave the server: password resets, payslips,
 * contract notices, applicant status emails, PayMongo redirects.
 *
 * FRONTEND_URL / POS_FRONTEND_URL are optional; when unset the origin of the
 * incoming request is used. `trust proxy` is enabled in src/server.js, so
 * req.protocol and req.get('host') are correct behind Render's proxy.
 *
 * This must never fall back to a localhost default: emails would still be sent,
 * but every link inside them would point at the reader's own machine.
 */
const resolvePublicOrigin = (req, configuredUrl) => {
  const fromRequest = req ? `${req.protocol}://${req.get('host')}` : null;
  const origin = configuredUrl || fromRequest;
  if (!origin) {
    throw new Error(
      'Cannot build a public URL: no FRONTEND_URL configured and no request context. ' +
      'Set FRONTEND_URL to the public site origin.'
    );
  }
  return String(origin).replace(/\/+$/, '');
};

module.exports = {
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
  escapeLike,
  resolvePublicOrigin,
};
