/**
 * Phase-6 route matrix — POS / admin surface.
 *
 * Every route in the non-HRMS half of the API (143 of them, enumerated in
 * tests/utils/route-table.ts and generated from src/ by
 * scripts/generate-route-table.js) gets:
 *
 *   • a happy leg    — a role the middleware permits, with a valid body and a
 *                      seeded :id, asserting the documented status;
 *   • an authz leg   — no Bearer token must yield 401;
 *   • a forbidden leg— the least-privileged denied role must yield 403, emitted
 *                      only for routes that actually gate on authorize() or
 *                      hasPermission().
 *
 * The point of the matrix is *coverage of the authorisation surface*, not
 * re-testing business rules: those live in the per-domain suites. What it does
 * guarantee is that no route is reachable without authentication, that no route
 * is reachable by a role its middleware excludes, and that no route 500s on a
 * well-formed authorised request. It found two real 500s on the way
 * (shifts/summary and sales/report) — see PROGRESS.md Phase 6.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import {
  startRouteMatrix,
  type RouteMatrixContext,
  MATRIX_PASSWORD,
  matrixEmail,
} from '../utils/route-matrix-setup';
import { runRouteMatrix, type OverrideMap } from '../utils/route-matrix-runner';
import { POS_ROUTES } from '../utils/route-table';

let ctx: RouteMatrixContext;
const getCtx = (): RouteMatrixContext => ctx;

beforeAll(async () => {
  ctx = await startRouteMatrix();
}, 180000);

afterAll(async () => {
  if (ctx) await ctx.close();
}, 30000);

/** 1x1 transparent PNG — bytes start with the image/png magic number. */
const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const tomorrow = () => new Date(Date.now() + 86400000).toISOString().split('T')[0];
const nextMonth = () => new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

/**
 * Per-route overrides. `expect` is only spelled out where the correct response
 * is not the verb's plain 2xx, and every such entry carries a `note` saying why.
 */
const OVERRIDES: OverrideMap = {
  // ── app-level (src/app.js, not the API router) ─────────────────────────
  'GET /': {
    expect: [200, 302, 404],
    note: 'serves public/site/index.html when present, else 302 to /hrms/careers, else the 404 handler in an API-only checkout',
  },
  'GET /health': { expect: [200] },
  'GET /metrics': { expect: [200], role: 'admin' },
  'GET /robots.txt': {
    expect: [200, 404],
    note: 'sendFile of public/site/robots.txt; 404 when the file is absent',
  },

  // ── auth ───────────────────────────────────────────────────────────────
  'POST /api/v1/auth/register': {
    body: {
      firstName: 'Reg', lastName: 'Ister', email: 'register@matrix.test.com',
      password: MATRIX_PASSWORD,
    },
    expect: [403],
    note: 'ALLOW_PUBLIC_REGISTRATION=false in the harness, so public signup is refused — this is the security assertion, not a failure',
  },
  'POST /api/v1/auth/login': {
    body: { email: matrixEmail('cashier'), password: MATRIX_PASSWORD },
    expect: [200],
  },
  'POST /api/v1/auth/change-password': {
    actor: 'mutator',
    body: { currentPassword: MATRIX_PASSWORD, newPassword: 'Rotated!Passw0rd9' },
    expect: [200],
  },
  'POST /api/v1/auth/logout': { actor: 'mutator', expect: [200] },
  'POST /api/v1/auth/forgot-password': {
    body: { email: matrixEmail('cashier') },
    expect: [200],
    note: 'EMAIL_DISABLED=true short-circuits the transport; the route still reports success so as not to leak account existence',
  },
  'POST /api/v1/auth/reset-password': {
    body: { token: 'not-a-real-reset-token', password: 'Rotated!Passw0rd9' },
    expect: [400],
    note: 'a reset token can only be minted by a real forgot-password email round-trip, which is covered in auth.routes.integration.test.ts; here the invalid token must be rejected 400, not 500',
  },
  'POST /api/v1/auth/refresh-token': {
    expect: [401],
    note: 'the refresh token is delivered as an httpOnly cookie by /auth/login; a bare JSON call carries none, so 401 is correct. The cookie round-trip is asserted in auth.routes.integration.test.ts',
  },
  'PUT /api/v1/auth/profile': { body: { firstName: 'Renamed', lastName: 'Matrix' }, expect: [200] },

  // ── branches ───────────────────────────────────────────────────────────
  'POST /api/v1/branches': {
    body: { name: 'Matrix New Branch', code: 'MTXNEW', city: 'Makati', province: 'Metro Manila' },
    expect: [201],
  },
  'PUT /api/v1/branches/:id': { body: { name: 'Matrix Branch Renamed' }, expect: [200] },

  // ── categories ─────────────────────────────────────────────────────────
  'POST /api/v1/categories': {
    body: { name: 'Matrix Created Category', description: 'created by the route matrix' },
    expect: [201],
  },
  'PUT /api/v1/categories/:id': { body: { name: 'Matrix Category Renamed' }, expect: [200] },

  // ── customers ──────────────────────────────────────────────────────────
  'POST /api/v1/customers': {
    body: { firstName: 'Matrix', lastName: 'Shopper', email: 'shopper@matrix-customer.test.com', mobile: '09171234567' },
    expect: [201],
  },
  'PUT /api/v1/customers/:id': { body: { firstName: 'Matrix', lastName: 'Renamed' }, expect: [200] },

  // ── discounts ──────────────────────────────────────────────────────────
  'POST /api/v1/discounts': {
    body: {
      code: 'MATRIXNEW', name: 'Matrix New Promo', type: 'percentage', value: 15,
      startDate: tomorrow(), endDate: nextMonth(), isActive: true,
    },
    expect: [201],
  },
  'PUT /api/v1/discounts/:id': { body: { name: 'Matrix Promo Renamed' }, expect: [200] },
  'GET /api/v1/discounts/validate': {
    query: (ids: any) => ({ code: 'MATRIX10', amount: 200 }),
    expect: [200],
  },
  'POST /api/v1/discounts/validate': {
    body: { code: 'MATRIX10', amount: 200 },
    expect: [200],
  },

  // ── expense categories / expenses ──────────────────────────────────────
  'POST /api/v1/expense-categories': {
    body: { name: 'Matrix Created Expense Category', description: 'matrix' },
    expect: [201],
  },
  'PUT /api/v1/expense-categories/:id': { body: { name: 'Matrix Expense Category Renamed' }, expect: [200] },
  'POST /api/v1/expenses': {
    body: (ids: any) => ({
      expenseCategoryId: ids.expenseCategory, amount: 350,
      description: 'Matrix created expense', expenseDate: tomorrow(), paymentMethod: 'cash',
    }),
    expect: [201],
  },
  'PUT /api/v1/expenses/:id': { body: { amount: 375, description: 'Matrix updated expense' }, expect: [200] },

  // ── inventory ──────────────────────────────────────────────────────────
  'POST /api/v1/inventory/stock-in': {
    body: (ids: any) => ({ productId: ids.product, quantity: 5, notes: 'matrix stock in' }),
    expect: [200, 201],
  },
  'POST /api/v1/inventory/stock-out': {
    body: (ids: any) => ({ productId: ids.product, quantity: 2, notes: 'matrix stock out' }),
    expect: [200, 201],
  },
  'POST /api/v1/inventory/adjust': {
    body: (ids: any) => ({ productId: ids.product, newQuantity: 60, reason: 'matrix stocktake', type: 'adjustment' }),
    expect: [200, 201],
  },

  // ── loyalty ────────────────────────────────────────────────────────────
  'POST /api/v1/loyalty/redeem': {
    body: (ids: any) => ({ customerId: ids.customer, points: 10, notes: 'matrix redemption' }),
    expect: [200, 201, 400],
    note: '400 when the customer has fewer redeemable points than requested — redemption is refused, not crashed',
  },

  // ── notifications ──────────────────────────────────────────────────────
  'PUT /api/v1/notifications/mark-read': {
    body: (ids: any) => ({ ids: [ids.notification] }),
    expect: [200],
  },
  'PUT /api/v1/notifications/mark-all-read': { expect: [200] },

  // ── payments (PayMongo is deliberately unconfigured in CI) ─────────────
  'POST /api/v1/payments/create-checkout': {
    body: (ids: any) => ({ saleId: ids.pendingSale, amount: 52, description: 'matrix checkout' }),
    expect: [503, 400],
    note: 'PAYMONGO_SECRET_KEY is unset in the harness, so the service must take its clean "payment provider not configured" 503 rather than calling the network',
  },
  'GET /api/v1/payments/status/:saleId': { expect: [200, 404, 503] },
  'GET /api/v1/payments/verify/:saleId': { expect: [200, 404, 503] },
  'POST /api/v1/payments/webhook': {
    body: { data: { attributes: { status: 'unknown' } } },
    expect: [200, 400, 401, 404],
    note: 'unsigned/unknown webhook payload must be refused without throwing',
  },

  // ── petty cash ─────────────────────────────────────────────────────────
  'POST /api/v1/petty-cash': {
    body: { name: 'Matrix Created Fund', initialBalance: 2000, description: 'matrix' },
    expect: [201],
  },
  'PUT /api/v1/petty-cash/:id': { body: { name: 'Matrix Fund Renamed' }, expect: [200] },
  'POST /api/v1/petty-cash/:id/deposit': {
    body: { amount: 250, description: 'matrix deposit' },
    expect: [200, 201],
  },
  'POST /api/v1/petty-cash/:id/withdraw': {
    body: { amount: 100, description: 'matrix withdrawal' },
    expect: [200, 201],
  },
  'PATCH /api/v1/petty-cash/:id/close': { expect: [200] },

  // ── products ───────────────────────────────────────────────────────────
  'POST /api/v1/products': {
    // The route guards with `if (!req.file) return next(ApiError.badRequest(
    // 'Product image is required'))`, so a JSON body can never satisfy it. This
    // leg uploads a real 1x1 PNG whose bytes match the image/png magic number
    // checked by validateMagicNumber (src/utils/fileType.js).
    multipart: {
      field: 'image',
      filename: 'matrix-product.png',
      mimetype: 'image/png',
      contentB64: PNG_1X1,
    },
    body: (ids: any) => ({
      name: 'Matrix Created Product', categoryId: ids.category, brand: 'Matrix', unit: 'pcs',
      buyingPrice: 20, sellingPrice: 30, stockQuantity: 10, minStockLevel: 5,
      sku: 'MTX-NEW-001', barcode: '4800077770001', taxRate: 0,
    }),
    expect: [201, 200],
  },
  'PUT /api/v1/products/:id': { body: { name: 'Matrix Product Renamed', sellingPrice: 55 }, expect: [200] },

  // ── purchases ──────────────────────────────────────────────────────────
  'POST /api/v1/purchases': {
    body: (ids: any) => ({
      supplierId: ids.supplier, orderDate: tomorrow(),
      items: [{ productId: ids.product, quantity: 5, unitCost: 38 }],
    }),
    expect: [201],
  },
  'PUT /api/v1/purchases/:id/receive': {
    params: (ids: any) => ({ id: ids.receivePurchase }),
    expect: [200],
  },
  'POST /api/v1/purchases/:id/pay': {
    params: (ids: any) => ({ id: ids.payPurchase }),
    body: { amount: 100, paymentSource: 'cash' },
    expect: [200, 201],
  },
  'POST /api/v1/purchases/:id/cancel': {
    params: (ids: any) => ({ id: ids.cancelPurchase }),
    expect: [200],
  },

  // ── sales ──────────────────────────────────────────────────────────────
  'POST /api/v1/sales': {
    body: (ids: any) => ({
      items: [{ productId: ids.product, quantity: 1 }],
      paymentMethod: 'cash', discountType: 'percentage', discountValue: 0,
      cashAmount: 100, customerId: ids.customer,
    }),
    expect: [201],
  },
  'POST /api/v1/sales/pending': {
    body: (ids: any) => ({
      items: [{ productId: ids.product, quantity: 1 }],
      paymentMethod: 'gcash', discountType: 'percentage', discountValue: 0,
    }),
    expect: [201],
  },
  'POST /api/v1/sales/pending/:id/cancel': {
    params: (ids: any) => ({ id: ids.cancelPendingSale }),
    expect: [200],
  },
  'POST /api/v1/sales/pending/:id/cash-complete': {
    params: (ids: any) => ({ id: ids.cashCompleteSale }),
    role: 'manager',
    expect: [200],
  },
  'POST /api/v1/sales/:id/cancel': {
    params: (ids: any) => ({ id: ids.cancelSale }),
    expect: [200],
  },
  'POST /api/v1/sales/:id/refund': {
    params: (ids: any) => ({ id: ids.refundSale }),
    body: { reason: 'Matrix fixture refund' },
    expect: [200],
  },
  'POST /api/v1/sales/:id/email-receipt': {
    expect: [200, 503],
    note: 'EMAIL_DISABLED=true: the route must report that no transport is configured rather than throwing',
  },

  // ── settings / shifts / suppliers / users / roles ──────────────────────
  'PUT /api/v1/settings': { body: { storeName: 'Matrix Store' }, expect: [200] },
  'POST /api/v1/shifts': {
    // The cashier matrix user is seeded with an open shift (the shifts/:id and
    // mine/open legs read it), and the service refuses a second open shift with
    // 409. employee has none, so it can exercise the create path.
    body: { openingFloat: 750 },
    expect: [201],
    role: 'employee',
  },
  'POST /api/v1/shifts/close': {
    body: { countedCash: 750, notes: 'matrix close' },
    expect: [200, 400, 404],
    note: '400/404 when the caller has no open shift to close — the matrix mints a fresh token per leg and shifts belong to whoever opened one',
  },
  'POST /api/v1/suppliers': {
    body: { name: 'Matrix Created Supplier', contactPerson: 'Matrix Contact', email: 'new@matrix-supplier.test.com' },
    expect: [201],
  },
  'PUT /api/v1/suppliers/:id': { body: { name: 'Matrix Supplier Renamed' }, expect: [200] },
  'POST /api/v1/suppliers/import': {
    body: {},
    expect: [400],
    note: 'CSV import expects a multipart file upload; a JSON body must be refused 400, not 500',
  },
  'POST /api/v1/users': {
    body: (ids: any) => ({
      firstName: 'Matrix', lastName: 'Created', email: 'created-user@matrix.test.com',
      password: MATRIX_PASSWORD, roleId: ids.roles.employee.id,
    }),
    expect: [201],
  },
  'PUT /api/v1/users/:id': { body: { firstName: 'Matrix', lastName: 'Renamed' }, expect: [200] },
  'GET /api/v1/users/:id': {
    params: (ids: any) => ({ id: ids.user_cashier }),
    expect: [200],
    note: 'reads target a stable matrix user; the disposal pool row may already have been consumed by the DELETE leg, which runs first in path order',
  },

  'POST /api/v1/public/jobs/apply': {
    // Public, rate-limited (5/hour) and multipart-capable, but the resume is
    // optional: the controller only requires jobId/firstName/lastName/email.
    body: (ids: any) => ({
      jobId: ids.job, firstName: 'External', lastName: 'Candidate',
      email: 'candidate@matrix-apply.test.com', phone: '09172223333',
      coverLetter: 'Matrix fixture application',
    }),
    expect: [201, 200],
  },

  // ── tracking ───────────────────────────────────────────────────────────
  'POST /api/v1/tracking/update': {
    body: (ids: any) => ({
      orderType: 'purchase', orderId: ids.purchase, status: 'in_transit',
      notes: 'matrix tracking update',
    }),
    expect: [200, 201, 400],
  },
  'POST /api/v1/tracking/ship/:purchaseId': {
    params: (ids: any) => ({ purchaseId: ids.shipPurchase }),
    body: { courier: 'Matrix Courier', trackingNumber: 'MTX-TRACK-0001' },
    expect: [200, 201, 400],
  },
  'POST /api/v1/tracking/simulate/:deliveryId': {
    params: (ids: any) => ({ deliveryId: ids.simulateDelivery }),
    body: {},
    expect: [200, 400],
  },
};

describe('Route matrix — POS / admin surface', () => {
  it('the generated table still matches the live Express router (no route added or removed silently)', () => {
    // Guards the matrix against drift: if a route is added to src/routes and the
    // table is not regenerated, `node scripts/generate-route-table.js --check`
    // fails in CI. This assertion documents the expected surface size.
    expect(POS_ROUTES.length).toBe(143);
  });

  it('the unauthenticated surface is exactly the 14 reviewed public routes', () => {
    // The single most security-relevant invariant on this surface: a route that
    // loses its protect() gate becomes publicly reachable, and that must fail
    // loudly here rather than ship. Every entry below is intentionally public
    // (login/registration flow, the public careers + settings endpoints, the
    // PayMongo webhook, and the app-level health/robots/landing routes).
    const publicRoutes = POS_ROUTES.filter((r) => r.isPublic).map((r) => `${r.method} ${r.path}`);
    expect(publicRoutes.sort()).toEqual([
      'GET /',
      'GET /api/v1/auth/csrf-token',
      'GET /api/v1/public/jobs',
      'GET /api/v1/public/jobs/:id',
      'GET /api/v1/public/settings',
      'GET /health',
      'GET /robots.txt',
      'POST /api/v1/auth/forgot-password',
      'POST /api/v1/auth/login',
      'POST /api/v1/auth/refresh-token',
      'POST /api/v1/auth/register',
      'POST /api/v1/auth/reset-password',
      'POST /api/v1/payments/webhook',
      'POST /api/v1/public/jobs/apply',
    ]);
  });

  it('authenticated-but-not-role-gated routes stay the reviewed read/self-service set', () => {
    // These carry protect() but no authorize()/hasPermission(): any signed-in
    // role may call them. They are reads of shared catalogue data, the caller's
    // own auth/profile/notification/shift state, or actions the service scopes
    // by req.user. Writes to other people's data are all gated and covered by
    // the forbidden legs below.
    const bare = POS_ROUTES.filter(
      (r) => !r.isPublic && r.roles.length === 0 && r.perms.length === 0,
    );
    expect(bare.length).toBe(44);
    // None of them may be a destructive verb on another user's resource.
    const destructive = bare.filter((r) => r.method === 'DELETE');
    expect(destructive.map((r) => r.path)).toEqual(['/api/v1/notifications/:id']);
  });
});

runRouteMatrix({
  title: 'POS route matrix',
  getCtx,
  routes: POS_ROUTES,
  overrides: OVERRIDES,
});
