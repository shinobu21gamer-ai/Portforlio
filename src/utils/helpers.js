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
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(1000 + Math.random() * 9000).toString();
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
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${y}${m}-${rand}`;
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
    const parsedLimit = parseInt(limit, 10) || 10;
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
};
