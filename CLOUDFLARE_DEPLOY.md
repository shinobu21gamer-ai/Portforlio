# Cloudflare Deploy (Free - No Credit Card)

## 1. Install Wrangler
```bash
npm install -g wrangler
# or
npx wrangler@latest
```

## 2. Login
```bash
wrangler login
```

## 3. Create D1 Database
```bash
wrangler d1 create minimart-pos
```
Copy the `database_id` output and update `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "minimart-pos"
database_id = "YOUR_DATABASE_ID_HERE"
```

## 4. Run Migrations (Local first, then Remote)
```bash
# Local dev
cd sia
npm install
wrangler d1 migrations apply minimart-pos --local
wrangler d1 execute minimart-pos --local --file=./seed.sql

# Production
wrangler d1 migrations apply minimart-pos --remote
wrangler d1 execute minimart-pos --remote --file=./seed.sql
```

## 5. Deploy Worker (Backend API)
```bash
wrangler deploy
```
Your API will be at: `https://minimart-pos.<your-subdomain>.workers.dev`

## 6. Deploy Frontends to Cloudflare Pages

### POS Frontend
```bash
cd sia/frontend
npm run build
# Go to https://dash.cloudflare.com → Pages → Create project → Connect Git
# Build command: npm run build
# Output directory: dist
# Environment variables:
#   VITE_API_URL = https://minimart-pos.<your-subdomain>.workers.dev/api/v1
```

### HRMS Frontend
```bash
cd sia/frontend-hrms
npm run build
# New Pages project
# Build command: npm run build
# Output directory: dist
# Environment variables:
#   VITE_API_URL = https://minimart-pos.<your-subdomain>.workers.dev/api/v1/hrms
```

## 7. Custom Domains (Optional)
In Pages project settings → Custom domains → Add your domain

## Credentials (from seed)
- **Admin**: `admin@minimart.com` / `admin123`
- **Manager**: `manager@minimart.com` / `admin123`
- **Cashier**: `cashier@minimart.com` / `cashier123`

## Commands Summary
```bash
# One-time setup
npm install -g wrangler
wrangler login
wrangler d1 create minimart-pos
# Update wrangler.toml with database_id

# Deploy backend
cd sia
npm install
wrangler d1 migrations apply minimart-pos --remote
wrangler d1 execute minimart-pos --remote --file=./seed.sql
wrangler deploy

# Deploy frontends: push to Git → Cloudflare Pages auto-deploys
```