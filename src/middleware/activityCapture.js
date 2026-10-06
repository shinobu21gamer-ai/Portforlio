const { logActivity } = require('../utils/audit');
const { runActivityContext } = require('../utils/activityContext');
const config = require('../config');

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const METHOD_ACTIONS = { POST: 'created', PUT: 'updated', PATCH: 'updated', DELETE: 'deleted' };
const ROUTE_ACTIONS = {
  approve: 'approved',
  reject: 'rejected',
  receive: 'received',
  pay: 'payment-recorded',
  refund: 'refunded',
  cancel: 'cancelled',
  terminate: 'terminated',
  process: 'processed',
  assign: 'assigned',
  revoke: 'revoked',
  activate: 'activated',
  deactivate: 'deactivated',
  close: 'closed',
  'cash-complete': 'completed-as-cash',
  'clock-in': 'clocked-in',
  'clock-out': 'clocked-out',
  'check-in': 'checked-in',
  'check-out': 'checked-out',
  'mark-read': 'marked-read',
  'change-password': 'password-changed',
  'reset-password': 'password-reset',
  'pos-access': 'pos-access-changed',
};
const RESOURCE_NAMES = {
  sales: 'Sale', sale: 'Sale',
  purchases: 'Purchase', purchase: 'Purchase',
  payments: 'Payment', payment: 'Payment',
  products: 'Product', product: 'Product',
  customers: 'Customer', customer: 'Customer',
  suppliers: 'Supplier', supplier: 'Supplier',
  employees: 'Employee', employee: 'Employee',
  users: 'User', user: 'User',
  departments: 'Department', department: 'Department',
  positions: 'Position', position: 'Position',
  schedules: 'Schedule', schedule: 'Schedule',
  leaves: 'Leave Request', 'leave-requests': 'Leave Request',
  contracts: 'Contract', contract: 'Contract',
  payroll: 'Payroll', payrolls: 'Payroll',
  discounts: 'Discount', discount: 'Discount',
  expenses: 'Expense', expense: 'Expense',
  inventory: 'Inventory', categories: 'Category', category: 'Category',
  branches: 'Branch', branch: 'Branch',
  shifts: 'Shift', shift: 'Shift',
  notifications: 'Notification',
  settings: 'Settings', roles: 'Role', role: 'Role',
  auth: 'Account', 'activity-logs': 'Activity Log', 'activity-log': 'Activity Log',
};
const MODULE_NAMES = {
  sales: 'Sales', sale: 'Sales',
  purchases: 'Purchases', purchase: 'Purchases',
  payments: 'Sales', payment: 'Sales',
  products: 'Products', product: 'Products',
  customers: 'Customers', customer: 'Customers',
  suppliers: 'Purchases', supplier: 'Purchases',
  employees: 'HRMS', employee: 'HRMS',
  departments: 'HRMS', department: 'HRMS',
  positions: 'HRMS', position: 'HRMS',
  schedules: 'HRMS', schedule: 'HRMS',
  leaves: 'HRMS', 'leave-requests': 'HRMS',
  contracts: 'HRMS', contract: 'HRMS',
  payroll: 'HRMS', payrolls: 'HRMS',
  discounts: 'Sales', discount: 'Sales',
  expenses: 'Finance', expense: 'Finance',
  inventory: 'Inventory', categories: 'Products', category: 'Products',
  branches: 'Settings', branch: 'Settings',
  shifts: 'POS', shift: 'POS',
  notifications: 'System', settings: 'Settings',
  users: 'Access', user: 'Access', roles: 'Access', role: 'Access', auth: 'Auth',
};
const SAFE_FIELDS = [
  'id', 'name', 'title', 'invoiceNo', 'orderNo', 'status', 'paymentStatus',
  'paymentMethod', 'total', 'amount', 'paidAmount', 'refundAmount',
];

function pathSegments(url) {
  return String(url || '').split('?')[0].split('/').filter(Boolean);
}

function getRouteInfo(req) {
  const segments = pathSegments(req.originalUrl);
  const prefix = String(config.apiPrefix || '/api/v1').split('/').filter(Boolean);
  let rest = segments;
  // Do not read req.baseUrl here: Express mutates it while nested routers run,
  // and a response-finish callback can see the last child route's base path.
  if (prefix.length && prefix.every((segment, index) => segments[index] === segment)) {
    rest = segments.slice(prefix.length);
  }

  const isHrms = rest[0] === 'hrms';
  const resourceToken = isHrms ? (rest[1] || 'hrms') : (rest[0] || 'system');
  const resourceType = RESOURCE_NAMES[resourceToken] || resourceToken
    .replace(/[-_]/g, ' ')
    .replace(/s$/, '')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  const routeActionToken = [...rest].reverse().find((segment) => Object.hasOwn(ROUTE_ACTIONS, segment));
  const action = routeActionToken
    ? `${resourceToken.replace(/s$/, '')}-${ROUTE_ACTIONS[routeActionToken]}`
    : `${resourceToken.replace(/s$/, '')}-${METHOD_ACTIONS[req.method] || 'changed'}`;
  const module = isHrms ? 'HRMS' : (MODULE_NAMES[resourceToken] || 'System');
  const numericId = rest.find((segment, index) => index > 0 && /^\d+$/.test(segment));

  return {
    action,
    module,
    resourceType,
    referenceId: numericId ? Number(numericId) : null,
  };
}

function getRecord(data) {
  if (!data || typeof data !== 'object') return null;
  if (Array.isArray(data)) return data[0] || null;
  if (typeof data.get === 'function') {
    try { data = data.get({ plain: true }); } catch { /* keep the serializable instance */ }
  }
  // Prefer the top-level entity before its associations. A Sale has a `user`
  // association with an id too; treating that as the audited record loses the
  // invoice number and incorrectly points the event at the cashier's user id.
  if (data.id !== undefined && data.id !== null) return data;
  for (const key of ['sale', 'purchase', 'product', 'employee', 'user', 'customer', 'supplier', 'record']) {
    if (data[key] && typeof data[key] === 'object') return data[key];
  }
  return data;
}

function summarizeRecord(record, resourceType, body, requestBody) {
  const summary = {};
  if (record && typeof record === 'object') {
    for (const field of SAFE_FIELDS) {
      if (record[field] !== undefined && record[field] !== null && typeof record[field] !== 'object') {
        summary[field] = record[field];
      }
    }

    if (resourceType === 'Sale') {
      const customer = record.customer;
      summary.customer = customer
        ? { id: customer.id, name: [customer.firstName, customer.lastName].filter(Boolean).join(' ') }
        : 'Walk-in';
      if (Array.isArray(record.items)) {
        summary.items = record.items.slice(0, 20).map((item) => ({
          name: item.productName || item.product?.name || 'Item',
          quantity: Number(item.quantity) || 0,
        }));
      }
    } else if (resourceType === 'Purchase') {
      if (record.supplier) summary.supplier = { id: record.supplier.id, name: record.supplier.name };
      if (Array.isArray(record.items)) {
        summary.items = record.items.slice(0, 20).map((item) => ({
          name: item.productName || item.product?.name || 'Item',
          quantity: Number(item.quantity) || 0,
        }));
      }
    }
  }

  if (body?.data?.refundAmount != null) summary.refundAmount = body.data.refundAmount;
  if (body?.data?.fullyRefunded != null) summary.fullyRefunded = body.data.fullyRefunded;
  // Refund reason is intentionally limited to refund events; request bodies are
  // never saved wholesale because they can contain passwords or private data.
  if (resourceType === 'Sale' && requestBody?.reason) summary.reason = String(requestBody.reason).slice(0, 300);
  return Object.keys(summary).length ? summary : null;
}

function describeActivity(info, record, summary, responseMessage) {
  const message = typeof responseMessage === 'string' && responseMessage.trim() && responseMessage !== 'Success'
    ? responseMessage.trim()
    : null;

  if (info.resourceType === 'Sale' && record?.invoiceNo) {
    const customer = summary?.customer && summary.customer !== 'Walk-in' ? summary.customer.name : 'Walk-in customer';
    const lines = (summary?.items || []).slice(0, 4).map((item) => `${item.quantity} × ${item.name}`).join(', ');
    if (info.action.endsWith('-refunded')) {
      const amount = summary?.refundAmount != null ? ` — ₱${Number(summary.refundAmount).toFixed(2)}` : '';
      return `Refund on ${record.invoiceNo}${amount}${summary?.reason ? ` — ${summary.reason}` : ''}`;
    }
    if (info.action.endsWith('-cancelled')) {
      return `Sale ${record.invoiceNo} cancelled — ₱${Number(record.total || 0).toFixed(2)} — ${customer}${lines ? ` — ${lines}` : ''}`;
    }
    const status = record.paymentStatus === 'pending' ? 'created, awaiting payment' : 'completed';
    return `Sale ${record.invoiceNo} ${status} — ₱${Number(record.total || 0).toFixed(2)} — ${customer}${lines ? ` — ${lines}` : ''}`;
  }

  if (info.resourceType === 'Purchase' && record?.orderNo) {
    const supplier = summary?.supplier?.name ? ` — ${summary.supplier.name}` : '';
    return `Purchase order ${record.orderNo}${supplier} — ₱${Number(record.total || 0).toFixed(2)}${record.status ? ` — ${record.status}` : ''}`;
  }

  if (message) return message;
  const target = info.referenceId || record?.id;
  return `${info.action.replace(/-/g, ' ')} ${info.resourceType}${target ? ` #${target}` : ''}`;
}

function persistActivity(req, state, body) {
  if (state.recorded || state.persistPromise || !req.user?.id) return state.persistPromise || Promise.resolve(false);

  const info = getRouteInfo(req);
  if (info.resourceType === 'Activity Log') return Promise.resolve(false);

  const record = getRecord(body?.data);
  const summary = summarizeRecord(record, info.resourceType, body, req.body);
  const referenceId = Number(record?.id) || info.referenceId || null;

  state.persistPromise = logActivity(req.user.id, info.action, info.module, {
    referenceType: info.resourceType,
    referenceId,
    description: describeActivity(info, record, summary, body?.message),
    requestMethod: req.method,
    requestUrl: String(req.originalUrl || '').split('?')[0].slice(0, 500),
    ipAddress: req.ip || req.socket?.remoteAddress || null,
    userAgent: req.headers['user-agent'] || null,
    newData: summary,
  }).then((written) => {
    if (written) state.recorded = true;
    return written;
  });

  return state.persistPromise;
}

function captureActivity(req, res, next) {
  if (!MUTATING_METHODS.has(req.method)) return next();

  const state = { recorded: false, responseBody: null, persistPromise: null };
  return runActivityContext(state, () => {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      state.responseBody = body;
      if (res.statusCode < 200 || res.statusCode >= 300 || !req.user?.id || state.recorded) {
        return originalJson(body);
      }
      // Save the audit record before sending a successful mutation response,
      // so a user opening Activity History immediately can see the event. Keep
      // Express's normal `res.json()` return value (the response object).
      void persistActivity(req, state, body)
        .catch((error) => console.error('Activity capture failed:', error.message))
        .then(() => originalJson(body));
      return res;
    };

    // Fallback for successful mutation endpoints that use res.send() instead
    // of JSON. Normal API controllers use res.json(), so this path is rare.
    res.once('finish', () => {
      if (state.recorded || state.persistPromise || res.statusCode < 200 || res.statusCode >= 300 || !req.user?.id) return;
      void persistActivity(req, state, state.responseBody);
    });

    next();
  });
}

module.exports = { captureActivity };
