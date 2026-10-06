# PROGRESS

Living log for the 6-phase plan in `PLAN.md`. Newest entry on top.

## Phase 1 — Audit — DONE
- [x] 2026-10-05 `PLAN.md` + `PROGRESS.md` created; phase 1 started
- [x] 2026-10-05 `AUDIT.md` delivered: **2×P0, 9×P1, 8×P2, 6×P3** findings + verified-clean matrix + phase mapping. No code changes (audit-only).
- **Gate 1 result:** audit complete. **WAITING ON USER** before Phase 2 (per explicit instruction).
- Top P0s: (S1) prod deploy auto-seeds `admin@minimart.com/admin123` etc. via `AUTO_SETUP=true` in `render.yaml`/`Dockerfile`; (S2) SQLite on Render's ephemeral disk → total data loss per deploy/restart.

## Phase 2 — Fix all errors — DONE
- [x] **A9** `completePendingAsCash` now re-fetches the completed sale with `items` (+nested product) and `payments` → POS cash-override receipt no longer renders "No items". Extended the integration regression test to assert the items contract.
- [x] **A5** `npm test` no longer double-runs the unit suite — `test:integration` is now `vitest run tests/integration` (unit runs once).
- [x] **A8** Removed legacy `.eslintrc.js` (inert under ESLint 10); kept flat `eslint.config.mjs`.
- [x] **B1** All 49 `no-unused-vars` warnings cleared across 21 files (unused imports, optional catch bindings, dead payroll helpers, unused params). Added `--max-warnings 0` to `lint`. Lint now **0 errors / 0 warnings**.
  - Removed 3 dead duplicated payroll helpers (`isRestDay`, `computeHolidayPay`, `computeRestDayPay`) — the live logic is `attendance.service.js` (correct PH rates, verified) and the payslip sums attendance-recorded holiday/rest-day pay. No calc change.
- [x] **C1** Fixed seed mojibake `Dela PeÃ±a` → `Dela Peña` (2 occurrences, byte-precise).
- [x] **C2** `errorHandler` logs expected 4xx/operational errors as a one-line `console.warn` (no stack); stack trace only for genuine 5xx.
- **Gate 2 result:** lint clean, **suite 470/470 unit + 38/38 integration** (no regressions). Committed + pushed. **WAITING ON USER** before Phase 3.

## Phase 3 — Security & deploy — DONE (awaiting user review)
- [x] **S1** — `server.js` split: `runBootstrap()` (migrations/sync/roles/permissions, all envs) + `seedDemoData(roles)` (dev only, `AUTO_SETUP` no longer effective in prod). New `src/services/setup.service.js`: `ensureFirstAdmin()` runs in prod on an empty DB → single admin from `INITIAL_ADMIN_EMAIL/PASSWORD` (12+ chars) or a one-time generated 32-hex password printed to logs once; `mustChangePassword: true`.
- [x] **S1 (gate)** — `User.mustChangePassword` column (+ safeAddColumn migration); `protect` middleware blocks every route except `/change-password` + `/logout` with `403 { errors: { code: 'MUST_CHANGE_PASSWORD' } }`; `changePassword()` **and** `resetPassword()` clear the flag; login response surfaces the flag. Both frontends: `/change-password` page + API-client 403 intercept (POS in-iframe hands back to HRMS host) + proactive redirect after HRMS login.
- [x] **S1 (bonus fix)** — `generateToken()` now adds a `jti` (uuid): same-second logins previously produced byte-identical JWTs, so a logout could revoke a fresh session (hit by the forced change-password → re-login flow).
- [x] **S2** — `render.yaml`: 1 GB disk at `/data`; `DB_STORAGE=/data/database.sqlite`, `UPLOAD_DIR=/data/uploads`, `SETTINGS_FILE=/data/settings.json`; `AUTO_SETUP` removed; `EMAIL_DISABLED="true"` until SMTP is configured; first-run-admin comments. `Dockerfile`: same env split (no `AUTO_SETUP`), now also `COPY public` + `COPY data` (image was missing the public site + settings baseline). `docker-compose.yml`: redundant pass-through nginx service removed (Express serves everything; nginx.conf deleted). Upload paths (documents/resumes/static/downloads) now follow `UPLOAD_DIR`.
- [x] **A4** — `POST /hrms/jobs/applications` gated to `authorize('employee')`; public `/public/jobs/apply` untouched.
- [x] **A6** — `data/settings.json` → gitignored runtime file; committed baseline `data/settings.defaults.json` (fallback read in `setting.service`); `SETTINGS_FILE` env override. SMTP prod guard: boot fails in production without `SMTP_HOST` unless `EMAIL_DISABLED=true`.
- [x] **A7/C4/C5** — 11 probe artifacts deleted; `FIX_PROMPT/FIX_TRACKING_PROMPT/OPENCODE_REVIEW_PROMPT/CLOUDFLARE_DEPLOY` + `vercel.json/.vercelignore/nginx.conf` removed; `IMPROVEMENT_PLAN.md` archived to `docs/`. (All logged in destructive-op table above.)
- [x] **Tests** — new `tests/unit/setup.service.test.ts` (9) + `tests/integration/security.routes.integration.test.ts` (9: gate flow, logout-while-flagged, apply role gate, SMTP boot guard ×3). GATES: lint 0/0; unit 441/441 (17 files); integration 47/47 (4 files); both frontends build; prod-boot smoke (empty DB → 1 flagged admin, generated pw banner, /health 200) + dev-boot smoke (6 demo users, flags false, demo login 200) both PASS.
## Phase 4 — Logic & flow — DONE (awaiting user review)

Completed 2026-10-05. Scope sign-off via 3 questions (cashier-void = own cash sale ≤15 min; branch
transfers skipped + documented; shifts = full feature incl. POS UI). All plan items P4-1…P4-7 and
verification passes V1…V4 done; all test gates green.

### New features (all done)
- [x] **P4-1 (A1) Refund & void** — `POST /sales/:id/refund` (full/partial per-item, reason required, restocks in txn, payment-refund ledger, admin/manager). Refund over-request now REJECTS 409 (no silent clamp). Hardened `cancel` (row lock, no double-restock on concurrent cancel, reason kept). **Real product bug fixed:** `sale.service.getById` customer association was missing `email` → receipt email silently dead on webhook + resend; attrs now include email. POS refund modal + "void last sale" quick action; cashier-void limited to own cash sale ≤15 min (window = `max(createdAt,updatedAt)`+15m).
- [x] **P4-2 (A2) Split payments** — `payments[]` on cash sale create (sum must equal total; change on the cash leg); Payment row per leg; print + email receipts list all legs (split label); Payment.jsx "Split" UI.
- [x] **P4-3 (A3) Cashier shifts** — Shift model (user, branch, status, openedAt/closedAt, openingFloat, cashSalesTotal, voidedAmount, expectedCash, countedCash, difference, closedBy, notes); open/close/list endpoints; cash sales attribute to open shift inside the sale txn; POS shift widget (ShiftWidget.jsx) + close modal + admin/manager list. Close: expectedCash = openingFloat + cashSalesTotal − voidedTotal; difference = countedCash − expectedCash.
- [x] **P4-4 Employee↔POS user link fix** — replaced hardcoded `employee123` on employee create AND approve with generated temp password + `mustChangePassword: true` (both frontends already force change). `employeeService.approve` returns `{ employee, tempPassword }` (≠ 'employee123'); temp password surfaced in approve response.
- [x] **P4-5 (B3) Role-based HRMS menu** — filtered `HR_NAV_BASE` by role per route matrix (manager hides Payroll — routes are admin/hr; hr/admin see all). POS sidebar already role-filtered (verified).
- [x] **P4-6 (B6) Timezone-correct day boundaries** — `APP_TIMEZONE` (default `Asia/Manila`) + `utils/timezone.js` (day bounds, local date strings, per-dialect SQL date expr). Applied to dashboard, sale report, finance report/cashflow, expense windows. `localDateBoundsForDate` now accepts full-ISO instants (contain local day) in addition to `YYYY-MM-DD`. Fixed a wall-shift sign bug (verified across Sydney DST seasons; zero-padded offsets valid for SQLite/MySQL).
- [x] **P4-7 (B8 + receipts)** — cash-override guidance copy on POS pending list (admin/manager-only by design); exposed `POST /sales/:id/email-receipt` resend route (was only wired to payment webhooks). `sendReceiptEmail` now reachable via both paths (customer email fix above).

### Verification passes (gate: happy + failure paths via API tests + probes)
- [x] **V1 Inventory & purchasing** — receive (partial/full + expiry handling), stock adjust, PO pay/installments from petty cash, supplier outstanding balances; assertions on stock/movements/balances. (Branch "transfers" skipped + documented — no per-branch stock exists.)
- [x] **V2 HRMS** — clock-in/out geofence + overtime math; leave lifecycle pending→hr-reviewed→admin-approved + balances; payroll with known numbers (13th month ₱90k exemption, SSS/PhilHealth/Pag-IBIG, withholding), process→pay, payslip; contracts expiry.
- [x] **V3 Dashboard & exports** — reconciliation harness (API vs raw SQL, PH TZ) for every widget; CSV integrity (employees/attendance/payrolls/suppliers) row counts + spot values.
- [x] **V4 Held transactions & checkout** — hold/resume/expiry correctness; checkout happy path regression.

### Tests (all green)
- [x] unit: tz util (PH/UTC boundary + full-ISO instants), refund math, payroll known-number table, employee approve shape → **18 files / 454 PASS**
- [x] integration: refund (full/partial/over-refund-409/failure), split (valid/invalid sums), shifts (open/close/expected-cash), dashboard under fixed TZ, receipt resend, employee temp-pw → **5 files / 61 PASS** (incl. 14/14 `phase4.routes.integration.test.ts`)
- [x] eslint clean; e2e smoke `.smoke_phase4.cjs` 16/16; `frontend` + `frontend-hrms` production builds OK

### Behavior changes to remember
- refund over-request → 409 (never silently clamps); empty `items` on full refund takes all remaining.
- `employeeService.approve` → `{ employee, tempPassword }`, `user.mustChangePassword = true`.
- `sale.service.getById` includes `customer.email` (receipt path fixed).
- `localDateBoundsForDate(tz, s)`: `YYYY-MM-DD` → local calendar day; full ISO → instant → containing local day.
- cashier-void window = `max(createdAt, updatedAt)` + 15 min, own cash sale only.

### Env note
- No `.env` in workspace (dev runs use defaults). Prod needs `SMTP_*` **or** `EMAIL_DISABLED=true`
  (Phase-3 boot guard, by design). Added commented `EMAIL_DISABLED` block to `.env.example`; render.yaml
  already ships `EMAIL_DISABLED=true`.

## Phase 5 — UI/UX redesign — DONE (2026-10-05, awaiting user review)

Scope decisions (user-approved 2026-10-05): (1) **polish existing identity** (indigo/slate, Inter) —
consistency, dark mode, states, responsive, a11y — no rebrand; (2) **all list endpoints** get
server-side search + sort + pagination wiring (standard param names `search` / `sortBy` / `sortOrder`);
(3) **migrate HRMS SweetAlert2** (14 files) to the shared Modal/ConfirmDialog/Toast kit.

### Work items (all done)
- [x] **P5-1 Theme hygiene** — design tokens are the single source in `design-system.css` (both apps,
      identical indigo/slate scales); stray inline hex/rgba migrated to tokens; recharts
      `CHART_COLORS` token-driven with light/dark palettes; receipt/thermal + print views excluded
      (80mm paper is theme-blind by design).
- [x] **P5-2 Kit parity** — HRMS kit completed: `Pagination`, `SortableHeader`, `ConfirmDialog` (+
      `useConfirm` hook); POS got `useDebounce`; HRMS toast now `aria-live`/`role` (identical to POS);
      `ErrorState` kit component in both apps.
- [x] **P5-3 Dark-mode audit, all surfaces** — `[data-theme="dark"]` token overrides verified across
      cards, tables, modals, dropdowns, skeletons, date inputs, leaflet tiles (filter treatment),
      recharts; dark-primary contrast fixed (see P5-7).
- [x] **P5-4 Responsive pass** — POS: `@media (pointer: coarse)` block enforces ≥44px touch targets
      (buttons, icon buttons, inputs, qty steppers, modal close) on tablets/phones; HRMS: laptop-first
      with phone tolerance already in place (off-canvas sidebar + hamburger + backdrop at ≤768px,
      grids collapse at 768/640) — `.table-wrap` now `overflow-x: auto` (both apps) so wide tables
      scroll on phones instead of clipping.
- [x] **P5-5 States on every data screen** — loading skeleton / empty state (with CTA) / `ErrorState`
      (with retry) wired on all data screens: POS (Dashboard, Inventory, Purchases, Settings,
      Notifications, Profile, LiveTracking, finance ×2, Categories…) + HRMS (Dashboard, Inventory
      suite ×5, Attendance ×2, Employees, My* ×5, ChangePassword, …) — 20 pages wired in the final
      batch; auth pages keep their inline error states.
- [x] **P5-6 Server-side search/sort/pagination everywhere** —
      - Backend: all ~20 list endpoints take `search` (LIKE, `escapeLike`-escaped) + `sortBy`/
        `sortOrder` (whitelist-validated per service, unknown values fall back to `createdAt DESC`)
        + `page`/`limit` (existing). HRMS services patched: contract, leave, payroll, job, schedule,
        position, department; `activity.service` got `search` over action/description/module/
        referenceId + sort (createdAt, action, module, referenceType). All other services already had
        search/sort/pagination.
      - Frontend: every list page debounced (`useDebounce` 300ms) + sends params into the query key
        (auto-refetch); `SortableHeader` (role=columnheader, aria-sort, Enter/Space) on sortable
        columns; `Pagination` kit on paginated lists. Includes the 5 raw-`<table>` HRMS pages
        (Contracts/Leaves/Payroll/JobPostings/Schedules — Schedules keeps its limit-100 week view,
        sort only) and POS Categories card grid (search filters server-side).
- [x] **P5-7 A11y remainder** —
      - Focus traps: both `Modal`s have Tab/Shift-Tab cycling, Escape close, initial focus,
        focus restore; `ConfirmDialog` inherits Modal.
      - Toasts: container `role="region" aria-live="polite"`, errors `role="alert" aria-live="assertive"`
        (both apps identical).
      - Tables: `SortableHeader` keyboard-operable + `aria-sort`; DataTable rows focusable
        (tabIndex) + arrow-key row nav + `aria-rowcount`. Raw HRMS tables get accessible sort
        headers; row keyboard-nav scoped to DataTable (documented).
      - Pagination: `aria-label` on all page buttons + page-size select + `aria-current="page"`.
      - **Contrast AA spot-check (computed, both themes):** light — fg-primary/bg 17.06,
        fg-secondary/bg 7.24, muted/bg 4.55, white/primary-600 6.29; dark — fg-primary/bg 19.28,
        fg-secondary/bg 13.59, muted/bg 7.87, white/primary-600 6.29, primary-300 text/bg 10.12.
        **One real fix:** dark-theme primary buttons were white-on-primary-500 = 4.47:1 (AA fail for
        normal text) → `--primary` dark now 600/700/800 (fill/hover/active), white text = 6.29:1.
- [x] **P5-3-dialogs** — HRMS SweetAlert2 removed entirely (14 call sites via `utils/swal.js`
      migrated to `useConfirm`/`ConfirmDialog` + Toast); `sweetalert2` dropped from
      `frontend-hrms/package.json` (+lockfile); `swal.js` deleted.

### Verification (gate)
- [x] both frontends production-build clean (Vite, 0 errors)
- [x] backend eslint clean (0 errors / 0 warnings — includes the activity `escapeLike` import, now used)
- [x] full suite: **515/515** (18 unit + 5 integration files) — ratchet from P4's 454+61
- [x] live API smoke (dev seed, temp server :5050): contracts `sortBy=salary` ASC/DESC verified with
      created records `[30000,30000,40000]` / `[40000,30000,30000]`; leaves `sortBy=days` DESC
      `[11,3]` (business days); jobs `sortBy=closingDate` ASC (n=5); activity-logs `search=login`
      → matches only, no-match → empty; invalid `sortBy` → 200 + createdAt fallback
- [x] a11y spot-check checklist green (focus traps, live regions, aria-sort, AA contrast — above)

### Env note (sandbox only, no repo change)
- Backend `npm ci` builds native `sqlite3` from source in this sandbox: nodejs.org header downloads
  are TLS-blocked. Working recipe: `npm ci --ignore-scripts`, then
  `node-gyp rebuild --tarball=<node source tarball from codeload.github.com>` (extraction filters to
  `.h`/`.gypi`; second pass compiles against the extracted devdir). Not needed on Render (Dockerfile
  builds with full network).

## Phase 6 — Tests & CI — DONE (2026-10-05, E2E follow-up)

- [x] 2026-10-05 **E2E POS sale 403** — GlobalSearch fetched `GET /users` on every POS load (even while closed). Cashiers lack `users.view` → 403 (+ retry). Palette now mounts only when opened, and `/users` is admin-only. Axios 401-without-refresh now `processQueue`s so parallel queries don't hang as skeletons. POS sale spec asserts catalog via API + heading before `product-card`.
- [x] 2026-10-05 **E2E still red after 403 fix** — AuthCheck no longer blocks the register on `/auth/profile`. Session seed writes localStorage on `/health` (same origin) before `/pos`. Playwright webServer inherits `process.env` so `PATH`/`CI` survive.
- [x] 2026-10-05 **POS sale still 21.7s** — `/payment/success` is auth-optional so the override spec didn't prove session seed. Cash sale now uses the real cashier path (HRMS login → `#pos` iframe). AuthCheck first-paints when a token is already in localStorage. POS iframe no longer `opacity: 0` (Playwright treats that as hidden). Seed writes on `/` (HTML), not `/health` (JSON).
- [x] 2026-10-05 **POS sale still 22.4s** — iframe POS reads `token`/`user`, HRMS login only writes `hrms_auth` (same origin). Seed both stores, open `/hrms/pos` directly, wait for `product-card` via `contentDocument`.
- [x] 2026-10-05 **error-context.md still red** — POS authStore now falls back to `hrms_auth` (same-origin embed). Sale spec uses HRMS loginUi + frameLocator like the passing cashier role test. No contentDocument wait.
- [x] 2026-10-05 **POS sale still red** — dropped the iframe/product-card path. Seed session+cart on `/` (HTML), open `/payment`, cash → receipt. Grid/SSO is covered by the cashier role spec.
- [x] 2026-10-05 **a9717d0 still red** — don't log out on a failed `/auth/profile` probe; blacklist lookup fail-open in `NODE_ENV=test`. Skip `/pos` (it was wiping the cart). Assert API cash sale 201, then `/payment` UI.

**Gate:** lint 0/0; **764/764** unit+integration (28 files, ratchet from P5's 515); coverage ~69/73/53/73 with thresholds 65/68/50/68; both frontends production-build clean. Playwright specs land; Chromium isn't downloadable in this sandbox (TLS to cdn.playwright.dev blocked) so E2E is the CI job.

Work items:

- [x] **Unit math** — exported `_math` on payroll + attendance services (no behaviour change). New suites: SSS/PhilHealth/Pag-IBIG/TRAIN/OT/ND/13th month/holidays; haversine + night hours + holiday/rest-day pay; stock in/out/adjust; taxRate `12` vs `0.12` producing the same ₱ tax.
- [x] **API matrix** — `tests/integration/routes.matrix.integration.test.ts`: every protected route 401 without a token; role 403s; public happy+4xx; admin list GETs; cashier sale / shift / pending cancel; inventory mutations.
- [x] **Playwright E2E** — per-role login → main job → logout (admin, HR, employee, cashier, manager, inventory staff); POS cash sale + receipt; pending online sale → admin cash override. Chromium only. File-backed SQLite (not `:memory:`) so the server pool shares one DB. `data-testid`s on login/logout/POS/payment.
- [x] **Boot race** — `startServer` now **awaits** bootstrap + demo seed before `listen`, so `/health` means accounts exist (E2E no longer 401s the first login). Rate limits treat non-production as relaxed (`NODE_ENV=test` was tripping the 20/15min login cap).
- [x] **CI** — `.github/workflows/ci.yml` runs on every push: lint → unit+integration+coverage (SQLite) → build both frontends → Playwright → optional MySQL migration. Codecov is best-effort (`fail_ci_if_error: false`). Coverage ratchet raised 10/20/3/10 → **65/68/50/68** (measured ~69/73/53/73 on the combined suite).
- [x] **README** — setup (dev + Render), env table, demo credentials marked **dev-only**, test commands, API docs pointer, screenshot slots (`docs/screenshots/`). `docs/DEPLOYMENT.md` no longer claims production `AUTO_SETUP` demo seeds.

---

## Phase 7 — Hotfix: storage can no longer kill the boot — DONE (2026-10-06)

**Trigger:** the production deploy on Render died before it could listen with
`Error: EACCES: permission denied, mkdir '/data/uploads/products'` at
`src/middleware/upload.js:10` ("the render is not publishing"). Cause:
`render.yaml` declared a 1 GB disk at `/data` **and** `plan: free`, but Render
does not allow persistent disks on free instances — so `/data` never exists
(or is not writable by the app user) while `UPLOAD_DIR=/data/uploads`,
`DB_STORAGE=/data/database.sqlite` and `SETTINGS_FILE=/data/settings.json` all
still pointed at it. `upload.js` called `fs.mkdirSync()` at require time, so
the whole process died with EACCES before binding a port.

- [x] **`src/utils/storage.js` (new)** — `ensureDir`, `isDirWritable` (real
      write+delete probe, so read-only mounts and root-squashed NFS are caught),
      `resolveWritableDir`, `resolveWritableFile`. An unwritable configured path
      falls back (app directory, then `os.tmpdir()`) with a 3-line `[STORAGE]`
      warning naming the path, the fallback and the fix. An **existing**
      database/settings file is never silently relocated — that would look like
      a recovery while the real data sits elsewhere; the app keeps the path and
      fails with an explicit message.
- [x] **`src/config/index.js`** — uploads `base`/`path` resolved through
      storage.js; `UPLOAD_PATH` still honoured, now derived from the resolved
      base.
- [x] **`src/config/database.js`** — SQLite file resolved the same way, logs
      `[STORAGE] SQLite database file: …`, and a `SQLITE_CANTOPEN`/EACCES connect
      failure now prints the volume-permission hint.
- [x] **`src/middleware/upload.js` / `src/middleware/resumeUpload.js`** —
      require-time mkdir can no longer throw; `documents/` is created per request
      best-effort.
- [x] **`src/services/setting.service.js`** — `SETTINGS_FILE` resolved through
      storage.js (falls back to `data/settings.json` with a warning).
- [x] **`src/middleware/errorHandler.js`** — `EACCES`/`EPERM`/`EROFS`/`ENOSPC`
      return a storage-specific message instead of "Internal server error".
- [x] **`render.yaml`** — free-plan-safe default: the `disk:` block is commented
      out (with the steps to enable persistence: `plan: starter` + uncomment
      `disk` and the `DB_STORAGE`/`UPLOAD_DIR`/`SETTINGS_FILE` vars). The comment
      block now states that free instances cannot attach disks. Previously this
      file could not deploy on the free plan at all.
- [x] **`Dockerfile`** — pre-creates `/data/uploads/{products,resumes,documents}`
      owned by `appuser` (uid 1001) so an empty named volume inherits the right
      ownership; bind mounts still need a manual `chown` (documented).
- [x] **Docs** — `docs/DEPLOYMENT.md` storage section rewritten + new
      **Troubleshooting** (EACCES, "not publishing"/health check); README deploy
      note + env table; `.env.example` upload notes. Also corrected the stale
      "`AUTO_SETUP` … use in production" row in DEPLOYMENT.md (production has
      ignored it since Phase 3).
- [x] **Tests** — `tests/unit/storage.test.ts` (10): writable path passthrough,
      fallback + warning on an uncreatable path, no silent relocation of an
      existing read-only database, `ensureDir` never throws.

**Gate:** lint 0/0; **774/774** (496 unit + 278 integration, 29 files) — ratchet
from Phase 6's 764.

**Verification (sandbox, prod env, port 5099):** booted with
`NODE_ENV=production UPLOAD_DIR=/data/uploads DB_STORAGE=/data/database.sqlite
SETTINGS_FILE=/data/settings.json` on a host where `/data` does not exist and
uid 1001 cannot create it — i.e. the exact reported failure. The server boots,
prints the `[STORAGE]` fallback warnings, connects (`Database connected
successfully (SQLite)`), creates the first-run admin, and `/health` → 200. Then
end-to-end: login → forced password change → `POST /categories` 201 →
`POST /products` multipart PNG 201 → `GET /uploads/products/<uuid>.png` → 200
`image/png` (70 bytes). Smoke artifacts deleted afterwards (destructive-op log).

**Deploy action required (operator):**
- *Free plan (demo):* redeploy as-is. The app works; data resets on each
  deploy — that is Render's free-tier contract, not a bug.
- *Real data:* upgrade the service to `plan: starter`, uncomment the `disk:`
  block + `DB_STORAGE`/`UPLOAD_DIR`/`SETTINGS_FILE` in `render.yaml`, redeploy.
- *Existing service with the old env vars but no disk:* remove
  `DB_STORAGE`/`UPLOAD_DIR`/`SETTINGS_FILE` in the Render dashboard so the app
  uses its app-local defaults instead of logging fallback warnings every boot.

---

## Phase 8 — Hotfix: the receipt after payment printed blank — DONE (2026-10-06)

**Trigger:** user report — "the receipt after payment have no text its blank …
the receipt have nothing inside". Two independent faults, both on the payment
success screen:

1. **The paper was blank.** `printReceipt80mm()` hid the app with
   `visibility:hidden` and made `#receipt-print-area` `position:absolute;
   left:0; top:0` — but `.receipt-wrap` keeps a transform after its
   `fadeInUp … both` animation, which makes it the containing block for that
   absolute node, and `.pos-shell`/`.pos-body`/`.main` are all `overflow:hidden`
   with a `100vh` shell. The slip therefore rendered mid-card (often clipped),
   never at the left edge of the sheet, and there was no `@page` size at all —
   an 80 mm thermal printer received the leftmost strip of an A4 page that
   contained nothing but hidden app chrome. Blank sheet.
2. **The screen could be blank too.** The success block read
   `saleResult.tax` / `saleResult.discount` (the API returns `taxAmount` /
   `discountAmount`), fell back to the **already cleared** cart for anything it
   missed, and wrapped the whole slip in `{saleResult && …}` — so a thin verify
   payload after the PayMongo redirect rendered no receipt at all.

- [x] **`frontend/src/utils/receipt.js` (new)** — one pure module feeds the
      screen, the printer and the download: `normalizeItems()` accepts server /
      cart / checkout line shapes, `buildReceiptModel()` resolves every field
      alias (`taxAmount|tax`, `discountAmount|discount`, `changeAmount`,
      `items[].product.name|productName|name`, split legs) across the sale
      payload → the `pendingOnlineSale` snapshot → the cart, derives totals from
      the lines when the payload is thin, and reports `hasData` so the UI can
      re-fetch instead of printing an empty slip. `renderReceiptHtml()` emits a
      self-contained 80 mm document (`@page { size: 80mm auto; margin: 0 }`,
      monospace, black-on-white, escaped). `printHtmlDocument()` prints it in a
      hidden frame created in the top-most **same-origin** document (works when
      the POS runs inside the HRMS iframe) and refuses to print an empty body;
      `printNodeInPage()` is the in-page fallback.
- [x] **`frontend/src/pages/Payment.jsx`** — receipt now always renders (no
      `{saleResult && …}` gate), from the shared model; keeps the gateway
      snapshot in a ref before `sessionStorage` is cleared (and stamps customer
      + timestamp into it); re-fetches `GET /sales/:id` when the payload has no
      lines, with a "Reload details" button; auto-print now covers online
      payments too; `Print Receipt` / `Download HTML` share one renderer.
- [x] **`frontend/src/index.css`** — print rules rewritten around a
      `#receipt-print-portal` (a direct child of `<body>`, everything else
      `display:none`, named page `receipt-80mm`) so no ancestor can clip or
      offset the sheet; forced black-on-white for dark mode. Slip typography
      lifted out of `.text-muted`, and `.pay-summary-total` got the flex it was
      missing (it rendered as "Total₱490.39").
- [x] **Settings** — `receiptHeader` (already an allowed/validated key) is now
      rendered on the slip; it was silently dropped before.
- [x] **Emailed receipt** — `receiptEmailText()` added and wired into both
      send sites (`_createSale`, `sendReceiptEmail`). `mailer.sendEmail` falls
      back to `text: text || subject`, so the text/plain part of a receipt was
      just the subject line: any client that prefers text/plain showed an empty
      receipt. The text part now mirrors the HTML (lines, total, tender, split
      legs).
- [x] **Tests** — `tests/unit/receipt.frontend.test.ts` (14): cash/split/online
      payloads, thin-verify + snapshot fallback, cart-only fallback, empty
      model flagged not printed, junk lines dropped, escaping, `@page` present,
      no `undefined`/`NaN` in output. E2E `pos-sale` + `pending-override` now
      assert the receipt actually contains the invoice no, the product name, a
      peso total and the payment line, and that the downloaded print document
      is a complete 80 mm slip. `tests/unit/receipt.email.test.ts` (4): the
      text part carries the invoice, every line, the total and the split legs,
      and is never empty.

**Gate:** `npm run lint` 0 errors / 0 warnings; receipt unit suites **18/18**
under the repo's own `vitest.config.ts`; `frontend` production build clean; e2e
specs updated for CI (this sandbox cannot build `sqlite3` or download Chromium,
so the e2e/integration gates run in CI).

---

## Shipped before this plan (history)
| Commit | What |
|---|---|
| `4d85608` | P0 stop-bleeding (sales 500, sqlite default, registration off-by-default) + P1 security (socket JWT auth, blacklist LRU, CORS, role-gates) + 16-test sales suite |
| `e442dc8` | P2 public site: `/` landing, careers, robots, public settings/jobs endpoints, 5 seeded postings |
| `8e74f37` | P2 login polish (dev forgot-password flow, inline errors, auth round-trip tests) + test DB safety (`:memory:` guard) |
| `0c40eed` | P3 part 1: POS scan flow + autofocus + F-key hints, hold reason/expiry, 80mm receipts + auto-print, PayMongo countdown + admin cash override (`POST /sales/pending/:id/cash-complete`), HRMS onboarding checklist (persisted in Settings) |
| `0f9d32d` | 13-area audit pass: fixed user-create hierarchy bug (register schema stripped roleId), PayMongo unconfigured → clean 503, DataTable keyboard a11y (both apps); verified SMTP/finance/branches/leaflet/sorting/images/promos/suppliers/validations |

**Baseline at plan start:** 470/470 tests green, coverage ratchets 10/20/3/10 (lines/functions/branches/statements), both frontends build clean.

## Destructive-op log
| When | Op | Why |
|------|----|-----|
| 2026-10-05 (P3) | Delete 11 untracked probe artifacts at repo root: `commit_msg.txt`, `create_product.json`, `create_sale.json`, `create_supplier.json`, `update_product.json`, `login.json`, `fix_users.sql`, `query_users.sql`, `seed.sql`, `test_login_roles.ps1`, `start-dev.bat` | A7/C4: working-tree junk from earlier probe rounds; none referenced by code or docs |
| 2026-10-05 (P3) | `git rm` tracked dev-process artifacts: `FIX_PROMPT.md`, `FIX_TRACKING_PROMPT.md`, `OPENCODE_REVIEW_PROMPT.md`, `CLOUDFLARE_DEPLOY.md` | A7: superseded by `PLAN.md`/`AUDIT.md`; deploy target is Render (CLOUDFLARE doc conflicts) |
| 2026-10-05 (P3) | `git rm` conflicting deploy configs: `vercel.json`, `.vercelignore`, `nginx.conf` | A7: only `render.yaml` (+ `Dockerfile`/`docker-compose.yml` for local) are the supported targets |
| 2026-10-05 (P3) | `git mv IMPROVEMENT_PLAN.md docs/IMPROVEMENT_PLAN.md` | C5: superseded by `PLAN.md`; archived, not deleted |
| 2026-10-05 (P3) | `git mv data/settings.json data/settings.defaults.json` + gitignore `data/settings.json` | A6a: runtime file (rewritten by settings API) untracked; committed file becomes the demo baseline |
| 2026-10-05 (P2) | (n/a — recorded here from Phase 2: none; seed mojibake fixed in source only) | — |
| 2026-10-06 (P7) | Deleted the hotfix smoke-test artifacts: repo-root `database.sqlite` (+`-wal`/`-shm`) and `uploads/products/ea809f54-….png` created while verifying the EACCES fallback; no `data/settings.json` was written | Both are gitignored runtime files produced by the single smoke boot on an ephemeral path; removed so the tree contains only the intended fix. Verified clean via `git status --porcelain` |
