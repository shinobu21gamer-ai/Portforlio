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
## Phase 4 — Logic & flow — not started
## Phase 5 — UI/UX redesign — not started
## Phase 6 — Tests & CI — not started

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
