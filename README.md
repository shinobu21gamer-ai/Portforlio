# MiniMart POS + HRMS

MiniMart is a single-deploy retail system with a public landing/careers site, a
Point of Sale (POS) application, and an HRMS application. The Express server
also owns the REST API, authentication, uploads, background notifications, and
both production frontend builds.

## URLs

With the server running on its default port:

| Surface | URL | Purpose |
| --- | --- | --- |
| Landing / careers | `http://localhost:5000/` | Public company and careers landing page |
| POS | `http://localhost:5000/pos` | Authenticated checkout, catalogue, inventory and retail operations |
| HRMS | `http://localhost:5000/hrms` | Staff login, people operations, self-service, and embedded POS access |
| POS/core REST API | `http://localhost:5000/api/v1` | Retail, auth, reporting, payment and settings endpoints |
| HRMS REST API | `http://localhost:5000/api/v1/hrms` | Employee, attendance, leave, payroll, recruitment and self-service endpoints |
| Swagger UI | `http://localhost:5000/api-docs` | POS/core API documentation (admin-only in production) |
| Health check | `http://localhost:5000/health` | Deployment health probe |

> **Important:** `/` is the public landing page, not the POS. Go to `/pos` for
> the POS app and `/hrms/login` for the staff sign-in screen.

## Features

### POS and retail

- Product catalogue with categories, SKU/barcode search, images, stock levels,
  imports/exports, low-stock and expiry alerts.
- Fast cashier checkout with scanning, held carts, cash/change, split tender,
  discounts/promos, thermal receipt printing/download, refunds and voids.
- Cashier shifts with opening float, cash-sales attribution, expected/counting
  reconciliation and close-out notes.
- Customers, loyalty points, suppliers, purchase orders, stock receiving,
  expenses, petty cash, branches, finance reports and activity/audit trails.
- GCash/Maya/online checkout integration through PayMongo when configured.
  Online checkouts are represented as pending sales until payment is confirmed.
- A manager/admin cash override for a pending online checkout when a customer
  pays at the counter instead.

### HRMS

- Employee profiles, departments, positions, schedules and POS-access mapping.
- Attendance clock-in/out, geofence-aware attendance, calendars and exports.
- Contracts, leave balances and approval lifecycle, payroll/payslips and
  Philippine payroll calculations.
- Job postings, public applications/resumes, applicant review and interviews.
- Employee self-service for profile, attendance, leave, contracts, payslips and
  personal notifications.
- Role-aware HRMS navigation and an authenticated embedded POS for retail roles.

## Roles and development demo accounts

`AUTO_SETUP=true` in a **non-production** environment seeds the six accounts
below and demo data (including *Coca-Cola 1.5L*, ₱52, stock 48). They are for
local development, demos, and end-to-end tests only — never enable demo seeding
or ship these credentials in production.

| Role | What it is for | Development email | Development password |
| --- | --- | --- | --- |
| Admin | Full system, RBAC, finance, HRMS approvals and retail administration | `admin@minimart.com` | `admin123` |
| HR | People operations, recruitment, attendance and payroll workflows | `hr@minimart.com` | `hr123` |
| Manager | Retail management, reports, selected HR views, cash override | `manager@minimart.com` | `admin123` |
| Cashier | POS checkout, customers, own shift and self-service | `cashier@minimart.com` | `cashier123` |
| Inventory staff | Inventory, purchases, catalogue maintenance and self-service | `inventory@minimart.com` | `inventory123` |
| Employee | HRMS self-service | `ligma1@gmail.com` | `employee123` |

In production, `AUTO_SETUP` is deliberately ineffective. On an empty database,
the server creates one first admin from `INITIAL_ADMIN_EMAIL` and
`INITIAL_ADMIN_PASSWORD`, or emits a one-time generated password in the deploy
logs. That account must change its password before using protected endpoints.

## Quick start

### Prerequisites

- Node.js 20+ (Node 18+ supported)
- npm
- SQLite (default) or MySQL 8+

### Install, build, and run

```bash
npm ci
npm --prefix frontend ci
npm --prefix frontend-hrms ci
npm run build
AUTO_SETUP=true npm start
```

Open `http://localhost:5000/`, then use `/hrms/login` to sign in. The Express
server serves the built POS at `/pos` and the built HRMS at `/hrms`.

For local frontend development instead of production builds:

```bash
npm run dev:api      # API / Express server on :5000
npm run dev:pos      # Vite POS app
npm run dev:hrms     # Vite HRMS app
```

### MySQL instead of SQLite

```dotenv
DB_DIALECT=mysql
DB_HOST=localhost
DB_PORT=3306
DB_NAME=minimart_pos
DB_USER=root
DB_PASSWORD=your-password
```

## API documentation and endpoint maps

Swagger at `/api-docs` documents the POS/core API. In production it requires an
admin JWT; development serves it openly for convenient local exploration.

The HRMS API is intentionally documented as an endpoint map below rather than
silently implying Swagger covers it. The generated route inventory in
`tests/utils/route-table.ts` is the source-tested, complete map (112 HRMS
routes); regenerate it after changing route middleware:

```bash
node scripts/generate-route-table.js
node scripts/generate-route-table.js --check
```

### POS/core API map

All protected endpoints expect `Authorization: Bearer <access-token>`.

| Area | Base path | Examples |
| --- | --- | --- |
| Authentication | `/api/v1/auth` | `POST /login`, `/logout`, `/refresh-token`, `/change-password`; profile get/update |
| Catalogue | `/api/v1/products`, `/categories` | CRUD, barcode lookup, best sellers, low stock, expiring products |
| Checkout and sales | `/api/v1/sales` | List/detail/invoice/report, cash sales, cancellation, refund, receipt email |
| Pending online checkout | `/api/v1/sales/pending` | Create pending sale, cancel it, or complete it as cash (details below) |
| Payments | `/api/v1/payments` | Create/verify checkout, status and PayMongo webhook |
| Inventory | `/api/v1/inventory` | Stock in/out/adjust, stock movements and audit logs |
| Retail operations | `/api/v1/customers`, `/suppliers`, `/purchases`, `/expenses`, `/petty-cash`, `/shifts` | Customer, vendor, purchasing, expense, till and shift flows |
| Administration | `/api/v1/users`, `/roles`, `/settings`, `/branches`, `/dashboard`, `/finance`, `/activity-logs` | RBAC, settings, reports and audit data |
| Public careers | `/api/v1/public` | Public settings, jobs and application submission |

### HRMS API map

All routes below are under `/api/v1/hrms`. Role/permission requirements are
encoded on each Express route and continuously exercised by the route matrix.

| Area | Representative paths |
| --- | --- |
| Organisation | `/departments`, `/positions`, `/categories`, `/branches` |
| Employees | `/employees`, `/employees/:id`, approval/reject/terminate, POS access, `/pos-staff` |
| Attendance | `/attendance`, `/attendance/today`, `/attendance/calendar`, self-service `POST /attendance/clock-in` and `/clock-out` |
| Schedules | `/schedules`, `/schedules/assign`, assignments and permanent assignments |
| Leave | `/leaves`, `PUT /leaves/:id/{hr-review,approve,reject,cancel}`, `/me/leaves`, `/me/leaves/balance` |
| Payroll | `/payrolls`, preview/generate/process/pay/payslips/export, `/me/payslips` |
| Recruitment | `/jobs`, applications, interviews and protected resume downloads |
| Contracts and documents | `/contracts`, lifecycle actions, `/employee-documents` and document download |
| Self-service | `/me`, `/me/profile`, `/me/attendance`, `/me/contracts`, notifications |

### Pending sale / online-payment recovery API

A non-cash POS checkout creates a stock-reserving pending sale before it is sent
to PayMongo. These endpoints make that lifecycle explicit:

| Method | Endpoint | Who | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/v1/sales/pending` | `sales.create` permission | Create a pending non-cash checkout |
| `POST` | `/api/v1/sales/pending/:id/cancel` | Authenticated owner/authorised user | Cancel an abandoned checkout |
| `POST` | `/api/v1/sales/pending/:id/cash-complete` | Admin or manager | Record the pending checkout as cash paid at the counter |
| `POST` | `/api/v1/payments/create-checkout` | Checkout caller | Start PayMongo checkout when configured |
| `GET` | `/api/v1/payments/verify/:saleId` | Checkout caller | Verify gateway completion |
| `POST` | `/api/v1/payments/webhook` | PayMongo | Confirm an online payment webhook |

## Testing and CI

### Local commands

```bash
npm run lint                 # ESLint, zero warnings allowed
npm run test:unit            # tests/unit only
npm run test:integration     # tests/integration only
npm run test:coverage        # full suite + 78/62/85/82 coverage ratchet
npm run build                # builds POS and HRMS
npm run test:e2e             # Playwright: 3 specs × Chromium + Pixel = 16 tests
```

The integration route matrix boots the actual Express app on an ephemeral port
against SQLite `:memory:` with the environment set before `src` is required. It
covers the complete generated inventory of **255 routes** (143 POS/core and 112
HRMS): a happy path plus unauthenticated/authz failure path for every route.

The coverage floor is **78% statements, 62% branches, 85% functions, and 82%
lines**. `coverage/` is a local artifact and is not committed.

GitHub Actions keeps unit and integration jobs disjoint, then runs a dedicated
combined coverage-ratchet job. It uploads coverage regardless of test outcome,
checks migrations against MySQL 8, builds and exchanges both frontend artifacts
for Playwright, uploads root `playwright-report/` and `test-results/`, runs a
security audit, and only permits staging deployment after all gates (including
the migration test) pass. Codecov is intentionally not part of this pipeline.

The E2E suite waits for the asynchronous demo seed rather than racing startup,
then verifies all six role landings/logout, a cashier cash sale in the embedded
POS, and manager cash recovery for an abandoned GCash checkout.

## Render deployment

`render.yaml` is the supported Render deployment definition. The service uses a
persistent disk for SQLite, uploads, and runtime settings:

- database: `/data/database.sqlite`
- uploads: `/data/uploads`
- settings: `/data/settings.json`

Set production secrets in Render rather than committing them. In particular,
set a first-admin credential, JWT secrets, SMTP credentials (or explicitly set
`EMAIL_DISABLED=true`), and PayMongo credentials if online checkout is enabled.
The CI deploy hook is optional: when `RENDER_DEPLOY_HOOK_URL` is not configured,
the deployment step emits a warning and safely skips instead of failing CI.

## Environment variables

| Variable | Description | Default / notes |
| --- | --- | --- |
| `NODE_ENV` | Runtime environment | `development` |
| `PORT` | HTTP server port | `5000` |
| `API_PREFIX` | API base path | `/api/v1` |
| `AUTO_SETUP` | Non-production only: seed the demo users/data | Do **not** use in production |
| `ALLOW_PUBLIC_REGISTRATION` | Explicitly opt into public account registration | Disabled unless explicitly enabled or enabled in settings |
| `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD` | First production admin on an empty database | Password must be at least 12 characters |
| `DB_DIALECT` | `sqlite` or `mysql` | `sqlite` |
| `DB_STORAGE` | SQLite database file | `./database.sqlite`; use persistent storage in production |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | MySQL connection settings | Used with `DB_DIALECT=mysql` |
| `UPLOAD_DIR` / `UPLOAD_PATH` | Persistent upload root / product-upload path | `uploads` / `uploads/products` |
| `SETTINGS_FILE` | Mutable runtime settings document | `./data/settings.json` (baseline: `data/settings.defaults.json`) |
| `EMAIL_DISABLED` | Explicitly disable outbound email | In production, set this or configure SMTP |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | SMTP for receipts, resets and HR messages | Required in production when email is enabled |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | Access-token signing secret and duration | Secret required in production; expiry defaults to `7d` |
| `JWT_REFRESH_SECRET` / `JWT_REFRESH_EXPIRES_IN` | Refresh-token signing secret and duration | Secret required in production; expiry defaults to `30d` |
| `BCRYPT_SALT_ROUNDS` | Password hashing cost | `10` |
| `APP_TIMEZONE` | Business timezone for reports, “today” and cron windows | `Asia/Manila` |
| `FRONTEND_URL` / `POS_FRONTEND_URL` | Public origins used in email links and cross-app handoffs | Unset falls back to request origin where possible |
| `CORS_ORIGIN` | Additional allowed browser origins | Same-origin is always supported |
| `PAYMONGO_SECRET_KEY` | Secret API key for creating/verifying PayMongo checkout | Required for online checkout |
| `PAYMONGO_PUBLIC_KEY` | PayMongo public key | Used by client/payment integration where applicable |
| `PAYMONGO_WEBHOOK_SECRET` | Verifies PayMongo webhook signatures | Required for safe online-payment confirmation |

## Project structure

```text
src/
  config/         application, DB and payment configuration
  controllers/    HTTP handlers
  middleware/     authentication, validation, uploads, audit and errors
  models/         Sequelize models
  routes/         POS/core and HRMS Express routers
  services/       transactional business logic
  utils/          response, timezone, mail and helper utilities
  docs/           Swagger configuration
  server.js       bootstrap, demo seed and HTTP server
frontend/         POS React + Vite application
frontend-hrms/    HRMS React + Vite application
tests/            unit, route-matrix integration and Playwright e2e suites
.github/          CI workflow
render.yaml       Render service and persistent-volume definition
```

## License

MIT
