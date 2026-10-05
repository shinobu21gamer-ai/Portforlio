# MiniMart POS + HRMS

A complete Point of Sale and HR management system built with Node.js, Express.js, and SQLite (or MySQL).

One app, one deploy:
- **POS app** → `http://localhost:5000/`
- **HRMS app** → `http://localhost:5000/hrms`
- **REST API** → `http://localhost:5000/api/v1` (and `/api/v1/hrms`)

## Features

- **Authentication & Authorization** - JWT-based auth, bcrypt password hashing, role-based access (Admin, Manager, Cashier)
- **Product Management** - CRUD, categories/subcategories, barcode/SKU, images, stock tracking, bulk import/export
- **Inventory Management** - Stock in/out, adjustments, movement history, low-stock alerts, expiry notifications
- **Sales Module** - Shopping cart, barcode scanning, discounts, multiple payment methods (Cash, GCash, Credit/Debit Card), invoice generation, refunds
- **Purchase Module** - Purchase orders, receive inventory, auto-stock update
- **Customer Management** - Profiles, loyalty points, purchase history
- **Supplier Management** - Contact details, purchase history, outstanding balances
- **Expenses Module** - CRUD, categories, daily/monthly reports
- **Dashboard & Reports** - Sales, profit/loss, inventory, best-sellers, exports to PDF/Excel
- **Notifications** - Low-stock, expiring products, new purchases
- **Audit Trail** - Track all user actions, timestamps, modified records
- **Swagger Documentation** - Interactive API docs at `/api-docs`

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Frontend:** React + Vite (POS and HRMS, built into this app)
- **Database:** SQLite (default) or MySQL 8.0+
- **ORM:** Sequelize 6
- **Auth:** JWT (jsonwebtoken + bcryptjs)
- **Validation:** Joi
- **File Upload:** Multer
- **API Docs:** Swagger/OpenAPI

## Project Structure

```
src/
├── config/          - Database and app configuration
├── controllers/     - Route handlers
├── middleware/       - Auth, validation, error handling, audit, upload
├── models/          - Sequelize models (15+ tables)
├── routes/          - Express route definitions
├── services/        - Business logic layer
├── utils/           - Helpers, ApiError, logger, response
├── validators/      - Joi validation schemas
├── docs/            - Swagger configuration
└── server.js        - Application entry point (serves API + both frontends)
frontend/            - POS frontend (React + Vite), served at /
frontend-hrms/       - HRMS frontend (React + Vite), served at /hrms
database.sqlite      - SQLite database file (created automatically)
```

## Quick Start

### Prerequisites

- Node.js >= 18 (Node 20+ recommended)
- npm

No database server needed — SQLite is used by default and the database is created
and seeded automatically on first run.

### Installation & Run

```bash
npm install
npm run build     # build the POS + HRMS frontends
npm start         # http://localhost:5000
```

- POS:  `http://localhost:5000`
- HRMS: `http://localhost:5000/hrms`
- API docs: `http://localhost:5000/api-docs`

### Using MySQL instead of SQLite

Set these in `.env` (or the environment) and restart:

```
DB_DIALECT=mysql
DB_HOST=localhost
DB_PORT=3306
DB_NAME=minimart_pos
DB_USER=root
DB_PASSWORD=yourpassword
```

Server starts at `http://localhost:5000`

## Default Users

| Role           | Email                     | Password     |
|----------------|---------------------------|--------------|
| Admin          | admin@minimart.com        | admin123     |
| HR             | hr@minimart.com           | hr123        |
| Manager        | manager@minimart.com      | admin123     |
| Cashier        | cashier@minimart.com      | cashier123   |
| Inventory      | inventory@minimart.com    | inventory123 |
| Employee       | ligma1@gmail.com          | employee123  |

## API Documentation

Interactive Swagger docs available at:

```
http://localhost:5000/api-docs
```

## API Endpoints

### Authentication
| Method | Endpoint              | Description        |
|--------|-----------------------|--------------------|
| POST   | /api/v1/auth/login    | Login             |
| POST   | /api/v1/auth/register | Register          |
| GET    | /api/v1/auth/profile  | Get profile       |
| PUT    | /api/v1/auth/profile  | Update profile    |
| POST   | /api/v1/auth/change-password | Change password |
| POST   | /api/v1/auth/forgot-password | Forgot password |
| POST   | /api/v1/auth/refresh-token | Refresh JWT    |

### Dashboard
| Method | Endpoint               | Description        |
|--------|------------------------|--------------------|
| GET    | /api/v1/dashboard      | Dashboard data     |

### Products
| Method | Endpoint                      | Description           |
|--------|-------------------------------|-----------------------|
| GET    | /api/v1/products              | List products         |
| GET    | /api/v1/products/:id          | Get product           |
| POST   | /api/v1/products              | Create product        |
| PUT    | /api/v1/products/:id          | Update product        |
| DELETE | /api/v1/products/:id          | Delete product        |
| GET    | /api/v1/products/barcode/:barcode | Find by barcode   |
| GET    | /api/v1/products/low-stock    | Low stock products    |
| GET    | /api/v1/products/expiring     | Expiring products     |
| GET    | /api/v1/products/best-sellers | Best sellers          |

### Categories
| Method | Endpoint                  | Description        |
|--------|---------------------------|--------------------|
| GET    | /api/v1/categories        | List categories    |
| GET    | /api/v1/categories/tree   | Category tree      |
| GET    | /api/v1/categories/:id    | Get category       |
| POST   | /api/v1/categories        | Create category    |
| PUT    | /api/v1/categories/:id    | Update category    |
| DELETE | /api/v1/categories/:id    | Delete category    |

### Sales
| Method | Endpoint                     | Description        |
|--------|------------------------------|--------------------|
| GET    | /api/v1/sales                | List sales         |
| GET    | /api/v1/sales/:id            | Get sale           |
| POST   | /api/v1/sales                | Create sale        |
| POST   | /api/v1/sales/:id/cancel     | Cancel sale        |
| GET    | /api/v1/sales/invoice/:no    | Find by invoice    |
| GET    | /api/v1/sales/report         | Sales report       |

### Purchases
| Method | Endpoint                         | Description            |
|--------|----------------------------------|------------------------|
| GET    | /api/v1/purchases                | List purchases         |
| GET    | /api/v1/purchases/:id            | Get purchase           |
| POST   | /api/v1/purchases                | Create purchase order  |
| PUT    | /api/v1/purchases/:id/receive    | Receive purchase       |
| POST   | /api/v1/purchases/:id/cancel     | Cancel purchase        |

### Inventory
| Method | Endpoint                         | Description        |
|--------|----------------------------------|--------------------|
| POST   | /api/v1/inventory/stock-in       | Stock in           |
| POST   | /api/v1/inventory/stock-out      | Stock out          |
| POST   | /api/v1/inventory/adjust         | Adjust stock       |
| GET    | /api/v1/inventory/movements      | Stock movements    |
| GET    | /api/v1/inventory/logs           | Inventory logs     |

### Customers
| Method | Endpoint                  | Description        |
|--------|---------------------------|--------------------|
| GET    | /api/v1/customers         | List customers     |
| GET    | /api/v1/customers/:id     | Get customer       |
| POST   | /api/v1/customers         | Create customer    |
| PUT    | /api/v1/customers/:id     | Update customer    |
| DELETE | /api/v1/customers/:id     | Delete customer    |

### Suppliers
| Method | Endpoint                            | Description              |
|--------|-------------------------------------|--------------------------|
| GET    | /api/v1/suppliers                   | List suppliers           |
| GET    | /api/v1/suppliers/outstanding-balances | Outstanding balances  |
| GET    | /api/v1/suppliers/:id               | Get supplier             |
| POST   | /api/v1/suppliers                   | Create supplier          |
| PUT    | /api/v1/suppliers/:id               | Update supplier          |
| DELETE | /api/v1/suppliers/:id               | Delete supplier          |

### Expenses
| Method | Endpoint                    | Description         |
|--------|-----------------------------|---------------------|
| GET    | /api/v1/expenses            | List expenses       |
| GET    | /api/v1/expenses/:id        | Get expense         |
| POST   | /api/v1/expenses            | Create expense      |
| PUT    | /api/v1/expenses/:id        | Update expense      |
| DELETE | /api/v1/expenses/:id        | Delete expense      |
| GET    | /api/v1/expenses/report     | Expense report      |

### Notifications
| Method | Endpoint                               | Description          |
|--------|----------------------------------------|----------------------|
| GET    | /api/v1/notifications                  | List notifications   |
| GET    | /api/v1/notifications/unread-count     | Unread count         |
| PUT    | /api/v1/notifications/mark-read        | Mark read            |
| PUT    | /api/v1/notifications/mark-all-read    | Mark all read        |

### Activity Logs
| Method | Endpoint                       | Description        |
|--------|--------------------------------|--------------------|
| GET    | /api/v1/activity-logs          | List logs          |
| GET    | /api/v1/activity-logs/user/:id | User logs          |

### Users (Admin)
| Method | Endpoint           | Description     |
|--------|--------------------|-----------------|
| GET    | /api/v1/users      | List users      |
| GET    | /api/v1/users/:id  | Get user        |
| POST   | /api/v1/users      | Create user     |
| PUT    | /api/v1/users/:id  | Update user     |
| DELETE | /api/v1/users/:id  | Delete user     |

## Authentication

All protected endpoints require a Bearer token:

```
Authorization: Bearer <your_jwt_token>
```

## Postman Collection

Import `postman_collection.json` into Postman for a complete set of API requests.

## Database

### Tables

- `roles`, `permissions`, `role_permissions` - RBAC
- `users` - System users
- `branches` - Multi-branch support (future)
- `categories` - Product categories/subcategories
- `products` - Product catalog
- `suppliers` - Supplier management
- `customers` - Customer profiles
- `sales`, `sale_items` - Sales transactions
- `payments` - Payment records
- `purchases`, `purchase_items` - Purchase orders
- `stock_movements` - Stock movement history
- `inventories` - Inventory audit log
- `expenses`, `expense_categories` - Expense tracking
- `loyalty_points` - Customer loyalty program
- `notifications` - System notifications
- `activity_logs` - Audit trail

## Environment Variables

| Variable              | Description          | Default     |
|-----------------------|----------------------|-------------|
| NODE_ENV              | Environment          | development |
| PORT                  | Server port          | 5000        |
| AUTO_SETUP            | Dev only: seed demo accounts + demo data on boot (never effective in production) | - |
| INITIAL_ADMIN_EMAIL / INITIAL_ADMIN_PASSWORD | Production first-run admin (password 12+ chars). Unset → a one-time generated password is printed to the deploy logs once. Only used when the users table is empty. | admin@minimart.com / - |
| DB_DIALECT            | Database engine      | sqlite      |
| DB_STORAGE            | SQLite file path (point at a persistent volume in production) | ./database.sqlite |
| DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD | MySQL settings (when DB_DIALECT=mysql) | - |
| UPLOAD_DIR            | Base uploads directory (products/resumes/documents); point at a persistent volume in production | ./uploads |
| SETTINGS_FILE         | Runtime settings file (settings.defaults.json is the committed baseline) | ./data/settings.json |
| EMAIL_DISABLED        | `true` explicitly disables outbound email in production (otherwise SMTP_HOST is required) | - |
| SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / EMAIL_FROM | Outbound email (password resets, payslips, receipts) | - |
| JWT_SECRET            | JWT signing secret   | required in production |
| JWT_REFRESH_SECRET    | Refresh token secret | required in production |
| JWT_EXPIRES_IN        | Token expiry         | 7d          |
| BCRYPT_SALT_ROUNDS    | Hash rounds          | 10          |
| CORS_ORIGIN           | Extra allowed origins (comma-separated) | same-origin allowed |

## License

MIT
