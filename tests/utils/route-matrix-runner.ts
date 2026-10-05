/**
 * Route-matrix runner (Phase 6).
 *
 * Turns the static inventory in route-table.ts into three assertions per route:
 *
 *   1. happy       — a role the middleware actually permits calls the route with
 *                    seeded parameters and a valid body. Asserts the caller was
 *                    NOT rejected for auth (401/403) and that the status is the
 *                    one documented for that route.
 *   2. unauth      — no Bearer token => 401. Skipped for genuinely public routes.
 *   3. forbidden   — the least-privileged denied role => 403. Only emitted when
 *                    the route has an authorize()/hasPermission() gate, because a
 *                    bare protect() route has no role restriction to violate.
 *
 * Permitted/denied roles are DERIVED from the route's authorize() allow-list and
 * hasPermission() slugs combined with the real role->permission map mirrored in
 * route-matrix-setup.ts, so the matrix cannot drift from the middleware it is
 * testing without also failing.
 *
 * Set MATRIX_DISCOVER=1 to print the observed status for every leg instead of
 * asserting, which is how the `expect` overrides below were seeded.
 */
import { describe, it, expect } from 'vitest';
import type { RouteSpec } from './route-table';
import {
  type RouteMatrixContext,
  type RoleSlug,
  ROLES,
  ROLE_PERMISSIONS,
  matrixRequest,
} from './route-matrix-setup';

const DISCOVER = process.env.MATRIX_DISCOVER === '1';

export const routeKey = (spec: RouteSpec): string => `${spec.method} ${spec.path}`;

/** Roles whose slug passes authorize() AND whose permissions satisfy hasPermission(). */
export function permittedRoles(spec: RouteSpec): RoleSlug[] {
  return ROLES.filter(
    (r) =>
      (spec.roles.length === 0 || spec.roles.includes(r)) &&
      spec.perms.every((p) => ROLE_PERMISSIONS[r].includes(p)),
  );
}

/** Roles the middleware must reject with 403. */
export function deniedRoles(spec: RouteSpec): RoleSlug[] {
  const ok = permittedRoles(spec);
  return ROLES.filter((r) => !ok.includes(r));
}

export interface RouteOverride {
  /** Role to use for the happy leg. Defaults to the first permitted role. */
  role?: RoleSlug;
  /**
   * Act on a user other than the role's own matrix user. Used by the two
   * routes that mutate the caller's credentials (change-password, logout) so
   * they consume the sacrificial `mutator` account instead of poisoning the
   * shared token for a matrix role.
   */
  actor?: string;
  /** Substituted into :param segments, overriding the resource-based default. */
  params?: Record<string, string | number> | ((ids: any) => Record<string, string | number>);
  /** JSON body for the happy leg. */
  body?: any | ((ids: any) => any);
  /** Query string for the happy leg. */
  query?: any | ((ids: any) => any);
  /** Statuses accepted as a successful happy leg. */
  expect?: number[];
  /** Body for the forbidden leg (defaults to the happy body). */
  forbiddenBody?: any | ((ids: any) => any);
  /**
   * Send the happy leg as multipart/form-data instead of JSON. Required by
   * POST /products, which guards on `if (!req.file) return next(badRequest(...))`
   * — a JSON body can never satisfy it.
   */
  multipart?: { field: string; filename: string; mimetype: string; contentB64: string };
  /** Suppress the forbidden leg even though the route is role-gated. */
  skipForbidden?: boolean;
  /** Suppress the unauthenticated leg. */
  skipUnauth?: boolean;
  /** Why this route's happy status is not the plain 2xx default. */
  note?: string;
}

export type OverrideMap = Record<string, RouteOverride>;

/** Default happy-leg statuses by verb. */
const DEFAULT_EXPECT: Record<string, number[]> = {
  GET: [200],
  POST: [200, 201],
  PUT: [200],
  PATCH: [200],
  // Several delete controllers answer 204 No Content rather than 200.
  DELETE: [200, 204],
};

/**
 * Params whose meaning is fixed by their own name rather than by the resource
 * segment they hang off (e.g. /sales/invoice/:invoiceNo).
 */
const NAMED_PARAMS: Record<string, (ids: any) => string | number> = {
  barcode: (ids) => ids.productBarcode,
  invoiceNo: (ids) => ids.invoiceNo,
  saleId: (ids) => ids.sale,
  purchaseId: (ids) => ids.purchase,
  deliveryId: (ids) => ids.delivery,
  customerId: (ids) => ids.customer,
  userId: (ids) => ids.user_cashier,
  employeeId: (ids) => ids.employee,
  filename: (ids) => ids.documentFilename,
};

/**
 * Resource segment -> the ids key its `:id` should resolve to.
 *
 * For mutating verbs (DELETE / PUT / PATCH) the runner prefers `<key>Target`,
 * the disposable twin seeded by route-matrix-setup, and falls back to the
 * stable row when no twin exists. That keeps read legs and write legs from
 * interfering: e.g. employeeService.delete() deactivates the linked User, so
 * DELETE /hrms/employees/:id must never point at the employee matrix user's own
 * Employee row or every later employee-role leg would 401.
 */
const RESOURCE_ID_KEYS: Record<string, string> = {
  products: 'product',
  categories: 'category',
  customers: 'customer',
  suppliers: 'supplier',
  branches: 'branch',
  discounts: 'discount',
  expenses: 'expense',
  'expense-categories': 'expenseCategory',
  users: 'user',
  sales: 'sale',
  shifts: 'shift',
  notifications: 'notification',
  'petty-cash': 'pettyCashFund',
  purchases: 'purchase',
  payments: 'sale',
  loyalty: 'customer',
  roles: 'role',
  departments: 'department',
  positions: 'position',
  employees: 'employee',
  jobs: 'job',
  applications: 'application',
  contracts: 'contract',
  leaves: 'leave',
  balance: 'employee',
  interviews: 'interview',
  payrolls: 'payroll',
  attendance: 'attendance',
  schedules: 'schedule',
  assignments: 'employee',
  permanent: 'employee',
  'employee-documents': 'employeeDocument',
  documents: 'employee',
  tracking: 'purchase',
  'by-purchase': 'purchase',
  delivery: 'delivery',
  ship: 'purchase',
  simulate: 'delivery',
};

/** Verbs whose `:id` should resolve to the disposable twin. */
const MUTATING = new Set(['DELETE', 'PUT', 'PATCH']);

const SKIP_SEGMENTS = new Set(['api', 'v1', 'hrms']);

/** Replace every :param segment using NAMED_PARAMS then RESOURCE_ID_KEYS. */
export function fillPath(
  spec: RouteSpec,
  ids: any,
  extra?: Record<string, string | number>,
  pooled?: number,
): string {
  const segments = spec.path.split('/');
  let resource = '';
  const out = segments.map((seg) => {
    if (!seg.startsWith(':')) {
      if (!SKIP_SEGMENTS.has(seg) && seg !== '') resource = seg;
      return seg;
    }
    const name = seg.slice(1);
    if (extra && name in extra) return String(extra[name]);
    if (name in NAMED_PARAMS) return String(NAMED_PARAMS[name](ids));
    // Mutating verbs consume their row, so they draw from the disposal pool
    // (one row per route, allocated by the runner) instead of the stable
    // fixture that read legs depend on.
    if (MUTATING.has(spec.method) && pooled !== undefined) return String(pooled);
    const key = resource ? RESOURCE_ID_KEYS[resource] : undefined;
    if (key && ids[key] !== undefined && ids[key] !== null) return String(ids[key]);
    // Unresolved params deliberately fall back to a non-existent id: the route
    // still proves authorisation ran before the lookup, and the happy leg for
    // such a route declares a 404 expectation explicitly.
    return '999999';
  });
  return out.join('/');
}

const resolve = (v: any, ids: any) => (typeof v === 'function' ? v(ids) : v);

/**
 * Mint a fresh Bearer token for this leg. A new token per request is required:
 * POST /auth/logout blacklists whatever token it is handed and
 * POST /auth/change-password bumps passwordChangedAt, so a single long-lived
 * token per role would 401 every subsequent leg for that role.
 */
function tokenFor(ctx: RouteMatrixContext, actor: string | undefined, role: RoleSlug | undefined): string | undefined {
  const key = actor ? `user_${actor}` : role ? `user_${role}` : null;
  if (!key || ctx.ids[key] === undefined) return undefined;
  return ctx.mint(ctx.ids[key]);
}

/** Pick the role for the happy leg: explicit override, else the first permitted. */
export function happyRole(spec: RouteSpec, ov: RouteOverride): RoleSlug | undefined {
  if (ov.role) return ov.role;
  const allowed = permittedRoles(spec);
  return allowed[0];
}

/**
 * Per-resource cursor into ids.pool. Incremented once per ROUTE (not per leg)
 * so the happy and forbidden legs of the same mutating route act on the same
 * row, and two different mutating routes never share one.
 */
const poolCursor: Record<string, number> = {};
const routeAllocation = new Map<string, number>();

function pooledIdFor(routeKey: string, spec: RouteSpec, ids: any): number | undefined {
  if (!MUTATING.has(spec.method)) return undefined;
  if (routeAllocation.has(routeKey)) {
    const cached = routeAllocation.get(routeKey)!;
    return cached === -1 ? undefined : cached;
  }
  // The resource is the last literal segment before the first :param.
  const segments = spec.path.split('/');
  let resource = '';
  let hasParam = false;
  for (const seg of segments) {
    if (seg.startsWith(':')) { hasParam = true; break; }
    if (!SKIP_SEGMENTS.has(seg) && seg !== '') resource = seg;
  }
  if (!hasParam) { routeAllocation.set(routeKey, -1); return undefined; }
  const key = RESOURCE_ID_KEYS[resource];
  const pool = key ? ids?.pool?.[key] : undefined;
  if (!pool || !pool.length) { routeAllocation.set(routeKey, -1); return undefined; }
  const idx = poolCursor[key] ?? 0;
  poolCursor[key] = idx + 1;
  const allocated = pool[idx % pool.length];
  routeAllocation.set(routeKey, allocated);
  return allocated;
}

/** Absolute URL for a leg, with :params resolved from fixtures/pools/overrides. */
function resolveUrl(ctx: RouteMatrixContext, spec: RouteSpec, ov: RouteOverride): string {
  if (spec.app) return ctx.baseUrl + spec.path;
  const pooled = pooledIdFor(routeKey(spec), spec, ctx.ids);
  return ctx.baseUrl + fillPath(spec, ctx.ids, resolve(ov.params, ctx.ids), pooled);
}

export interface MatrixRunOptions {
  title: string;
  getCtx: () => RouteMatrixContext;
  routes: RouteSpec[];
  overrides?: OverrideMap;
}

/**
 * Emit the matrix. Must be called at collection time (top level of the test
 * file) so Vitest registers every `it` before running anything.
 */
export function runRouteMatrix(opts: MatrixRunOptions): void {
  const { title, getCtx, routes, overrides = {} } = opts;

  describe(title, () => {
    for (const spec of routes) {
      const key = routeKey(spec);
      const ov = overrides[key] || {};
      const allowed = permittedRoles(spec);
      const denied = deniedRoles(spec);
      const expected = ov.expect || DEFAULT_EXPECT[spec.method] || [200];

      describe(key, () => {
        // ── leg 1: happy ────────────────────────────────────────────────
        const role = happyRole(spec, ov);
        if (spec.isPublic || !role) {
          it(`${spec.isPublic ? 'public route' : 'no permitted role'} responds without an auth rejection`, async () => {
            const ctx = getCtx();
            const url = resolveUrl(ctx, spec, ov);
            const res = await matrixRequest(ctx, spec.method, url, {
              token: tokenFor(ctx, ov.actor, role),
              body: resolve(ov.body, ctx.ids),
              params: resolve(ov.query, ctx.ids),
              multipart: ov.multipart,
            });
            if (DISCOVER) { console.log(`DISCOVER ${key} happy=${res.status}`); return; }
            expect(
              expected,
              `${key} returned ${res.status}${ov.note ? ` — ${ov.note}` : ''}: ${JSON.stringify(res.data).slice(0, 300)}`,
            ).toContain(res.status);
          });
        } else {
          it(`happy: ${role} is allowed through the middleware chain`, async () => {
            const ctx = getCtx();
            const url = resolveUrl(ctx, spec, ov);
            const res = await matrixRequest(ctx, spec.method, url, {
              token: tokenFor(ctx, ov.actor, role),
              body: resolve(ov.body, ctx.ids),
              params: resolve(ov.query, ctx.ids),
              multipart: ov.multipart,
            });
            if (DISCOVER) { console.log(`DISCOVER ${key} happy[${role}]=${res.status}`); return; }
            // Authorisation must never be the reason this leg fails.
            expect(res.status, `${key} was rejected for auth as ${role}`).not.toBe(401);
            expect(res.status, `${key} was forbidden as ${role}`).not.toBe(403);
            expect(
              expected,
              `${key} returned ${res.status}${ov.note ? ` — ${ov.note}` : ''}: ${JSON.stringify(res.data).slice(0, 300)}`,
            ).toContain(res.status);
          });
        }

        // ── leg 2: unauthenticated ──────────────────────────────────────
        if (!spec.isPublic && !ov.skipUnauth) {
          it('authz: no token is rejected with 401', async () => {
            const ctx = getCtx();
            const url = resolveUrl(ctx, spec, ov);
            const res = await matrixRequest(ctx, spec.method, url, {
              body: resolve(ov.body, ctx.ids),
              params: resolve(ov.query, ctx.ids),
            });
            if (DISCOVER) { console.log(`DISCOVER ${key} unauth=${res.status}`); return; }
            expect(res.status, `${key} should require authentication`).toBe(401);
          });
        }

        // ── leg 3: forbidden role ───────────────────────────────────────
        const restricted = spec.roles.length > 0 || spec.perms.length > 0;
        if (restricted && denied.length > 0 && !ov.skipForbidden) {
          // Least privileged first: employee is the tightest role in the app.
          const bad = denied[denied.length - 1];
          it(`authz: ${bad} is forbidden with 403`, async () => {
            const ctx = getCtx();
            const url = resolveUrl(ctx, spec, ov);
            const res = await matrixRequest(ctx, spec.method, url, {
              token: tokenFor(ctx, undefined, bad),
              body: resolve(ov.forbiddenBody ?? ov.body, ctx.ids),
              params: resolve(ov.query, ctx.ids),
              multipart: ov.multipart,
            });
            if (DISCOVER) { console.log(`DISCOVER ${key} forbidden[${bad}]=${res.status}`); return; }
            expect(res.status, `${key} should reject ${bad}`).toBe(403);
          });
        }
      });
    }
  });
}
