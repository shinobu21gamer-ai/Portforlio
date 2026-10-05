# MiniMart POS + HRMS — Improvement Plan

**Owner:** shinobu21gamer · **Started:** 2026-10-05 · **Status:** PHASE 1 (audit)
**Scope:** the whole system — Node/Express + Sequelize API, POS React app (`frontend/`),
HRMS React app (`frontend-hrms/`), public job portal, SQLite (dev) / MySQL (prod) data.

Supersedes `IMPROVEMENT_PLAN.md` (P0–P3 of that plan are already shipped — see its history
section and the commit log). This plan is the remaining roadmap, phase-gated: each phase
finishes green (tests pass, server healthy) before the next starts.

---

## Phase 1 — Audit → `AUDIT.md`
Full-system audit, findings ranked (P0 critical → P3 low):
- **Bugs & broken flows** (backend, POS, HRMS, public portal)
- **Security** (credentials, secrets, rate limiting, server-side role checks, upload limits,
  injection, IDOR, webhook integrity, file serving)
- **Wrong calculations** (money, tax, stock, payroll, attendance)
- **Missing DB transactions / race conditions**
- **Console/server errors, lint, failing or flaky tests**
- **UI/UX problems** (dark mode, a11y, responsive, states)
- **Repo hygiene** (stray root files, tracked dev artifacts, misleading README)

Deliverable: `AUDIT.md` — ranked, each finding with location, evidence, impact, and a fix
sketch. No code changes in this phase.

## Phase 2 — Fix all errors
Close every Phase-1 finding that is an error: console errors, server 5xx paths, lint,
failing/flaky tests, wrong calculations, missing DB transactions.
Gate: `npm test` + lint green, full API smoke green, zero known 500 paths.

## Phase 3 — Security & deploy hardening
- Remove/rotate default credentials (seed accounts documented as dev-only; first-run admin
  must change password or be forced to)
- JWT secrets: no usable fallback in production (boot fails without `JWT_SECRET`/
  `JWT_REFRESH_SECRET`)
- Rate limiting on auth + public endpoints (login lockout, forgot-password, register,
  job apply)
- Server-side role/permission checks on every mutating route (audit matrix)
- Upload limits (size, count, type) + private-file serving audit
- Persistent DB for production (Render: disk or external MySQL; SQLite file-backed with
  migrations)
- Clean stray root files, tighten `.gitignore`, verify nothing sensitive is tracked
Gate: security checklist in `AUDIT.md` §Security re-run and green; deploy dry-run on Render.

## Phase 4 — Logic & flow
- **POS:** checkout speed, split payments, refunds, cashier shifts, receipts (print + email),
  voids, held-transaction correctness
- **Inventory & purchasing:** receiving/stock adjustment correctness, purchase payment
  installments, supplier balances, transfers, low-stock/expiry flows
- **HRMS:** attendance (clock-in/out, geofence, overtime), leave request → approval flow,
  payroll generation → process → pay, payslip rendering, contracts
- **Link HRMS employees to POS users** (one account, role-based entry point)
- Role-based menus (each role sees only what it may do)
- Correct dashboards (numbers must match raw tables) and exports (CSV integrity)
Gate: end-to-end happy + failure paths per flow verified via API tests and manual scripts.

## Phase 5 — UI/UX redesign
- Design tokens (single source for color/spacing/radius/type) in both apps; kill inline
  hex/rgba that bypass the theme
- Shared component kit (Button, Input, Modal, DataTable, Toast, EmptyState, Skeleton)
  consistent across POS + HRMS
- Light/dark mode audit (all surfaces, charts, modals)
- Responsive pass (POS tablet 44px touch targets; HRMS laptop-first, phone-tolerant)
- Accessibility: focus traps in all modals, `aria-live` toasts, keyboard-navigable tables
  (done for DataTable headers/rows), contrast ≥ AA
- Loading/empty/error states on every data screen
- Searchable, paginated, sortable tables everywhere (server-side)
Gate: both apps rebuild clean; a11y spot-check checklist green.

## Phase 6 — Tests & CI
- Unit: services (money, tax, stock, payroll, attendance math) — ratchet up coverage
- API: every route ≥1 happy + ≥1 authz/4xx case (parametrized, real app, :memory: DB)
- Playwright E2E per role (admin, manager, cashier, HR, employee, inventory staff):
  login → main job → logout; POS sale + receipt; online-pay pending → override path
- GitHub Actions: install → lint → test (SQLite) → build both frontends → optional MySQL
  migration job; upload coverage
- README: accurate setup (dev + Render deploy), env var table, demo credentials (dev-only),
  screenshots, API docs pointer
Gate: CI green on the branch; README matches reality (verified by following it on a clone).

---

## Ground rules
1. Phase order is fixed; a phase is "done" only when its gate passes.
2. Every phase ends with a commit + push to the session branch and a `PROGRESS.md` update.
3. No phase may regress the test suite (ratchets only move up).
4. Destructive ops (data wipe, credential rotation) get called out in `PROGRESS.md` first.
