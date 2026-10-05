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

## Phase 3 — Security & deploy — not started
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
(none yet — credential rotation / data wipes will be listed here before they happen)
