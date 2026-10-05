# Phase 1 Audit — MiniMart POS + HRMS

**Date:** 2026-10-05 · **Baseline:** commit `0f9d32d` · **Suite:** 470/470 passing · **Live server:** probed on port 5000

Method: static review of all 238 API routes (auth/role matrix), service-layer transaction & money-math review, deploy-config review, live API probes, server-log review, lint run, and structural frontend checks. No code changes (audit-only phase).

## Summary

| Rank | Count | Theme |
|------|-------|-------|
| **P0** | 2 | Production would ship seeded weak credentials; all data lost on every deploy |
| **P1** | 9 | Core-flow gaps (refund/shifts/split), seed/config/tooling hazards, public-apply surface |
| **P2** | 8 | UI polish (theme leaks, role menus), no E2E, README drift, lint warnings |
| **P3** | 6 | Hygiene: stray files, lint coverage gap, seed typo, log noise, docs |

---

## P0 — Critical (blocks any production launch)

### S1. Production deploys auto-create default accounts with weak passwords
- **Where:** `render.yaml` (`AUTO_SETUP=true`, `NODE_ENV=production`), `Dockerfile:46-48` (same pair), `src/server.js:638` (`shouldAutoSetup`), `src/server.js:232-259` (seed users).
- **Evidence:** `shouldAutoSetup` is true when `NODE_ENV === 'development' || process.env.AUTO_SETUP === 'true'`. Both deploy configs set `NODE_ENV=production` **and** `AUTO_SETUP=true`, so every fresh Render instance runs the full seed, creating `admin@minimart.com / admin123`, `hr@minimart.com / hr123`, `manager@minimart.com / admin123`, `cashier@minimart.com / cashier123`, `ligma1@gmail.com / employee123`, `inventory@minimart.com / inventory123`.
- **Impact:** anyone who discovers the URL owns the tenant (full admin). Passwords are bcrypt-hashed in the model (verified: `$2a$10$…` stored), so the leak is the *chosen* weak value, not storage.
- **Fix (Phase 3):** seed demo users only when `NODE_ENV !== 'production'` unless an explicit `SEED_DEMO_ACCOUNTS=true`; in prod, create a single first-run admin with a random password printed to logs exactly once, and force first-login change.

### S2. Ephemeral SQLite on Render — total data loss every deploy/restart
- **Where:** `render.yaml` (`DB_DIALECT=sqlite`, `DB_STORAGE=./database.sqlite`), `data/settings.json` (file-based settings), `uploads/` (product images, resumes).
- **Evidence:** Render's app filesystem is non-persistent and instances sleep after ~15 min idle; every deploy rebuilds from git. The database, runtime settings, and user uploads all live on that filesystem.
- **Impact:** all sales, HRMS records, uploads, and settings vanish on the next deploy or scale-to-zero + redeploy.
- **Fix (Phase 3):** attach a Render persistent disk (or switch `DB_DIALECT` to `mysql` — the config already supports it) and point `DB_STORAGE`, `data/`, and `uploads/` at the persistent path.

---

## P1 — High

### A1. No refund or void endpoints (POS flow is irreversible)
- **Where:** `src/routes/sale.js` — `status` supports `completed|cancelled|refunded` but only `create`, `pending`, `cancel` (pending), `cash-complete` exist. No `refund`/`void`.
- **Impact:** a wrong sale cannot be corrected through the app; only raw DB editing. Blocks a real store's daily operation.
- **Fix (Phase 4):** `POST /sales/:id/refund` (full/partial, restocks stock in a transaction, writes ledger entries, role: admin/manager) and a cashier-visible "void last sale" window.

### A2. Split payments not supported end-to-end
- **Where:** `Sale.hasMany(Payment)` exists (`src/models/Sale.js:124`), but `sale.service.createSale` creates exactly one payment; the POS UI offers no split flow.
- **Impact:** cash+GCash/Maya split (a normal PH retail case) requires two sales or a manual adjustment.
- **Fix (Phase 4):** accept `payments[]` in create payload; allocate in order, mark overpay change, list all payments on the receipt.

### A3. No cashier shift model (no drawer reconciliation)
- **Where:** no shift routes in `src/routes/`; `src/models` has no Shift.
- **Impact:** can't open/close a drawer, count cash, or explain cash discrepancies per cashier/shift.
- **Fix (Phase 4):** Shift (cashier, branch, openedAt, closedAt, expectedCash, countedCash) + open/close endpoints + POS integration.

### A4. Job applications accept authenticated POS users as applicants
- **Where:** `src/routes/hrms/publicJob.routes.js:7-15` — `protect` only; resume upload is public with signature validation (good) and a 5/hr limiter.
- **Impact:** a cashier (role 5) can apply to their own employer's postings and attach a resume; the applicant pipeline is pollutable by any internal account.
- **Fix (Phase 3/4):** restrict apply to `employee` role + external (unauthenticated portal applicants already flow through the public route — verify intent), or add a job-applicant-only flag.

### A5. `npm test` runs the unit suite twice
- **Where:** `package.json` — `"test": "npm run test:unit && npm run test:integration"` and `"test:integration": "vitest run tests/integration tests/unit"`.
- **Impact:** ~470 unit tests execute twice per full run (time + duplicate flake surface); CI (Phase 6) inherits it.
- **Fix (Phase 2):** `test:integration: vitest run tests/integration`.

### A6. Seed/config/tooling hazards
- **6a. Tracked runtime file `data/settings.json`:** dev settings (demo GCash/Maya numbers) are committed *and* the app rewrites the same file at runtime — production settings reset on every deploy (see S2). **Fix (Phase 3):** repo file becomes `data/settings.dev.json` defaults; runtime store in DB or persistent volume.
- **6b. No forced first-login password change** exists for seeded accounts (no `mustChangePassword` field) — compounds S1 if seeding stays in prod. **Fix (Phase 3).**
- **6c. SMTP unconfigured → portal emails silently dropped** (`[MAILER]` warns; password reset, payslip, contract, applicant-status emails all no-op in prod). **Fix (Phase 3):** require `SMTP_*` in prod env (fail fast) or an explicit `EMAIL_DISABLED=true` flag.

### A7. Stray root files + tracked prompt artifacts + conflicting deploy configs
- **Untracked working-tree strays:** `commit_msg.txt`, `create_product.json`, `create_sale.json`, `create_supplier.json`, `update_product.json`, `login.json`, `fix_users.sql`, `query_users.sql`, `seed.sql`, `test_login_roles.ps1`, `start-dev.bat`.
- **Tracked docs that are dev-process artifacts:** `FIX_PROMPT.md` (17 KB), `FIX_TRACKING_PROMPT.md` (15 KB), `OPENCODE_REVIEW_PROMPT.md` (24 KB), `CLOUDFLARE_DEPLOY.md` (conflicts with Render target).
- **Conflicting deploy configs:** `render.yaml` (active target) vs `vercel.json` + `.vercelignore` (Vercel) + `nginx.conf` (nginx) + `docker-compose.yml` (local).
- **Fix (Phase 3):** delete strays (log in PROGRESS.md destructive-ops table), remove/consolidate docs, keep `render.yaml` + `Dockerfile` + local `docker-compose.yml` only.

### A8. Duplicate ESLint configurations
- **Where:** `.eslintrc.js` (legacy eslintrc; **inert** under ESLint 10 — flat config wins) and `eslint.config.mjs` (active). Rules can silently diverge; `.eslintrc.js` also targets a `jest` env while the project uses vitest.
- **Fix (Phase 2):** delete `.eslintrc.js`; keep flat config.

### A9. `completePendingAsCash` omits sale items (carried over, still unfixed)
- **Where:** `src/services/sale.service.js` `completePendingAsCash` — final `Sale.findByPk` lacks `{ include: [{ association: 'items' }] }`.
- **Impact:** the cash-override receipt renders "No items" — the receipt for a real completed sale is wrong.
- **Fix (Phase 2):** add the include; regression test exists for the 200 contract only (extends it).

---

## P2 — Medium

### B1. 49 lint warnings (all `no-unused-vars`)
- **Where:** `npx eslint "src/**/*.js"` — 0 errors, 49 warnings across ~35 files (e.g., `src/controllers/*.js` destructured request fields, `next` params, imported-but-unused models).
- **Fix (Phase 2):** clean all; add `--max-warnings 0` to the lint script.

### B2. 44 inline hex/rgba colors bypass the dark theme (POS app)
- **Where:** `frontend/src/pages/*.jsx` (charts hard-code colors + a few text/background hex values).
- **Impact:** chart/text colors don't follow light/dark toggle; minor contrast risks in one theme.
- **Fix (Phase 5):** move to design tokens (`--chart-*`, `--pos-*` CSS vars).

### B3. Role-based menus incomplete
- **Where:** POS sidebar is role-filtered; HRMS nav renders the full link set for all roles (plan Phase 4 item).
- **Fix (Phase 4/5):** drive both navs from the same permission data the API already exposes.

### B4. No E2E tests exist
- **Where:** `playwright.config.ts` + `test:e2e` script present, **zero spec files**.
- **Fix (Phase 6):** per-role E2E suites (login → key flow) as planned.

### B5. README drift
- **Where:** `README.md` lists roles as "(Admin, Manager, Cashier)" — the system has 6+ roles; API table omits HRMS, public jobs, payments, tracking, and analytics endpoints; setup section not re-verified against current scripts.
- **Fix (Phase 6):** rewrite from live route matrix.

### B6. Dashboard & export reconciliation pass
- **Verified consistent so far:** dashboard totals filter `status: 'completed'` (sales, payouts, loyalty) — no pending inflating revenue.
- **Open (Phase 4 gate):** full number-by-number comparison of each dashboard widget and each CSV export (employees, attendance, payrolls, suppliers) against raw tables.

### B7. Frontend not linted at all
- **Where:** `npm run lint` = `eslint "src/**/*.js"` (API only); `frontend/` and `frontend-hrms/` have no ESLint config.
- **Fix (Phase 6):** add flat ESLint (react-hooks + jsx-a11y) to both apps.

### B8. Cash override / pending cash-complete UX
- **Contract verified OK** (201 with items+payments after fix A9; 409 paid/cancelled; 403 cashier), but the POS UI path for the "cashier couldn't take card" flow is admin/manager-only by design — document it.
- **Fix (Phase 4):** confirm UX copy + manual-cash guidance.

---

## P3 — Low

### C1. Seed data mojibake
- **Where:** `src/server.js:252` — `'Dela PeÃ±a'` (double-encoded UTF-8).
- **Fix (Phase 2):** correct the string + one-off `UPDATE` (logged).

### C2. Auth failures logged with full stack traces
- **Where:** `src/middleware/errorHandler.js` logs every 401/403 via `console.error(err.stack)`.
- **Impact:** production log noise, no security signal (no rate-limit-aware alerting).
- **Fix (Phase 2):** warn-level one-liner for expected ApiErrors, stack only for 5xx.

### C3. `/api-docs` publicly reachable in dev
- **Where:** `src/server.js:265-268` (dev-only guard verified). Fine for local dev; keep admin-only in prod (already the case).
- **Fix (Phase 3):** no change; document.

### C4. `start-dev.bat` (Windows-only helper) in a repo that documents `npm start`
- **Fix (Phase 3):** delete (log) or move to `docs/`.

### C5. Two legacy prompt docs reference finished P0–P3 work
- **Where:** `IMPROVEMENT_PLAN.md` (superseded by `PLAN.md`), plus A7's prompt files.
- **Fix (Phase 3):** mark superseded / archive to `docs/`.

### C6. Vitest config `environment: 'node'` for frontend components? — N/A
- Verified: frontend has no component tests (no jsdom env configured); only API-side unit tests. Not a defect, recorded so Phase 6 plans for it.

---

## Verified clean (do NOT re-report in later phases)

| Area | Result |
|------|--------|
| Rate limiting | Present: global 2000/15min, `/auth/*` 20/15min, `/public/jobs/applications` 5/hr, payment webhook excluded by design (signature-verified) |
| JWT enforcement | `JWT_SECRET` mandatory in prod (placeholder detection, `config/index.js:35-57`); refresh rotation with reuse detection |
| CORS | Origin-allowlist driven by `FRONTEND_URL`/`HRMS_FRONTEND_URL`, not `*` |
| Uploads | 5 MB (products), 10 MB (documents), 10 MB (resumes) + magic-number signature validation; `/uploads/products` static route blocks private segments (404 verified live) |
| Route authz matrix | All 238 routes reviewed: no unprotected mutations; public endpoints = auth (throttled), payment webhook (PayMongo signature), public jobs/settings/portal (read-only + rate-limited apply) |
| Clock-in IDOR | Controller overrides `employeeId` from `req.user.email` — self-only, verified in code |
| Money math | `calculateTax`/`calculateDiscount`/`calculateServiceCharge` all rounded (2dp) + clamped; tax/discount service charges re-verified in unit tests |
| DB transactions | Sale (4 txn paths incl. split into pending/complete/cash-complete), inventory (5: move, receive, return, low-stock, adjustment), purchase (3: order, receive, installment), payroll (3: generate, process, payslip), expense (3), attendance (4: import, overtime, correction, request), employee (8 incl. onboarding/contract/promotion), petty cash (2) |
| Raw SQL | `finance.service.js` all parameterized (`replacements`); interpolated values are server-side constants only |
| Token refresh (frontend) | Both `frontend` and `frontend-hrms` API clients: single-flight refresh, queue, 401 logout — correct |
| Modal a11y | Focus trap + Escape + focus restore in both apps' `Modal.jsx` |
| Toast a11y | `aria-live="polite"` on POS toast container |
| DataTable a11y | Keyboard operation + ARIA on both apps' DataTables (P3 fix, regression-tested) |
| Password storage | bcrypt via model hooks (verified live: `$2a$10$` in DB) |
| Live server health | `/health` 200; log review shows zero unexpected 5xx; only expected 401/403/422 from auth probes + intentional 503 (PayMongo unconfigured) |
| Empty-data crash guards | No unguarded `[0]` access in page code (POS auto-add is inside a `products.length === 1` guard) |
| postMessage security | HRMS `PosEmbed` validates `event.origin` against the POS origin before acting |

## Phase mapping

| Phase | Picks up |
|-------|----------|
| **2 — Fix all errors** | A5 (test script), A8 (eslint dedupe), A9 (cash-complete items), B1 (49 warnings), C1 (mojibake), C2 (log noise) |
| **3 — Security & deploy** | S1 (no prod seed), S2 (persistent DB/uploads/settings), A4 (apply surface), A6 (settings.json, SMTP, first-login), A7 (strays/conflicting configs), C3–C5 (docs) |
| **4 — Logic & flows** | A1 (refunds/voids), A2 (split payments), A3 (shifts), B3 (role menus), B6 (dashboard/export reconciliation), B8 (cash UX) |
| **5 — UI/UX** | B2 (44 inline colors → tokens), B3 (nav), full responsive + states pass |
| **6 — Tests & CI** | B4 (Playwright specs), B7 (frontend lint), B5 (README rewrite), CI workflow |

## Limitations

- No browser available in this sandbox → console errors were assessed **structurally** (API error handling, guards, a11y attributes) rather than by execution; Phase 6's Playwright run is the real console-error gate.
- Dashboard B6 is a *reconciliation pass* (full), not a spot check — scheduled as a Phase 4 gate per PLAN.md.
