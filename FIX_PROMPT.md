# SYSTEM FIX & IMPROVEMENT PROMPT — MiniMart POS + HRMS

You are working on **MiniMart POS + HRMS**, a full-stack Point of Sale and Human Resource Management System. This is a production-grade application. Your job is to:

1. **Audit the entire system end-to-end** — backend API, both frontends, database, authentication, all features
2. **Fix every bug** — broken features, wrong behavior, race conditions, missing error handling
3. **Improve UX** — missing loading states, empty states, error feedback, navigation flow
4. **Add missing features** — anything that's half-built or referenced but not implemented
5. **Verify everything works** — test every user role's complete workflow

---

## PROJECT STRUCTURE

```
sia/
├── src/                        # Express.js backend (port 5000)
│   ├── server.js               # App entry, DB sync, seed data, cron jobs
│   ├── config/index.js         # Env config with validation
│   ├── models/                 # Sequelize models (SQLite)
│   ├── services/               # Business logic
│   ├── controllers/            # Request handlers
│   ├── routes/                 # API routes (/api/v1/*)
│   ├── middleware/             # Auth, validation, upload, audit, error handler
│   ├── validators/            # Joi schemas
│   ├── utils/                 # Helpers, logger, mailer, email templates
│   └── docs/swagger.js        # API docs
├── frontend/                   # POS React app (Vite, port 5173)
│   └── src/
│       ├── pages/             # POS pages (Pos.jsx, Sales.jsx, Products.jsx, etc.)
│       ├── store/             # Zustand stores (cartStore, authStore)
│       ├── api/               # Axios client with SSO token refresh
│       └── index.css          # POS styles (indigo theme, #6366f1)
├── frontend-hrms/             # HRMS React app (Vite, port 3001)
│   └── src/
│       ├── pages/             # 25+ HRMS pages
│       ├── layouts/           # HrmsLayout, EmployeeLayout, InventoryStaffLayout
│       ├── hooks/             # useApi.js (React Query hooks), useRole.js
│       ├── api/               # client.js, posClient.js
│       └── index.css          # HRMS styles (indigo luxe theme)
└── .env                       # SMTP, PayMongo, JWT secrets
```

## 6 USER ROLES

| Role | Access | Layout |
|------|--------|--------|
| `admin` | Full system | HrmsLayout |
| `manager` | HR + limited POS | HrmsLayout |
| `hr` | HR modules | HrmsLayout |
| `cashier` | POS + self-service | EmployeeLayout (POS opens first on login) |
| `inventory_staff` | Inventory + POS | InventoryStaffLayout (POS opens first on login) |
| `employee` | Self-service only | EmployeeLayout |

## SEEDED ACCOUNTS

| Email | Password | Role |
|-------|----------|------|
| admin@minimart.com | admin123 | admin |
| hr@minimart.com | hr123 | hr |
| manager@minimart.com | admin123 | manager |
| cashier@minimart.com | cashier123 | cashier |
| inventory@minimart.com | inventory123 | inventory_staff |
| ligma1@gmail.com | employee123 | employee |

## DESIGN SYSTEM

- **Color theme:** Indigo (#6366f1) for both frontends
- **Sidebar:** Dark navy (#0f172a), muted icons (#94a3b8), active state with gradient + white text
- **Cards:** Glass effect, hover lift, colored shadow on accent cards
- **Buttons:** Gradient background, glow on hover, smooth transitions
- **Tables:** Gradient header, alternating row hover, sticky header
- **Modals:** Glass backdrop blur, smooth enter/exit animations
- **Forms:** Focus glow, floating labels on login
- **Dark mode:** Full support via `data-theme="dark"` attribute
- **Animations:** Staggered entrance, slide-up, fade-in on page transitions

---

## CRITICAL THINGS TO CHECK AND FIX

### 1. AUTHENTICATION & SESSION
- [ ] Login/logout works for all 6 roles
- [ ] JWT token refresh rotation works (new token + refresh token on expiry)
- [ ] Blacklisted tokens are cleaned up periodically
- [ ] POS iframe SSO works (token passed via URL param, iframe receives it)
- [ ] PosEmbed auto-retries on auth failure (up to 2 times)
- [ ] "Back to HRMS" button navigates to the correct page per role
- [ ] Refresh token "null" string bug is handled
- [ ] Password reset flow works (email in dev mode shows reset link)
- [ ] ProtectedRoute blocks unauthenticated users and wrong-role users

### 2. ROLE-BASED NAVIGATION (FIXED BUT VERIFY)
- [ ] Cashier login → POS opens full-screen → "Back to HRMS" → EmployeeLayout at /my-attendance
- [ ] Inventory login → POS opens full-screen → "Back to HRMS" → InventoryStaffLayout at /inventory-dashboard
- [ ] Admin/HR/Manager login → HrmsLayout dashboard at /
- [ ] Employee login → EmployeeLayout at /my-attendance
- [ ] HrmsLayout redirects cashier/inventory/employee away (hard guard at top of component)
- [ ] PosEmbed has `user` from useAuthStore (was missing, caused crash)
- [ ] Sidebar nav items visible for ALL roles in their correct layout
- [ ] POS System button with "OPEN" badge visible in EmployeeLayout and InventoryStaffLayout

### 3. POS SYSTEM (frontend/)
- [ ] Product search works (by name, SKU, barcode)
- [ ] Add to cart works with quantity validation
- [ ] Cart quantity cannot exceed stock
- [ ] Cart cannot add 0-stock items (button disabled)
- [ ] Expired products sorted to bottom, greyed out, button disabled
- [ ] Discount codes apply correctly (percentage capped at 100%, fixed discount capped at total)
- [ ] Tax calculation correct (12% VAT)
- [ ] PayMongo checkout works (gcash, paymaya, card)
- [ ] PayMongo tax/discount shown in checkout line items
- [ ] Payment success page works (breaks out of iframe with window.top.location.href)
- [ ] "Back to HRMS" button on payment success when in top window
- [ ] Cancel payment redirects correctly
- [ ] Pending sale reserves stock atomically (SELECT FOR UPDATE)
- [ ] Cancel pending sale restores stock
- [ ] Invoice numbers are UUID-based (no race conditions)
- [ ] Profit calculation excludes per-item discounts
- [ ] Walk-in customer default works
- [ ] Customer search works
- [ ] Loyalty points accumulated and displayed
- [ ] Cart store validates stock on updateQuantity and addItem

### 4. HRMS EMPLOYEE MANAGEMENT
- [ ] Employee list loads with pagination, search, filters
- [ ] Employee detail shows all fields including department, position, schedule
- [ ] Employee create/edit forms validate all fields
- [ ] Phone validation: minLength 7, maxLength 20
- [ ] Name fields reject numbers (regex: `/[^a-zA-Z\s\-'.]/g`)
- [ ] Bank account / postal code fields reject letters (regex: `/[^0-9]/g`)
- [ ] Employee approval activates both Employee and User records
- [ ] Employee rejection deactivates both records
- [ ] Employee delete deactivates (soft delete via paranoid)
- [ ] Org chart renders correctly (tree from reportsToId)
- [ ] Employee documents upload/download/delete work
- [ ] Document upload validates file type (PDF/DOC/XLS/images) and size (10MB)

### 5. HRMS ATTENDANCE
- [ ] Clock in/out works with proper timestamps
- [ ] Today's attendance shows on employee dashboard
- [ ] Attendance calendar view shows month grid with color-coded cells
- [ ] Department filter on calendar works
- [ ] Month navigation (prev/next) on calendar works
- [ ] Late detection works (>30 min after shift start)
- [ ] Absent detection works (no record on work day)

### 6. HRMS LEAVES
- [ ] Leave request create works with date validation
- [ ] Overlap check prevents double-booking (excludes 'cancelled')
- [ ] Leave balance deduction only on 'admin-approved' (not 'hr-reviewed')
- [ ] Leave review (HR) and approve (admin) work separately
- [ ] Leave cancel changes status to 'cancelled' (not 'rejected')
- [ ] Batch approve with select-all checkbox works
- [ ] Admin reject wraps attendance cleanup in transaction

### 7. HRMS CONTRACTS
- [ ] Contract create/edit works
- [ ] Contract approval activates Employee
- [ ] Contract reject deactivates Employee when no other active/pending contracts
- [ ] Contract terminate deactivates Employee + User when last active contract
- [ ] Contract audit logging works (reject and terminate)
- [ ] Batch approve with select-all checkbox works
- [ ] Contract expiry badges show correctly

### 8. HRMS PAYROLL
- [ ] SSS 2025 table correct (14.5% rate, 46 brackets)
- [ ] PhilHealth salary floor at 10,000 before 5% calculation
- [ ] Pag-IBIG cap at 100 (mandatory employee contribution)
- [ ] Holiday OT rates: Regular 2.60x, Special 1.69x
- [ ] 13th month pay is tax-exempt (up to 90,000)
- [ ] totalBasicYTD correctly accumulates from previous payslips
- [ ] Payroll generate payslips works
- [ ] Payslip print/download works (Print / Save PDF button)

### 9. HRMS SCHEDULES
- [ ] Schedule CRUD works
- [ ] Shift assignment to employees works
- [ ] Schedule delete wraps in transaction

### 10. HRMS JOB POSTINGS & HIRING
- [ ] Job posting create with closingDate >= today
- [ ] Interview scheduling with scheduledDate >= today, no past times
- [ ] Interview past time validation on same day
- [ ] Hire flow creates: Employee (active) + User (active, bcrypt password) + Contract (active) + Attendance default + Leave balance
- [ ] Hire sends email with: start date, schedule, HRMS URL, credentials
- [ ] Job portal (public /careers) redesign with hero, cards, apply modal
- [ ] Application status email includes onboarding details when 'hired'
- [ ] Position uniqueness enforced (case-insensitive)

### 11. HRMS DEPARTMENTS
- [ ] Department CRUD works
- [ ] Department uniqueness enforced (case-insensitive)
- [ ] Org chart tab shows tree visualization

### 12. INVENTORY MANAGEMENT
- [ ] Product CRUD works with all fields
- [ ] Stock in/out/adjust with quantity > 0 guards
- [ ] Low stock notification check runs periodically
- [ ] Expiry notification check runs periodically
- [ ] Stock movements logged correctly
- [ ] Products filtered by branch in POS
- [ ] CSV import/export for products

### 13. SUPPLIERS
- [ ] Supplier CRUD with all new fields (category, paymentTerms, leadTime, rating, etc.)
- [ ] Purchase history tab per supplier
- [ ] Analytics tab per supplier
- [ ] CSV import/export
- [ ] Category filter on list page

### 14. PURCHASES
- [ ] Purchase create with items
- [ ] Purchase receive updates stock atomically (row lock)
- [ ] Purchase payment accumulates (not overwrites)
- [ ] Purchase overpayment guard
- [ ] Cancel purchase with cancelled payment guard
- [ ] Order number generation (UUID-based, no race)

### 15. EXPENSES & PETTY CASH
- [ ] Expense CRUD with category
- [ ] Petty cash fund setup
- [ ] Deposit/withdraw mutations
- [ ] Selected fund updates with API response (not stale)
- [ ] Query invalidation on mutations

### 16. DISCOUNTS
- [ ] Discount CRUD with date validation (endDate >= startDate)
- [ ] Percentage value capped at 100
- [ ] Usage limit tracking

### 17. CUSTOMERS
- [ ] Customer CRUD
- [ ] Loyalty points display (mapped from loyalty_points field)
- [ ] CSV import/export

### 18. BRANCHES
- [ ] Branch CRUD with lat/lng
- [ ] Map component shows branches
- [ ] Branch selection in POS

### 19. DASHBOARD
- [ ] Admin dashboard: employee count, attendance summary, departments, pending approvals
- [ ] HR-specific dashboard view (filtered)
- [ ] Employee/cashier dashboard: welcome, clock in/out button, attendance, leave balance
- [ ] Department and Position display correctly (not "—")
- [ ] Pending counts badge on sidebar

### 20. SETTINGS
- [ ] Settings persist to file (data/settings.json)
- [ ] Settings response format uses sendSuccess
- [ ] SMTP config update works
- [ ] PayMongo config update works

### 21. NOTIFICATIONS
- [ ] Bell icon with unread count in HrmsLayout
- [ ] Notification dropdown with mark-as-read / mark-all-read
- [ ] Notifications created for: leave requests, contract changes, job applications
- [ ] useNotifications, useUnreadCount hooks work

### 22. ACTIVITY LOG
- [ ] Audit logging for create/update/delete operations
- [ ] Activity log page shows recent actions
- [ ] Audit middleware handles falsy values, DELETE logging

### 23. API QUALITY
- [ ] All routes use protect middleware
- [ ] Role-based authorization on sensitive routes
- [ ] hasPermission middleware for granular permissions
- [ ] Input validation via Joi on all mutation routes
- [ ] Consistent response format: sendSuccess / sendPaginated / sendError
- [ ] Correlation IDs on all error responses (X-Request-Id)
- [ ] LIKE wildcard escaping (escapeLike utility)
- [ ] 404 handler for undefined routes
- [ ] Rate limiting configured (9999 in dev)

### 24. FRONTEND QUALITY
- [ ] No inline styles where CSS classes exist (both frontends have extensive utility classes)
- [ ] DataTable: sort, filter, pagination, CSV export (filtered data), column toggle with outside-click close
- [ ] Modal: createPortal to document.body, z-index 9999
- [ ] Loading states on all pages (LoadingSkeleton)
- [ ] Error states on all pages (error message + retry)
- [ ] Empty states on all pages ("No X found")
- [ ] Toast notifications on all CRUD operations
- [ ] Responsive design (mobile sidebar, responsive grids)
- [ ] Code splitting with React.lazy for all pages

### 25. INFRASTRUCTURE
- [ ] .env.example with all variables documented
- [ ] Config validation (rejects placeholder JWT in production)
- [ ] Dockerfile with Node 20-alpine, multistage, non-root user
- [ ] docker-compose.yml with MySQL + Nginx
- [ ] nginx.conf reverse proxy
- [ ] GitHub Actions CI/CD
- [ ] ESLint config + lint scripts
- [ ] Husky + lint-staged pre-commit
- [ ] Pino structured JSON logging (production)
- [ ] Prometheus /metrics endpoint
- [ ] Health check endpoint
- [ ] Graceful shutdown

### 26. SECURITY
- [ ] Helmet with frameguard disabled (for POS iframe)
- [ ] CORS configured (allow !origin requests)
- [ ] Refresh token rotation with blacklisting
- [ ] Password hashing with bcryptjs
- [ ] No secrets in code (only .env)
- [ ] SQL injection prevented (Sequelize parameterized queries)
- [ ] File upload validation (type, size, magic numbers)
- [ ] PosEmbed postMessage origin validation

---

## HOW TO AUDIT

For each role, simulate the COMPLETE user journey:

### Admin Journey
1. Login → Dashboard loads with stats
2. Navigate all sidebar items → pages load correctly
3. Create employee → approve → employee appears in list
4. Create department → assign position → create job posting
5. Process payroll → generate payslips → pay
6. Manage discounts, expenses, petty cash
7. View reports, finance

### Cashier Journey
1. Login → POS opens full-screen automatically
2. Search products → add to cart → verify stock limits
3. Apply discount → verify tax calculation
4. Process payment (cash/PayMongo)
5. Click "Back to HRMS" → lands on EmployeeLayout /my-attendance
6. Clock in/out → view attendance history
7. Request leave → view leave balance
8. View payslips, contracts
9. Click POS System button in sidebar → POS opens as overlay

### Inventory Staff Journey
1. Login → POS opens full-screen automatically
2. "Back to HRMS" → InventoryStaffLayout /inventory-dashboard
3. View inventory dashboard stats
4. Manage products, categories, suppliers
5. Create purchase orders → receive stock
6. View stock movements
7. Click POS System button in sidebar → POS opens as overlay

### Employee Journey
1. Login → EmployeeLayout /my-attendance
2. View dashboard (welcome, employee info, leave balance)
3. Clock in/out
4. View attendance history
5. Request leave
6. View payslips, contracts
7. Update profile

---

## KNOWN EDGE CASES TO VERIFY

1. **Cart race condition:** Two cashiers selling last item — SELECT FOR UPDATE prevents overselling
2. **Pending sale timeout:** Stock reserved but payment not completed — should restore after timeout
3. **Invoice collision:** Two sales at same time — UUID-based invoice numbers prevent collision
4. **Refresh token race:** Multiple tabs — blacklisting prevents reuse
5. **File upload:** Malicious files — magic number validation prevents execution
6. **LIKE injection:** User enters `%` or `_` in search — escapeLike utility escapes wildcards
7. **Concurrent stock adjustment:** Two inventory staff adjusting same product — row lock prevents inconsistency
8. **Leave overlap:** Same employee requesting overlapping dates — overlap check prevents
9. **Position uniqueness:** Two positions with same title (different case) — case-insensitive check prevents
10. **Contract cascade:** Terminating last contract deactivates employee AND user accounts

---

## OUTPUT FORMAT

When you find and fix issues, output a checklist:

```
## FIXED
- [x] Brief description of fix (file:line)
- [x] ...

## IMPROVED  
- [x] Brief description of improvement
- [x] ...

## VERIFIED WORKING
- [x] Feature name — works correctly
- [x] ...

## STILL BROKEN / NEEDS DISCUSSION
- [ ] Issue description and proposed fix
- [ ] ...
```

---

## IMPORTANT RULES

1. **DO NOT break existing working features** — test after every change
2. **DO NOT add comments** unless explicitly asked
3. **DO NOT change the design system** — indigo theme is final
4. **DO NOT remove the Employee seed** — server.js seeds employee records on startup
5. **ALWAYS run `vite build` after frontend changes** to verify no syntax errors
6. **ALWAYS check `node -c` on backend files** for syntax errors
7. **PREFER editing existing files** over creating new ones
8. **FOLLOW existing code conventions** — same patterns, same naming
9. **Keep both frontends in sync** — same CSS utility classes, same component patterns
10. **SECRETS stay in .env** — never commit credentials
