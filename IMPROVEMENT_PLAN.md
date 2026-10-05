# MiniMart POS + HRMS — System Review & Improvement Plan

**Date:** 2026-10-05 · **Status:** EXECUTING — P0 + P1 complete, P2 core (landing + jobs) complete; next: P2 login polish, then P3
**Scope:** backend API, POS frontend, HRMS frontend, public site, database, security, tests, deployment

### Progress log

**Done — P0 (all three, verified live):**
- **P0-1** sale 500 root-caused to a Joi root-level `.when()` in `createSale` → replaced with
  field-level conditional on `discountType`; POST /sales now 201, invalid input 422 JSON
- **P0-2** `DIALECT` default now `sqlite` so the app boots without `.env`
- **P0-3** public registration now **off by default** (production) with runtime `ALLOW_PUBLIC_REGISTRATION`
  env override **and** an admin Settings toggle (`allowPublicRegistration` + computed
  `publicRegistrationEffective` in every GET/PUT response)
- **Bonus P0** money bug: item-level discounts were never subtracted from the sale total
  (receipt line 19.8 vs total 22) → fixed in `sale.service.js` (`totalItemDiscount` accumulator)
  and mirrored in `frontend/src/utils/pricing.js`; live-verified (10% off ₱22 → total 19.8, change 10.2)

**Done — P1 security:**
- Socket.IO connections now require a valid JWT (handshake auth or cookie); room joins
  role-restricted to admin/manager/inventory_staff — verified live (no-token/bad-token rejected,
  cashier `join-delivery` → forbidden, admin → room joined)
- `LiveTracking.jsx` now sends `auth: { token }` (all three token stores) + falls back to 5s REST
  polling with a banner when the socket is refused
- Token blacklist check wired into auth middleware with a short-TTL in-memory LRU cache
  (fail-closed); login lockout + audit logging verified
- `CORS_ORIGIN` wildcard removed from render.yaml/Dockerfile; documented in `.env.example`
- `uploads/documents/*` gitignored; the two committed PDFs untracked
- `/api/v1/tracking/:id` GETs role-restricted (cashier 403 / admin 200)

**Done — P2 public site (core):**
- **Landing page** at `/` (static, no build step — `public/site/`): hero with store brand
  (hydrated from the new brand-safe `GET /api/v1/public/settings` — never exposes
  payment numbers/tax rate), open-roles grid, company/visit strip, footer with staff
  login + HRMS portal CTAs, skeleton loaders, designed empty state, responsive,
  dark-mode aware, SEO (title/description/OG/JSON-LD Organization+JobPosting),
  XSS-safe rendering (textContent only), `robots.txt`. `/hrms/careers` unchanged as
  the full application portal; both SPAs already ship designed 404 pages.
- **Demo jobs seed** (idempotent): 5 open postings (Cashier, Sales Associate,
  Warehouse Staff, HR Officer, Accountant) with real descriptions, salaries,
  45-day closing dates — only when no open postings exist, so real stores are
  never touched.
- New `tests/integration/public.routes.integration.test.ts` (9 tests: open-only
  listing, closed-job 400, unknown 404, settings field-exposure guard, apply
  validation). Full suite now 18/18 files.

**Done — tests:** new route-level integration suite `tests/integration/sale.routes.integration.test.ts`
(16 tests against the real Express app: sale totals incl. item discounts, 422s, role gates,
pending sales, register gate ×3, tracking IDOR). Fixed the time-of-day flake in
`job.service.test.ts` (hardcoded "08:00 past" → dynamic 2-minutes-ago). **Full suite: 448/448,
17/17 files.** Coverage ratchet still green.

---

## 0. What was done for this review

- Read the entire backend (`src/`, ~16.7k LOC) and both frontends (~29.5k LOC)
- Installed dependencies, ran the full test suite (431/432 passing), built both frontends
- **Booted the live server** and exercised the real API: login (3 roles), product listing,
  sale creation, public registration, public job portal, auth checks, rate limits
- Inspected deployment configs (Render, Docker, nginx, Vercel, Cloudflare doc) and CI workflow

**Verdict:** This is a genuinely well-engineered system — server-authoritative payments,
transaction + row-lock stock handling, JWT rotation + blacklisting, magic-number upload
validation, role-based access, rate limiting, Swagger, audit logs. But the review found
**3 critical issues that make the published site broken or exposed today**, plus a clear
roadmap for the 1000× experience upgrade.

---

## 1. CRITICAL — broken right now (P0)

### P0-1 · Every sale fails with a 500 — the POS cannot sell anything
**Evidence:** `POST /api/v1/sales` (and `/sales/pending`) always returns
`500 Internal server error` for *any* payload, valid or not. Server log:

```
Error: Invalid reference exceeds the schema root: ref:discountValue
    at /home/user/Portforlio/src/middleware/validate.js:6:37
POST /api/v1/sales 500
```

**Root cause:** in `src/validators/index.js` (`createSale`), the item-level
`.when('discountValue', …)` (≈line 205) is chained onto `Joi.array().items(…)` — i.e. onto
the **array** schema — instead of onto the item **object**. Joi cannot resolve the ref from
there and throws a non-validation error that the error handler turns into a generic 500.
The same pattern should be audited across all item-array validators.

**Why tests didn't catch it:** the 431 passing tests call `saleService.create()` directly
(service layer) — nothing exercises the Express route + Joi validator path.

**Fix:**
1. Move the `.when()` inside the item object in `createSale`; audit `createPurchase` and
   every other `items:` array validator the same way.
2. Add **route-level integration tests** (supertest-style via the test app):
   - create sale (no discount) → 201, stock decremented
   - create sale (item % discount) → 201, correct totals
   - create pending sale → 201
   - invalid payload → 422 with field errors
3. Hardening: `validate.js` should catch Joi internal exceptions and return a clean 400
   instead of leaking a 500 (defence in depth).

### P0-2 · App won't start without `.env` — DB dialect default contradicts the docs
**Evidence:** fresh `npm start` (no `.env`) dies with `Unable to connect to the database`
because `src/config/database.js` uses `(process.env.DB_DIALECT || 'mysql')` → defaults to
**MySQL**, while `src/config/index.js`, `.env.example`, README ("SQLite is the default")
and all deploy configs assume **SQLite**.

**Fix:** unify the default to `sqlite` in `database.js` and `server.js` (`runAutoSetup`),
and make a misconfigured production startup fail with a *named* error
(`DB_DIALECT must be 'sqlite' or 'mysql'`).

### P0-3 · Anyone on the internet can register a POS cashier account
**Evidence:** `POST /api/v1/auth/register` (public) succeeded as a stranger and returned a
live JWT + `cashier` role. Once P0-1 is fixed, a stranger can log in, ring up sales,
decrement stock, and touch the POS. The 5 req/hour IP limiter does not meaningfully stop
this.

**Fix (default-secure, opt-in):**
- New setting/env `ALLOW_PUBLIC_REGISTRATION` (default **off** in production, on in dev)
- When off: endpoint returns 403, login page hides the register link, docs updated
- Keep the endpoint available behind an admin toggle in Settings so legitimate
  self-serve onboarding remains possible per store
- Also add: new accounts start in a `pending` state? (see open questions)

---

## 2. Security hardening (P1)

| # | Finding | Fix |
|---|---------|-----|
| S-1 | **Socket.io is unauthenticated** — `io.on('connection')` lets any visitor `join-delivery <id>` and receive rider GPS pings | Verify JWT in the socket handshake; require `admin/manager` (or the assigned rider) for `join-delivery`; drop unauthenticated sockets with 401 |
| S-2 | `render.yaml` + `Dockerfile` set `CORS_ORIGIN=*`, but the app's CORS callback never matches `*` (it compares exact origins) — the config is dead/misleading, and real cross-origin SSO deploys (Vercel frontends) would silently break | Make the server explicitly support `*` (with a loud warning + no-credentials), align Render/Docker/Cloudflare configs, and document the single-origin vs multi-origin modes |
| S-3 | Global API rate limit is **200 req / 15 min / IP** in production — a single busy terminal polling payment status (~1 req/3s) plus page loads can trip it and block a real cashier mid-shift | Raise the global ceiling (e.g. 2,000), keep tight limits on auth endpoints, and add a dedicated, higher limit for polling routes (`/payments/status`, notifications) |
| S-4 | `isTokenBlacklisted()` does a **DB query on every authenticated request** (perf + availability: on DB blip it fails closed → total lockout) | Add a small in-memory LRU with ~10s TTL for the blacklist check (blacklist inserts bypass cache); keep fail-closed on hard errors but log + surface in `/metrics` |
| S-5 | Test artifact PDFs committed under `uploads/documents/` (private-doc directory) | Untrack, add to `.gitignore`, keep only `.gitkeep` (history note: if these ever contained real resumes, rotate via `git filter-repo`) |
| S-6 | UTF-8 BOM at the start of `src/server.js` (encoding artifact) | Strip |
| S-7 | `app.set('trust proxy', 1)` unconditional — wrong on a bare VPS with no proxy | Gate on `NODE_ENV=production` + explicit env, or `trust proxy` = 1 only when behind a known proxy (document) |
| S-8 | Password policy: no strength rules beyond length; `changePassword` doesn't blacklist old sessions on other devices (it does set `passwordChangedAt` — good) | Add a minimum policy (length + not-email, reused-password check for last N) and surface it in the profile UI |

---

## 3. Public site & flow (P2) — this is what visitors see

### Current state (verified live)
- `/` → 302 → `/hrms/careers` (Job Portal)
- Job Portal loads from `GET /api/v1/public/jobs` → **0 jobs on a fresh database** (seeds
  include products/users but no job postings)
- So the published site's front door is an **empty list**

### Plan
1. **Seed realistic demo content** (idempotent): 4–6 job postings across departments
   (title, description, requirements, employment type, closing date, location)
2. **Proper landing page** (the biggest "1000×" visitor win):
   - Hero: store brand, one-line value prop, hours/location (driven by existing
     `Settings`), CTA buttons: *View open roles* / *Staff login*
   - Open-roles section reusing existing job cards
   - Company strip (about, contact, map of branches if coordinates exist)
   - Responsive, dark-mode aware, SEO meta (title/description/OG image), `robots.txt`
   - Designed empty state: "We're not hiring right now — check back soon" instead of a blank grid
3. **Login page polish** (HRMS is the single login): store branding, clearer error states,
   password visibility toggle (exists), remember-email, and a "forgot password" link that
   actually works end-to-end (requires SMTP; show "email sent" vs "dev token" gracefully)
4. **404 page** for the public site (designed, not a JSON string)

---

## 4. POS & HRMS usability (P3)

### POS (cashier speed = money)
- **Barcode-scanner-ready autofocus:** focus the search field on load and after each
  checkout; treat fast keystrokes ending in Enter as a scan → add directly (today a scan
  fills the search box but requires a second Enter + click)
- Enter on a single search result adds it to cart; show "F-keys" hint bar (F1 search / F4
  checkout / F8 clear already wired — make them discoverable)
- **Receipt printing:** thermal-friendly 80mm print layout (print CSS exists — make the
  receipt the first-class print target, with store header from Settings, GCash/Maya number
  already stored), plus auto-print option after checkout
- Hold/recall already works (localStorage) — add expiry + "hold reason"
- Touch/tablet: verify cart column collapse and 44px touch targets on small screens
- Payment screen: visible polling countdown while waiting for PayMongo confirmation, and a
  "cashier confirmed cash" override (admin/manager only) for the rare gateway drop
- Post-sale flow: print receipt → next sale (cart cleared, focus back to search) in ≤1 click

### HRMS (admin efficiency)
- **First-run onboarding checklist** for new admins: 1) set store details 2) add branch
  3) confirm products 4) publish first job — with links, persisted in Settings
- Consistent empty states + skeletons across all 25+ pages (audit; several pages render
  bare "No data" text)
- Global search exists in POS; bring a **⌘K command palette** to HRMS (search employees,
  products, sales, applicants)
- Role-aware nav is good; add a **"quick actions" bar** per role (e.g. HR: run payroll,
  approve leaves; cashier: POS, clock in)
- Dark mode: full audit — several inline styles bypass the theme variables
- Accessibility pass: focus trap in all modals, `aria-live` toasts, keyboard navigation in
  DataTable, contrast audit (indigo on light grey is close to AA in places)

---

## 5. Reliability & engineering (P4)

1. **Route-level integration test layer** (the gap that let P0-1 ship): parametrize the
   existing `tests/utils/api-client.ts` + `auth-helper.ts` infrastructure to hit real
   Express routes (auth, sales, purchases, payments, tracking, public jobs, HRMS payroll
   run, attendance clock-in). Target: every route has ≥1 happy + ≥1 authz test.
2. **Fix the flaky test** — `tests/unit/hrms/job.service.test.ts` "rejects past time for
   today" assumes the suite runs after 08:00 (it failed at 01:28). Use a mocked clock
   (vi.setSystemTime) for all time-dependent assertions across the suite.
3. **Migrations hygiene:** `server.js:runAutoSetup` carries ~40 inline
   `ALTER TABLE ADD COLUMN` "migrations" (plus MySQL ENUM rewrites) — fragile and opaque.
   Move to a versioned, idempotent migration runner (`migrations/002_…`, `003_…`) applied
   at boot, with a `schema_migrations` table; keep `001` as the initial schema. This also
   makes the MySQL path testable (CI already has a MySQL migration job — extend it).
4. **Extract cron jobs** from `server.js` into `src/jobs/` (low-stock, expiry, token
   cleanup, contract expiry, delivery sim?) with a single scheduler module; no-ops under
   `NODE_ENV=test`; log through the same logger.
5. **CI:** add the Playwright e2e job that exists locally (`playwright.config.ts` +
   `npm run test:e2e` are configured but not wired into `.github/workflows/ci.yml`):
   smoke = landing renders → admin login → product CRUD → **sale completes** → invoice
   prints → HR clock-in → payroll run. Also: `npm audit --omit=dev` gate + coverage ratchet.
6. **Ops docs:** refresh `README` quickstart (dialect default fix), collapse the stale
   `FIX_PROMPT.md` / `OPENCODE_REVIEW_PROMPT.md` / `FIX_TRACKING_PROMPT.md` scratch docs
   into `docs/AUDIT_LOG.md` so future reviewers aren't confused.

---

## 6. Performance (P5)

1. **No compression anywhere** — verified: no `compression` middleware, no `.gz`/`.br`
   static assets. The 393 KB main POS bundle ships at full size (~3× its gz size).
   → add `compression` + pre-compressed static files (vite plugin), keep existing
   immutable hashing. Biggest single-load-time win for the public site.
2. HTTP caching already correct (hashed assets `immutable,1y`, index.html `no-store`) — keep.
3. DB: indexes were explicitly back-filled at boot (good). Audit the dashboard/finance
   report queries for N+1s and raw-SQL SQLite/MySQL compatibility (already dual-dialect
   tested in CI — extend coverage to finance queries).
4. Product images: lazy-load + fixed dimensions (prevents CLS on the POS grid);
   consider an `sizes`/`srcset` pass once real photos replace the SVGs.
5. Response size of `GET /products` is fine; add `ETag`/`304` support to hot endpoints
   (products, jobs) via express default + `lastModified` where applicable.

---

## 7. What I will NOT do without your say-so (open questions)

1. **Public registration** — disable-by-default (my recommendation), keep-with-limiter,
   or remove entirely?
2. **Landing page direction** — (a) company+careers landing (my rec), (b) keep minimal
   job portal with a designed hero + empty state, (c) full marketing site (about, gallery,
   contact form)?
3. **Deployment target** — Render (per `render.yaml`) / Docker+nginx / Cloudflare (per
   the old deploy doc)? Affects which CORS/env alignment I finalize. (I'll keep all three
   working regardless.)
4. **Seed data in production** — ok to ship demo job postings + the existing 20 products
   on first deploy? (Needed so the landing page isn't empty.)

---

## 8. Execution order (each phase ends green + verified)

| Phase | Contents | Gate |
|-------|----------|------|
| **1. Stop the bleeding** | P0-1 sale validator + route tests · P0-2 dialect default · P0-3 registration gate · compression | `npm test` green incl. new route tests; live smoke: sale completes end-to-end |
| **2. Security** | S-1…S-8 | checklist verified against running server; socket authz tests |
| **3. Public site** | job seeding, landing page, login polish, 404 | Lighthouse pass on `/`; visual QA light+dark, mobile |
| **4. UX pass** | POS barcode/receipt/focus, HRMS onboarding + empty states + palette + a11y | per-role manual flows (admin/hr/manager/cashier/inventory/employee) |
| **5. Engineering** | integration suite, flaky-test fix, migration runner, jobs extraction, CI e2e + audit | CI fully green; e2e green on PR |
| **6. Polish** | perf items, docs cleanup | bundle sizes, coverage ratchet |

Estimated effort: Phases 1–2 are small surgical changes; 3–4 are the big experience
build-out; 5–6 keep the gains permanent.
