# OpenCode AI — Comprehensive System Review Prompt

You are OpenCode AI, a world-class software auditor and full-stack engineer. Your task is to **review and verify that every system feature in the MiniMart POS + HRMS application is working properly**. This is a production-grade dual-frontend monorepo:

- **Backend**: Express.js + Sequelize ORM + SQLite (dev) / MySQL (prod), JWT auth with refresh rotation + blacklisting, bcryptjs, PayMongo, Nodemailer SMTP
- **Frontend POS**: React 18 + Vite on port 5173 (Zustand, React Query, Axios SSO interceptor, Leaflet)
- **Frontend HRMS**: React 18 + Vite on port 3001 (Zustand auth, iframe SSO to POS, postMessage)

Both frontends consume the same backend API at `http://localhost:5000/api/v1`.

## Instructions

For **every** checklist item below:
1. **Locate** the relevant code file(s) and read them
2. **Trace** the execution path end-to-end (frontend → API → service → model → DB)
3. **Identify** any bugs, missing pieces, broken logic, or absent error handling
4. **Flag** UX gaps (missing loading states, empty states, error feedback)
5. **Report** your finding as ✅ verified, ❌ broken, ⚠️ partial, or 🆕 missing
6. When you fix something, report it under `## FIXED`

Use the file paths, line numbers, and code snippets from your investigation to support every finding.

---

## CHECKLIST TO VERIFY

### 1. SMTP EMAIL FUNCTIONALITY
**Files to check**: `src/config/index.js:71-77` (SMTP config), `src/utils/mailer.js` (transport + sendEmail), `src/utils/emailTemplates.js`, `src/services/auth.service.js` (forgotPassword/resetPassword), any other email sends (hiring, leave approval, contract changes)

Verify:
- [ ] SMTP config reads from env vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`)
- [ ] `getTransporter()` lazily creates the transporter and caches it
- [ ] When SMTP is not configured (dev), emails are logged to console gracefully (no crash)
- [ ] `sendEmail()` handles errors without crashing the app
- [ ] Password reset flow: token is generated, hashed (sha256), stored with expiry, email sent with reset link, reset link contains raw token (not hashed)
- [ ] Reset token is verified by hashing the incoming token and comparing — check that `resetPassword` re-hashes correctly
- [ ] In dev mode, `resetToken` is returned in the API response (line 162-164) — verify this is gated behind `NODE_ENV !== 'production'`
- [ ] Check that all email-sending code paths (hiring emails, notification emails, etc.) use `sendEmail` and handle errors
- [ ] Check if `emailTemplates.js` exists and contains proper HTML templates for all emails
- [ ] Verify the `from` address falls back correctly (`config.smtp.from || config.smtp.user || 'noreply@minimartpos.com'`)

**Key risk areas**: Token reset link uses `process.env.FRONTEND_URL` (line 152 of auth.service.js) — verify this env var is documented in `.env.example`

### 2. FINANCE MODULE (P&L, CASHFLOW)
**Files to check**: `src/services/finance.service.js`, `src/routes/finance.js`, `frontend/src/pages/Finance.jsx`, `frontend/src/hooks/useApi.js` (useFinanceReport, useCashflow), `src/services/sale.service.js` (getSalesReport)

Verify:
- [ ] P&L report includes: revenue, COGS (cost of goods sold from purchase prices), gross profit, operating expenses, net profit
- [ ] COGS is calculated correctly — matches actual purchase costs, not just selling prices
- [ ] Tax breakdown by payment method (cash vs. online) — verify tax is calculated on the correct base
- [ ] Tax rate comes from config (`config.app.taxRate = 0.12` by default)
- [ ] Cashflow in/out: tracks sales revenue (cash portion), purchase payments (cash out), expenses (cash out), petty cash deposits/withdrawals
- [ ] Date range filtering works (today, last 7 days, month-to-date, custom range)
- [ ] SQLite/MySQL date function compatibility — `getSalesReport` in sale.service.js uses raw SQL for date filtering; verify it works on both databases
- [ ] Summary stat cards display: total revenue, gross profit, net profit, tax collected
- [ ] Frontend Finance page renders both P&L and cashflow tabs correctly
- [ ] Data refreshes after new sales, purchases, expenses

**Key risk areas**: Cross-database date function compatibility; COGS calculation when products are purchased at different prices

### 3. BRANCHES (CRUD + MAP WITH LEAFLET)
**Files to check**: `src/models/Branch.js`, `src/routes/branch.routes.js` (or `src/routes/index.js`), `src/controllers/branch.controller.js`, `src/services/branch.service.js`, `frontend/src/pages/Branches.jsx`, `frontend/src/components/Map.jsx`, `frontend/src/components/DataTable.jsx`

Verify:
- [ ] Branch model has: name, address, phone, email, lat, lng (check exact field names)
- [ ] Branch CRUD: create, read, update, delete all work via backend API
- [ ] Branch manager assignment — check if `Branch.belongsTo User` (manager) association exists
- [ ] Frontend Branches page: map shows branch markers with Leaflet, clicking a marker centers map + highlights in sidebar
- [ ] Branch list sidebar with active branch highlighting, flyTo on selection
- [ ] Map component renders markers from branch lat/lng coordinates
- [ ] Branch selection in POS — verify if POS filters products by selected branch
- [ ] Form validation on branch creation (required fields, lat/lng numeric)
- [ ] DataTable sorting, pagination, search on branch list

### 4. USER HIERARCHY (ROLES, REPORTS-TO, PERMISSIONS)
**Files to check**: `src/models/User.js`, `src/models/Role.js`, `src/models/Permission.js`, `src/models/role_permissions.js`, `src/middleware/auth.js` (protect, authorize, hasPermission), `src/routes/user.routes.js`, `frontend/src/pages/UserManagement.jsx`

Verify:
- [ ] User model has `belongsTo Role` and `belongsTo self as reportsTo` (self-referencing for hierarchy)
- [ ] User has `hasMany directReports` (inverse of reportsTo)
- [ ] 6 roles exist (admin, manager, hr, cashier, inventory_staff, employee) — check seed data in server.js
- [ ] Roles have granular permissions via `role_permissions` join table → `hasPermission` middleware checks `req.user.role.permissions`
- [ ] `hasPermission` middleware works — verify it checks permission slugs correctly
- [ ] User creation form in POS: includes firstName, lastName, email, phone, role, reportsTo fields
- [ ] Password strength validation: 8+ chars, upper+lower+digit
- [ ] Self-deletion prevention (user can't delete their own account)
- [ ] Admin deletion prevention
- [ ] Role dropdown shows all roles with correct slugs
- [ ] Reports-to dropdown shows only active users (not deleted)

### 5. HRMS-TO-POS CONNECTION (SSO IFRAME WITH POSTMESSAGE)
**Files to check**: `frontend/src/App.jsx` (AuthCheck component, SSO token handling), `frontend/src/api/client.js` (Axios interceptor for iframe postMessage), `frontend-hrms/src/pages/PosEmbed.jsx`, `frontend-hrms/src/api/posClient.js`

Verify:
- [ ] HRMS PosEmbed sends SSO token via URL param: `?sso_token=<token>`
- [ ] POS AuthCheck reads `sso_token` from URL params on load
- [ ] POS validates the token via `/auth/profile` with Bearer header
- [ ] On SSO success: POS logs in the user, cleans URL (removes sso_token from address bar)
- [ ] On SSO failure: if in iframe (`window.top !== window`), sends `postMessage` of type `pos-auth-failed` back to parent
- [ ] HRMS PosEmbed validates the message origin before accepting `pos-auth-failed`, `pos-logout`, `pos-back-to-hrms` messages
- [ ] PosEmbed auto-retry logic: retry up to 2 times on auth failure, incrementing iframe key to force reload
- [ ] "Back to HRMS" button: Escape key also closes iframe, navigates role-aware (cashier → /my-attendance, inventory_staff → /inventory-dashboard, others → /)
- [ ] Axios interceptor in POS client.js: on 401 when in iframe, sends `pos-logout` message to parent
- [ ] Token refresh interceptor: queues failed requests while refresh is in progress

### 6. PROPER DATA TABLES (SORTING, FILTERING, PAGINATION, CSV EXPORT)
**Files to check**: `frontend/src/components/DataTable.jsx`, `frontend-hrms/src/components/DataTable.jsx`, all pages using DataTable (Pos, Products, Suppliers, Discounts, etc.)

Verify (check at least 3 pages in each frontend):
- [ ] Column sorting: click header sorts ascending/descending, visual indicator shows direction
- [ ] Filtering: search input filters rows by matching text across columns
- [ ] Pagination: page size selector, next/prev buttons, page number display, correct item counts
- [ ] CSV export: exports the **currently filtered** dataset (not all rows)
- [ ] Column toggle: show/hide columns, dropdown closes on outside click
- [ ] Empty state: shows "No results found" when filtered data is empty
- [ ] Loading skeleton while data is fetching
- [ ] Responsive: table scrolls horizontally on mobile

### 7. PAYMONGO ONLINE PAYMENTS (GCASH, PAYMAYA, CARD)
**Files to check**: `src/services/paymongo.service.js`, `src/routes/payment.js`, `frontend/src/pages/Payment.jsx`, `frontend/src/hooks/useApi.js` (useCreateCheckout, usePaymentStatus, useVerifyPayment)

Verify:
- [ ] PayMongo config reads from env: `PAYMONGO_SECRET_KEY`, `PAYMONGO_PUBLIC_KEY`, `PAYMONGO_WEBHOOK_SECRET`
- [ ] `createCheckoutSession()` builds line items with correct name, quantity, amount, currency
- [ ] Payment method options include gcash, paymaya, card (check PayMongo API compatibility)
- [ ] Tax and discount are reflected in checkout line items (not just total)
- [ ] Webhook endpoint (`POST /payments/webhook`) verifies PayMongo signature
- [ ] On `checkout_session.completed`: marks payment as paid, updates sale status, restores stock if needed
- [ ] `getPaymentStatus(saleId)`: checks payment by sale ID or session ID
- [ ] Frontend Payment page: PayMongo checkout redirects user to PayMongo-hosted page
- [ ] Payment success flow: when in iframe, breaks out of iframe using `window.top.location.href`
- [ ] Payment cancel flow: redirects back to payment page
- [ ] Frontend polls payment status (usePaymentStatus with refetchInterval)
- [ ] Pending sale created (stock reserved) BEFORE checkout redirect — verify sale.service.createPending()

### 8. PROPER DATA SORTING THROUGHOUT
**Files to check**: All `.service.js` files with `getAll` methods, `frontend/src/components/DataTable.jsx`, `frontend/src/pages/Products.jsx`, `frontend/src/pages/Suppliers.jsx`

Verify sorting is applied at the backend for:
- [ ] Products list — sortBy validation whitelist (name, price, stock, createdAt, expiryDate, category)
- [ ] Suppliers list — sortBy whitelist (name, createdAt, email, purchaseCount, rating, leadTimeDays, category)
- [ ] Users list — sortBy and sortOrder params passed through
- [ ] Branches list — sortBy validation
- [ ] Discounts list — sortBy validation
- [ ] Purchases list — sortBy validation
- [ ] Sales list — sortBy validation
- [ ] Purchases list — sortBy validation
- [ ] Default sort order is specified (not unspecified/random DB order)
- [ ] Sort order toggles are case-insensitive (ASC/DESC accepted regardless of case)
- [ ] Invalid sortBy param falls back to default (not SQL injection risk)

### 9. IMAGE-REQUIRED PRODUCTS (UPLOAD + VALIDATION)
**Files to check**: `src/models/Product.js`, `src/middleware/upload.js`, `src/utils/validateMagicNumber.js`, `src/routes/product.routes.js`, `frontend/src/pages/Products.jsx`

Verify:
- [ ] Product model requires an image field
- [ ] Product creation route requires image upload (`upload.single('image')` middleware)
- [ ] `validateMagicNumber` middleware checks file magic numbers (not just extension) — verify it checks PNG/JPEG/GIF headers
- [ ] File size limit enforced (config.upload.maxFileSize = 5MB default)
- [ ] File type validation: only image files allowed
- [ ] Frontend Products form: image upload is required on create (not on edit)
- [ ] Form shows preview of selected image before uploading
- [ ] Duplicate name/SKU/barcode detection (case-insensitive on name and sku)
- [ ] Selling price validation: selling price must be >= buying price
- [ ] Slug uniqueness validation when generating from name
- [ ] Image is properly stored and served (check upload path, static serving)

### 10. INVENTORY STAFF AND CASHIER STAFF ROLE-SPECIFIC WORKFLOWS
**Files to check**: `src/middleware/auth.js` (authorize, hasPermission), `frontend/src/App.jsx` (ProtectedRoute roles), `frontend-hrms/src/App.jsx` (role-based routing), `frontend/src/pages/Pos.jsx`, `frontend-hrms/src/layouts/InventoryStaffLayout.jsx`, `frontend-hrms/src/layouts/EmployeeLayout.jsx`

Verify:
- [ ] Inventory staff can access: POS (via iframe), Products, Categories, Suppliers, Purchases, Inventory pages
- [ ] Inventory staff CANNOT access: Customers, Expenses, Petty Cash, Branches (admin only), Settings, UserManagement
- [ ] Cashier can access: POS (via iframe), Dashboard, Profile, Notifications
- [ ] Cashier cannot access: Products, Suppliers, Purchases, Expenses, Settings, Users
- [ ] Cashier role-based landing page: EmployeeLayout at /my-attendance
- [ ] Inventory staff role-based landing page: InventoryStaffLayout at /inventory-dashboard
- [ ] POS sidebar shows "POS System" button with "OPEN" badge for cashier and inventory staff
- [ ] Cashier can clock in/out, view attendance, request leaves, view payslips
- [ ] Inventory staff has access to inventory dashboard with stats
- [ ] Role-specific ProtectedRoute checks match backend authorize middleware
- [ ] Backend route-level authorization matches frontend route protection

### 11. WORKING DISCOUNTS/PROMOS
**Files to check**: `src/models/Discount.js`, `src/services/discount.service.js`, `src/routes/discount.routes.js`, `frontend/src/pages/Discounts.jsx`, `frontend/src/pages/Payment.jsx`, `frontend/src/store/cartStore.js`

Verify:
- [ ] Discount types: percentage and fixed
- [ ] Percentage value validation: must be ≤ 100
- [ ] Fixed discount validation: cannot exceed cart subtotal
- [ ] Max discount amount cap: if `maxDiscountAmount` is set, total discount ≤ that cap
- [ ] `minPurchaseAmount`: discount only applies if cart subtotal ≥ minimum
- [ ] Date range validation: `endDate >= startDate` (not in past at creation)
- [ ] Usage limit tracking: `usedCount` increments, `usageLimit` enforced
- [ ] Date range validation: `endDate >= startDate` (not in past at creation)
- [ ] Discount status badges: active (green), expired (red), used-up (gray), inactive
- [ ] Frontend Payment page: manual discount input + promo code application
- [ ] Discount applied to cart reflects in tax calculation (tax applied on discounted amount)
- [ ] Profit calculation in sale.service.js excludes per-item discounts (verify line 119 of FIX_PROMPT.md note)

### 12. PROPER SUPPLIER SYSTEM (BANKING, LAT/LNG, CATEGORIES, LEAD TIME)
**Files to check**: `src/models/Supplier.js`, `src/services/supplier.service.js`, `src/controllers/supplier.controller.js`, `frontend/src/pages/Suppliers.jsx`

Verify:
- [ ] Supplier model fields: name, email, phone, mobile, address, city, province, postalCode, taxId, paymentTerms, notes, website, category, leadTimeDays, minimumOrderAmount, rating, bankName, bankAccount, registrationNumber, lat, lng, contactPerson
- [ ] Banking info: `bankName` and `bankAccount` stored and displayed in detail modal
- [ ] lat/lng: coordinates validated (numeric, valid range lat ±90, lng ±180)
- [ ] Category filter on list page works
- [ ] Supplier cannot be deleted if it has active (non-cancelled) purchases — verify guard in service
- [ ] Outstanding balances calculated correctly (sum of unpaid purchase totals)
- [ ] Supplier summary: purchase count, total spend, avg order value, last purchase date, outstanding balance
- [ ] Purchase history tab per supplier (paginated, with items)
- [ ] Analytics tab: top suppliers by spend, category breakdown, average rating
- [ ] CSV import/export works with the full field set
- [ ] Supplier detail modal has tabbed interface: details / summary / purchases

### 13. UI/UX QUALITY IMPROVEMENTS
**Files to check**: `frontend/src/index.css`, `frontend-hrms/src/index.css`, `frontend/src/components/*.jsx`, `frontend-hrms/src/components/*.jsx`, `frontend/src/pages/*.jsx`, `frontend-hrms/src/pages/*.jsx`

Verify across both frontends:
- [ ] Loading states: every page with async data shows `LoadingSkeleton` while fetching
- [ ] Error states: every page shows error message + retry button on fetch failure
- [ ] Empty states: every list page shows "No X found" when empty
- [ ] Toast notifications fire on all CRUD operations (success/error)
- [ ] No broken inline styles where CSS utility classes exist (both have extensive utility classes)
- [ ] Modals use `createPortal` to `document.body` with z-index 9999 and proper close behavior
- [ ] Responsive design: sidebar collapses on mobile, grids adapt to screen size
- [ ] Code splitting: pages loaded via `React.lazy` + `Suspense` with `PageLoader` fallback
- [ ] Staggered entrance / slide-up / fade-in animations on page transitions
- [ ] Glass effect on cards, hover lift, gradient header on tables, gradient button backgrounds
- [ ] Dark mode support via `data-theme="dark"` attribute
- [ ] Focus glow on form inputs
- [ ] Consistent indigo (#6366f1) theme throughout

### 14. COMPREHENSIVE INPUT VALIDATION
**Files to check**: `src/validators/index.js` (or individual schema files), `src/middleware/validate.js`, `src/utils/sanitize.js`/`sanitizeObject`, frontend form validation patterns in each page

Backend validation:
- [ ] `validate` middleware wraps all mutation routes (POST, PUT, PATCH)
- [ ] Joi schemas exist for: users, auth (login, register, changePassword, forgotPassword, resetPassword), products, suppliers, purchases, sales, expenses, discounts, branches, customers
- [ ] Phone validation: minLength 7, maxLength 20
- [ ] Name fields reject numbers (regex: `/[^a-zA-Z\s\-'.]/g`)
- [ ] Bank account / postal code fields reject letters (regex: `/[^0-9]/g`)
- [ ] `sanitizeObject` is called in services to strip unwanted fields before DB writes
- [ ] LIKE wildcard escaping (`escapeLike` utility) — check it's used in all search queries
- [ ] File upload validation: type, size, magic numbers (not just extension)

Frontend validation:
- [ ] Password strength: 8+ chars, upper+lower+digit — verify in UserManagement.jsx
- [ ] Required field indicators on all forms
- [ ] Real-time validation feedback (invalid field styling)
- [ ] Date validation: expiry dates can't be before today (min=today)
- [ ] Discount: percentage ≤ 100, fixed ≤ subtotal, endDate ≥ startDate
- [ ] Employee: name regex, phone length, bank account numeric
- [ ] Purchase: quantity > 0 guards
- [ ] Job posting: closingDate >= today, interview scheduledDate >= today, no past times on same day

### 15. EXTRA CRITICAL FILES TO REVIEW
- [ ] `src/middleware/auth.js`: `protect` checks JWT + blacklisted token + user active status; `authorize` checks role membership; `hasPermission` checks permission slugs
- [ ] `src/models/index.js`: auto-loads models, calls `.associate()` on each; verify all associations (User→Role, User→self reportsTo, User→directReports, Role→Permission, Product→Category/Supplier, Sale→items/payments/customer/user, Branch→manager, Supplier→purchases, Discount→usage tracking)
- [ ] `src/routes/index.js`: registers all ~22 route modules under `/api/v1`, tracking routes, 404 catch-all, static file serving
- [ ] `src/server.js`: Express config (CORS, helmet with frameguard disabled, rate limiting), socket.io for delivery tracking, Prometheus metrics, health check, graceful shutdown, dev-mode safe schema migrations (safeAddColumn), seed data for all roles/users/permissions/categories/suppliers/branches
- [ ] `frontend/src/api/client.js`: Axios Bearer token from sessionStorage, 401 refresh token rotation with failed queue queueing, iframe postMessage on auth failure
- [ ] `frontend-hrms/src/pages/Attendance.jsx`: clock in/out with timestamps, calendar view with color-coded cells, department filter, month navigation, late detection (>30 min after shift start), absent detection
- [ ] `frontend-hrms/src/pages/Leaves.jsx`: leave request with date validation, overlap check (excludes cancelled), balance deduction only on admin-approved, batch approve with select-all checkbox, cancel → status = 'cancelled' (not 'rejected'), admin reject wraps attendance cleanup in transaction
- [ ] `frontend-hrms/src/pages/Payroll.jsx`: SSS 2025 table (14.5% rate, 46 brackets), PhilHealth floor at 10,000, Pag-IBIG cap at 100, holiday OT rates (Regular 2.60x, Special 1.69x), 13th month pay tax-exempt up to 90,000, totalBasicYTD accumulation from previous payslips, generate payslips, print/save PDF

---

## REPORTING FORMAT

```markdown
## FIXED
- [x] Brief description of fix (file:line)
- [x] ...

## IMPROVED
- [x] Brief description of improvement
- [x] ...

## VERIFIED WORKING
- [x] Feature name — works correctly
- [x] ...

## ⚠️ PARTIAL / NEEDS ATTENTION
- [~] Feature: description of issue (file:line)
- [~] ...

## ❌ BROKEN
- [ ] Feature: description of bug (file:line)
- [ ] ...

## 🆕 MISSING
- [ ] Feature: should exist but doesn't (file:line)
- [ ] ...

## 🔍 ARCHITECTURE NOTES
- Brief notes on any architectural concerns, inconsistencies, or deviations from best practices observed during the review
```

---

## HOW TO START

1. **Start with the backend**: Read `src/server.js`, `src/models/index.js`, `src/middleware/auth.js`, `src/routes/index.js`, and `src/config/index.js` to understand the foundation
2. **Then check services**: `auth.service.js`, `sale.service.js`, `finance.service.js`, `paymongo.service.js`, `supplier.service.js`, `discount.service.js`, `product.service.js`

> **PRE-LOADED FINDINGS** (known discrepancies to verify):
> - **DataTable CSV export inconsistency**: The POS DataTable (`frontend/src/components/DataTable.jsx:65-68`) exports `filteredData` (correct — exports visible+filtered rows). The HRMS DataTable (`frontend-hrms/src/components/DataTable.jsx:57-75`) exports `data` (ALL rows, not filtered — likely a bug). Flag this.
> - **DataTable col-toggle dropdown**: POS version (`frontend/src/components/DataTable.jsx:143-171`) has outside-click-to-close logic via `colToggleRef` + `handleClickOutside` (line 29-38). HRMS version (`frontend-hrms/src/components/DataTable.jsx:138-158`) does NOT have outside-click-to-close — the dropdown stays open after clicking elsewhere. Flag this.
> - **`escapeLike` in helpers**: `src/utils/helpers.js:3-6` escapes `%` and `_` with `\` prefix. Verify it is actually USED (with ESCAPE clause) in all backend search queries — many services may use raw `Op.like` without `escapeLike`, creating LIKE injection risk.
> - **`sanitizeObject` in helpers**: `src/utils/helpers.js:81-89` trims strings and strips `<>` tags. Verify it's called in every create/update service method.
> - **Frontend validation differences**: POS UserManagement has password strength validation; verify HRMS has similar patterns for employee forms (name regex, phone length, bank account numeric).
3. **Then check routes + controllers**: `auth.routes.js`, `payment.js`, `product.routes.js`, `branch.routes.js`, `user.routes.js`, `discount.routes.js`, `supplier.routes.js`, `finance.js`
4. **Then check models**: `User.js`, `Role.js`, `Product.js`, `Sale.js`, `Branch.js`, `Supplier.js`, `Discount.js`, `Employee.js`
5. **Then check POS frontend**: `App.jsx`, `api/client.js`, `hooks/useApi.js`, pages for Pos, Payment, Products, Suppliers, Discounts, Branches, Finance, UserManagement
6. **Then check HRMS frontend**: `App.jsx`, `pages/PosEmbed.jsx`, `pages/Dashboard.jsx`, `pages/Attendance.jsx`, `pages/Leaves.jsx`, `hooks/useApi.js`
7. **Test each role's full workflow** end-to-end as described in the role journeys in FIX_PROMPT.md
8. **Write your review** covering every checklist item above

**Start your review now.** Be thorough — check every file, trace every path, report every issue.