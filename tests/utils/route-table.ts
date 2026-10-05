/**
 * Static route inventory for the Phase-6 route matrix.
 *
 * GENERATED FILE — do not hand-edit. Regenerate with:
 *   node scripts/generate-route-table.js
 *
 * Produced by walking every `router.<method>(...)` call in src/routes/** with a
 * paren-counting parser (so multi-line definitions are captured whole) and
 * cross-checked against the live Express router stack of src/app.js. Both agree
 * on 255 routes:
 *   POS/admin surface (everything not under /api/v1/hrms): 143
 *   HRMS surface (/api/v1/hrms/**)                       : 112
 * including the four routes declared directly on the app in src/app.js
 * (/, /health, /metrics, /robots.txt).
 *
 * `roles`    = allow-list passed to authorize() (empty => any authenticated role).
 * `perms`    = slugs passed to hasPermission() (empty => no permission gate).
 * `isPublic` = no protect() and no authorize()/hasPermission() gate.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RouteSpec {
  method: HttpMethod;
  /** Absolute path including the /api/v1 prefix and any :param segments. */
  path: string;
  /** True when the route is reachable without a Bearer token. */
  isPublic: boolean;
  /** authorize() allow-list of role slugs; empty means any authenticated role. */
  roles: string[];
  /** hasPermission() slugs; empty means no permission gate. */
  perms: string[];
  /** Route consumes a multipart upload (product image / resume / document). */
  upload?: boolean;
  /** Declared on the Express app in src/app.js rather than under the API router. */
  app?: boolean;
}

export const POS_ROUTES: RouteSpec[] = [
  {
    "method": "GET",
    "path": "/",
    "isPublic": true,
    "roles": [],
    "perms": [],
    "app": true
  },
  {
    "method": "GET",
    "path": "/api/v1/activity-logs",
    "isPublic": false,
    "roles": [
      "admin"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/activity-logs/user/:userId",
    "isPublic": false,
    "roles": [
      "admin"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/auth/change-password",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/auth/csrf-token",
    "isPublic": true,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/auth/forgot-password",
    "isPublic": true,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/auth/login",
    "isPublic": true,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/auth/logout",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/auth/profile",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/auth/profile",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/auth/refresh-token",
    "isPublic": true,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/auth/register",
    "isPublic": true,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/auth/reset-password",
    "isPublic": true,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/branches",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/branches",
    "isPublic": false,
    "roles": [],
    "perms": [
      "branches.manage"
    ],
    "upload": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/branches/:id",
    "isPublic": false,
    "roles": [],
    "perms": [
      "branches.manage"
    ],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/branches/:id",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/branches/:id",
    "isPublic": false,
    "roles": [],
    "perms": [
      "branches.manage"
    ],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/branches/:id/stats",
    "isPublic": false,
    "roles": [
      "admin",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/categories",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/categories",
    "isPublic": false,
    "roles": [
      "admin",
      "manager",
      "inventory_staff"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/categories/:id",
    "isPublic": false,
    "roles": [
      "admin"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/categories/:id",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/categories/:id",
    "isPublic": false,
    "roles": [
      "admin",
      "manager",
      "inventory_staff"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/categories/tree",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/customers",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/customers",
    "isPublic": false,
    "roles": [],
    "perms": [
      "customers.manage"
    ],
    "upload": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/customers/:id",
    "isPublic": false,
    "roles": [],
    "perms": [
      "customers.delete"
    ],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/customers/:id",
    "isPublic": false,
    "roles": [
      "admin",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/customers/:id",
    "isPublic": false,
    "roles": [
      "admin",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/dashboard",
    "isPublic": false,
    "roles": [
      "admin",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/discounts",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/discounts",
    "isPublic": false,
    "roles": [],
    "perms": [
      "discounts.manage"
    ],
    "upload": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/discounts/:id",
    "isPublic": false,
    "roles": [],
    "perms": [
      "discounts.delete"
    ],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/discounts/:id",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/discounts/:id",
    "isPublic": false,
    "roles": [],
    "perms": [
      "discounts.manage"
    ],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/discounts/validate",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/discounts/validate",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/expense-categories",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/expense-categories",
    "isPublic": false,
    "roles": [
      "admin",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/expense-categories/:id",
    "isPublic": false,
    "roles": [
      "admin"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/expense-categories/:id",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/expense-categories/:id",
    "isPublic": false,
    "roles": [
      "admin",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/expenses",
    "isPublic": false,
    "roles": [
      "admin",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/expenses",
    "isPublic": false,
    "roles": [],
    "perms": [
      "expenses.manage"
    ],
    "upload": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/expenses/:id",
    "isPublic": false,
    "roles": [],
    "perms": [
      "expenses.delete"
    ],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/expenses/:id",
    "isPublic": false,
    "roles": [
      "admin",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/expenses/:id",
    "isPublic": false,
    "roles": [],
    "perms": [
      "expenses.manage"
    ],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/expenses/report",
    "isPublic": false,
    "roles": [
      "admin",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/finance/cashflow",
    "isPublic": false,
    "roles": [
      "admin",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/finance/report",
    "isPublic": false,
    "roles": [
      "admin",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/inventory/adjust",
    "isPublic": false,
    "roles": [],
    "perms": [
      "inventory.manage"
    ],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/inventory/check-expiring",
    "isPublic": false,
    "roles": [
      "admin",
      "manager",
      "inventory_staff"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/inventory/check-low-stock",
    "isPublic": false,
    "roles": [
      "admin",
      "manager",
      "inventory_staff"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/inventory/logs",
    "isPublic": false,
    "roles": [
      "admin",
      "manager",
      "inventory_staff"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/inventory/movements",
    "isPublic": false,
    "roles": [
      "admin",
      "manager",
      "inventory_staff"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/inventory/stock-in",
    "isPublic": false,
    "roles": [],
    "perms": [
      "inventory.manage"
    ],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/inventory/stock-out",
    "isPublic": false,
    "roles": [],
    "perms": [
      "inventory.manage"
    ],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/loyalty/:customerId",
    "isPublic": false,
    "roles": [
      "admin",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/loyalty/redeem",
    "isPublic": false,
    "roles": [
      "admin",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/notifications",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/notifications/:id",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/notifications/mark-all-read",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/notifications/mark-read",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/notifications/unread-count",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/payments/create-checkout",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/payments/status/:saleId",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/payments/test",
    "isPublic": false,
    "roles": [
      "admin"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/payments/verify/:saleId",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/payments/webhook",
    "isPublic": true,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/petty-cash",
    "isPublic": false,
    "roles": [
      "admin",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/petty-cash",
    "isPublic": false,
    "roles": [
      "admin"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/petty-cash/:id",
    "isPublic": false,
    "roles": [
      "admin",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/petty-cash/:id",
    "isPublic": false,
    "roles": [
      "admin"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "PATCH",
    "path": "/api/v1/petty-cash/:id/close",
    "isPublic": false,
    "roles": [
      "admin"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/petty-cash/:id/deposit",
    "isPublic": false,
    "roles": [
      "admin",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/petty-cash/:id/transactions",
    "isPublic": false,
    "roles": [
      "admin",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/petty-cash/:id/withdraw",
    "isPublic": false,
    "roles": [
      "admin",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/petty-cash/summary",
    "isPublic": false,
    "roles": [
      "admin",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/products",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/products",
    "isPublic": false,
    "roles": [],
    "perms": [
      "products.create"
    ],
    "upload": true
  },
  {
    "method": "DELETE",
    "path": "/api/v1/products/:id",
    "isPublic": false,
    "roles": [],
    "perms": [
      "products.delete"
    ],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/products/:id",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/products/:id",
    "isPublic": false,
    "roles": [],
    "perms": [
      "products.update"
    ],
    "upload": true
  },
  {
    "method": "GET",
    "path": "/api/v1/products/barcode/:barcode",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/products/best-sellers",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/products/expiring",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/products/low-stock",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/public/jobs",
    "isPublic": true,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/public/jobs/:id",
    "isPublic": true,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/public/jobs/apply",
    "isPublic": true,
    "roles": [],
    "perms": [],
    "upload": true
  },
  {
    "method": "GET",
    "path": "/api/v1/public/settings",
    "isPublic": true,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/purchases",
    "isPublic": false,
    "roles": [
      "admin",
      "manager",
      "inventory_staff"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/purchases",
    "isPublic": false,
    "roles": [],
    "perms": [
      "purchases.create"
    ],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/purchases/:id",
    "isPublic": false,
    "roles": [
      "admin",
      "manager",
      "inventory_staff"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/purchases/:id/cancel",
    "isPublic": false,
    "roles": [],
    "perms": [
      "purchases.cancel"
    ],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/purchases/:id/pay",
    "isPublic": false,
    "roles": [],
    "perms": [
      "purchases.pay"
    ],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/purchases/:id/receive",
    "isPublic": false,
    "roles": [
      "admin",
      "manager",
      "inventory_staff"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/roles",
    "isPublic": false,
    "roles": [
      "admin"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/sales",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/sales",
    "isPublic": false,
    "roles": [],
    "perms": [
      "sales.create"
    ],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/sales/:id",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/sales/:id/cancel",
    "isPublic": false,
    "roles": [],
    "perms": [
      "sales.cancel"
    ],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/sales/:id/email-receipt",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/sales/:id/refund",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/sales/invoice/:invoiceNo",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/sales/pending",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/sales/pending",
    "isPublic": false,
    "roles": [],
    "perms": [
      "sales.create"
    ],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/sales/pending/:id/cancel",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/sales/pending/:id/cash-complete",
    "isPublic": false,
    "roles": [
      "admin",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/sales/report",
    "isPublic": false,
    "roles": [
      "admin",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/settings",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/settings",
    "isPublic": false,
    "roles": [
      "admin"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/shifts",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/shifts",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/shifts/:id",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/shifts/close",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/shifts/mine/open",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/shifts/summary",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/suppliers",
    "isPublic": false,
    "roles": [],
    "perms": [
      "suppliers.view"
    ],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/suppliers",
    "isPublic": false,
    "roles": [],
    "perms": [
      "suppliers.manage"
    ],
    "upload": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/suppliers/:id",
    "isPublic": false,
    "roles": [],
    "perms": [
      "suppliers.delete"
    ],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/suppliers/:id",
    "isPublic": false,
    "roles": [],
    "perms": [
      "suppliers.view"
    ],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/suppliers/:id",
    "isPublic": false,
    "roles": [],
    "perms": [
      "suppliers.manage"
    ],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/suppliers/:id/purchases",
    "isPublic": false,
    "roles": [
      "admin",
      "manager",
      "inventory_staff"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/suppliers/:id/summary",
    "isPublic": false,
    "roles": [
      "admin",
      "manager",
      "inventory_staff"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/suppliers/analytics",
    "isPublic": false,
    "roles": [
      "admin",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/suppliers/export",
    "isPublic": false,
    "roles": [
      "admin",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/suppliers/import",
    "isPublic": false,
    "roles": [
      "admin",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/suppliers/outstanding-balances",
    "isPublic": false,
    "roles": [
      "admin",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/tracking/by-purchase/:purchaseId",
    "isPublic": false,
    "roles": [
      "admin",
      "manager",
      "inventory_staff"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/tracking/delivery/:deliveryId",
    "isPublic": false,
    "roles": [
      "admin",
      "manager",
      "inventory_staff"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/tracking/ship/:purchaseId",
    "isPublic": false,
    "roles": [
      "admin",
      "manager",
      "inventory_staff"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/tracking/simulate/:deliveryId",
    "isPublic": false,
    "roles": [
      "admin",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/tracking/update",
    "isPublic": false,
    "roles": [
      "admin",
      "manager",
      "inventory_staff"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/users",
    "isPublic": false,
    "roles": [],
    "perms": [
      "users.view"
    ],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/users",
    "isPublic": false,
    "roles": [],
    "perms": [
      "users.manage"
    ],
    "upload": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/users/:id",
    "isPublic": false,
    "roles": [],
    "perms": [
      "users.delete"
    ],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/users/:id",
    "isPublic": false,
    "roles": [],
    "perms": [
      "users.view"
    ],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/users/:id",
    "isPublic": false,
    "roles": [],
    "perms": [
      "users.manage"
    ],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/health",
    "isPublic": true,
    "roles": [],
    "perms": [],
    "app": true
  },
  {
    "method": "GET",
    "path": "/metrics",
    "isPublic": false,
    "roles": [
      "admin"
    ],
    "perms": [],
    "app": true
  },
  {
    "method": "GET",
    "path": "/robots.txt",
    "isPublic": true,
    "roles": [],
    "perms": [],
    "app": true
  }
];

export const HRMS_ROUTES: RouteSpec[] = [
  {
    "method": "GET",
    "path": "/api/v1/hrms/attendance",
    "isPublic": false,
    "roles": [
      "admin",
      "hr",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/hrms/attendance/:id",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/hrms/attendance/bulk-clock-in",
    "isPublic": false,
    "roles": [
      "admin",
      "hr",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/hrms/attendance/bulk-clock-out",
    "isPublic": false,
    "roles": [
      "admin",
      "hr",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/attendance/calendar",
    "isPublic": false,
    "roles": [
      "admin",
      "hr",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/hrms/attendance/clock-in",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/hrms/attendance/clock-out",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/attendance/export",
    "isPublic": false,
    "roles": [
      "admin",
      "hr",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/attendance/today",
    "isPublic": false,
    "roles": [
      "admin",
      "hr",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/branches",
    "isPublic": false,
    "roles": [
      "admin",
      "hr",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/categories",
    "isPublic": false,
    "roles": [
      "admin",
      "hr",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/categories/tree",
    "isPublic": false,
    "roles": [
      "admin",
      "hr",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/contracts",
    "isPublic": false,
    "roles": [
      "admin",
      "hr",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/hrms/contracts",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/hrms/contracts/:id",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/contracts/:id",
    "isPublic": false,
    "roles": [
      "admin",
      "hr",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/hrms/contracts/:id",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/hrms/contracts/:id/approve",
    "isPublic": false,
    "roles": [
      "admin"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/hrms/contracts/:id/reject",
    "isPublic": false,
    "roles": [
      "admin"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/hrms/contracts/:id/renew",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/hrms/contracts/:id/terminate",
    "isPublic": false,
    "roles": [
      "admin"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/hrms/contracts/check-expired",
    "isPublic": false,
    "roles": [
      "admin"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/contracts/expiring/soon",
    "isPublic": false,
    "roles": [
      "admin",
      "hr",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/departments",
    "isPublic": false,
    "roles": [
      "admin",
      "hr",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/hrms/departments",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/hrms/departments/:id",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/departments/:id",
    "isPublic": false,
    "roles": [
      "admin",
      "hr",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/hrms/departments/:id",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/hrms/employee-documents/:id",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/employee-documents/:id/download",
    "isPublic": false,
    "roles": [
      "admin",
      "hr",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/employees",
    "isPublic": false,
    "roles": [
      "admin",
      "hr",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/hrms/employees",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/employees/:employeeId/documents",
    "isPublic": false,
    "roles": [
      "admin",
      "hr",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/hrms/employees/:employeeId/documents",
    "isPublic": false,
    "roles": [
      "admin",
      "hr",
      "manager"
    ],
    "perms": [],
    "upload": true
  },
  {
    "method": "DELETE",
    "path": "/api/v1/hrms/employees/:id",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/employees/:id",
    "isPublic": false,
    "roles": [
      "admin",
      "hr",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/hrms/employees/:id",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/hrms/employees/:id/approve",
    "isPublic": false,
    "roles": [
      "admin"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/employees/:id/detail",
    "isPublic": false,
    "roles": [
      "admin",
      "hr",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/hrms/employees/:id/pos-access",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/hrms/employees/:id/pos-revoke",
    "isPublic": false,
    "roles": [
      "admin",
      "hr",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/hrms/employees/:id/reject",
    "isPublic": false,
    "roles": [
      "admin"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/hrms/employees/:id/terminate",
    "isPublic": false,
    "roles": [
      "admin"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/employees/export",
    "isPublic": false,
    "roles": [
      "admin",
      "hr",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/employees/org-chart",
    "isPublic": false,
    "roles": [
      "admin",
      "hr",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/interviewers",
    "isPublic": false,
    "roles": [
      "admin",
      "hr",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/interviews",
    "isPublic": false,
    "roles": [
      "admin",
      "hr",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/hrms/interviews",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/hrms/interviews/:id",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/hrms/interviews/:id",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/hrms/interviews/:id/result",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/jobs",
    "isPublic": false,
    "roles": [
      "admin",
      "hr",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/hrms/jobs",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/hrms/jobs/:id",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/jobs/:id",
    "isPublic": false,
    "roles": [
      "admin",
      "hr",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/hrms/jobs/:id",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/hrms/jobs/:id/approve",
    "isPublic": false,
    "roles": [
      "admin"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/hrms/jobs/:id/close",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/hrms/jobs/:id/reject",
    "isPublic": false,
    "roles": [
      "admin"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/hrms/jobs/applications",
    "isPublic": false,
    "roles": [
      "employee"
    ],
    "perms": [],
    "upload": true
  },
  {
    "method": "PUT",
    "path": "/api/v1/hrms/jobs/applications/:id/status",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/jobs/applications/list",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/jobs/applications/resume/:filename",
    "isPublic": false,
    "roles": [
      "admin",
      "hr",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/leaves",
    "isPublic": false,
    "roles": [
      "admin",
      "hr",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/hrms/leaves",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/hrms/leaves/:id",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/leaves/:id",
    "isPublic": false,
    "roles": [
      "admin",
      "hr",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/hrms/leaves/:id/admin-approve",
    "isPublic": false,
    "roles": [
      "admin"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/hrms/leaves/:id/admin-reject",
    "isPublic": false,
    "roles": [
      "admin"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/hrms/leaves/:id/cancel",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/hrms/leaves/:id/hr-review",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/leaves/balance/:employeeId",
    "isPublic": false,
    "roles": [
      "admin",
      "hr",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/me",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/me/attendance",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/me/contracts",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/me/leaves",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/hrms/me/leaves",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/me/leaves/balance",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/me/payslips",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/me/profile",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/hrms/me/profile",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/notifications",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/hrms/notifications/:id",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/hrms/notifications/mark-all-read",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/hrms/notifications/mark-read",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/notifications/unread-count",
    "isPublic": false,
    "roles": [],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/payrolls",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/hrms/payrolls",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/payrolls/:id",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/payrolls/:id/export",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/hrms/payrolls/:id/pay",
    "isPublic": false,
    "roles": [
      "admin"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/payrolls/:id/payslips",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/hrms/payrolls/:id/process",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/payrolls/preview",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/hrms/payrolls/preview",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/pending-counts",
    "isPublic": false,
    "roles": [
      "admin",
      "hr",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/pos-staff",
    "isPublic": false,
    "roles": [
      "admin",
      "hr",
      "manager",
      "cashier"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/positions",
    "isPublic": false,
    "roles": [
      "admin",
      "hr",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/hrms/positions",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/hrms/positions/:id",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/positions/:id",
    "isPublic": false,
    "roles": [
      "admin",
      "hr",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/hrms/positions/:id",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/schedules",
    "isPublic": false,
    "roles": [
      "admin",
      "hr",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/hrms/schedules",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/hrms/schedules/:id",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/schedules/:id",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "PUT",
    "path": "/api/v1/hrms/schedules/:id",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "POST",
    "path": "/api/v1/hrms/schedules/assign",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/hrms/schedules/assignments/:id",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/schedules/assignments/list",
    "isPublic": false,
    "roles": [
      "admin",
      "hr",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "GET",
    "path": "/api/v1/hrms/schedules/permanent",
    "isPublic": false,
    "roles": [
      "admin",
      "hr",
      "manager"
    ],
    "perms": [],
    "upload": false
  },
  {
    "method": "DELETE",
    "path": "/api/v1/hrms/schedules/permanent/:employeeId",
    "isPublic": false,
    "roles": [
      "admin",
      "hr"
    ],
    "perms": [],
    "upload": false
  }
];
